-- Personnel file (compensation, documents, conduct) + rota cover templates
-- for auto-generate week drafts. Service-role / desk pattern; employee read
-- scopes match existing HR private tables.

-- ---------------------------------------------------------------------------
-- Private profile: health contribution (HC), service charge (SC), photo
-- ---------------------------------------------------------------------------

alter table staff_private_profiles
  add column if not exists health_contribution_btn numeric(12,2)
    check (health_contribution_btn is null or health_contribution_btn >= 0),
  add column if not exists service_charge_eligible boolean not null default false,
  add column if not exists service_charge_share_btn numeric(12,2)
    check (service_charge_share_btn is null or service_charge_share_btn >= 0),
  add column if not exists photo_public_id text;

comment on column staff_private_profiles.health_contribution_btn is
  'Monthly health contribution deduction in Nu (HC).';
comment on column staff_private_profiles.service_charge_eligible is
  'Whether staff participates in service-charge distribution.';
comment on column staff_private_profiles.service_charge_share_btn is
  'Optional fixed monthly SC share in Nu when eligible; null = pool only.';
comment on column staff_private_profiles.photo_public_id is
  'Optional Cloudinary public_id for staff pass photo.';

-- ---------------------------------------------------------------------------
-- Staff documents (Cloudinary-backed)
-- ---------------------------------------------------------------------------

create table if not exists staff_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  doc_type text not null
    check (doc_type = any (array[
      'pass_photo'::text,
      'cv'::text,
      'cid'::text,
      'other_id'::text,
      'other'::text
    ])),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  cloudinary_public_id text not null check (char_length(btrim(cloudinary_public_id)) > 0),
  resource_type text not null default 'image'
    check (resource_type = any (array['image'::text, 'raw'::text, 'video'::text])),
  notes text,
  uploaded_by text not null default 'desk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_documents_staff_idx
  on staff_documents (property_id, staff_id, created_at desc);

create index if not exists staff_documents_type_idx
  on staff_documents (property_id, staff_id, doc_type);

-- ---------------------------------------------------------------------------
-- Recurring pay components (allowances / fixed deductions)
-- ---------------------------------------------------------------------------

create table if not exists staff_pay_components (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  kind text not null
    check (kind = any (array['earning'::text, 'deduction'::text])),
  code text not null check (char_length(btrim(code)) between 1 and 40),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  amount_btn numeric(12,2) not null check (amount_btn >= 0),
  taxable boolean not null default true,
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_pay_components_dates_check
    check (effective_to is null or effective_to >= effective_from)
);

create index if not exists staff_pay_components_staff_idx
  on staff_pay_components (property_id, staff_id, is_active, kind);

create unique index if not exists staff_pay_components_active_code_uidx
  on staff_pay_components (property_id, staff_id, code)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- Conduct: merits and warnings
-- ---------------------------------------------------------------------------

create table if not exists staff_conduct_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  kind text not null
    check (kind = any (array['merit'::text, 'warning'::text])),
  severity text not null default 'note'
    check (severity = any (array[
      'note'::text,
      'low'::text,
      'medium'::text,
      'high'::text,
      'critical'::text
    ])),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text,
  recorded_on date not null default current_date,
  recorded_by text not null default 'desk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_conduct_records_staff_idx
  on staff_conduct_records (property_id, staff_id, recorded_on desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Rota cover templates (auto-generate week drafts)
-- ---------------------------------------------------------------------------

create table if not exists rota_cover_templates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  outlet text not null
    check (outlet = any (array[
      'front_desk'::text,
      'cafe'::text,
      'pastry'::text,
      'restaurant'::text,
      'bar'::text,
      'spa'::text,
      'housekeeping'::text,
      'maintenance'::text,
      'security'::text,
      'admin'::text,
      'other'::text
    ])),
  -- Mon=1 … Sun=7 (ISO weekday). Empty array = every day.
  days_of_week smallint[] not null default '{}'::smallint[]
    check (
      days_of_week = '{}'::smallint[]
      or (
        cardinality(days_of_week) > 0
        and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]
      )
    ),
  starts_at time not null,
  ends_at time not null,
  slots_needed integer not null default 1 check (slots_needed between 1 and 20),
  preferred_role_labels text[] not null default '{}'::text[],
  preferred_position_ilike text,
  priority integer not null default 100,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rota_cover_templates_time_check check (ends_at > starts_at)
);

create index if not exists rota_cover_templates_property_idx
  on rota_cover_templates (property_id, is_active, priority, outlet);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table staff_documents enable row level security;
alter table staff_pay_components enable row level security;
alter table staff_conduct_records enable row level security;
alter table rota_cover_templates enable row level security;

drop policy if exists "service_role full staff_documents" on staff_documents;
create policy "service_role full staff_documents" on staff_documents
  for all to service_role using (true) with check (true);

drop policy if exists "employee read own documents" on staff_documents;
create policy "employee read own documents" on staff_documents
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('hr_admin', 'payroll_admin', 'owner')
    )
  );

drop policy if exists "service_role full staff_pay_components" on staff_pay_components;
create policy "service_role full staff_pay_components" on staff_pay_components
  for all to service_role using (true) with check (true);

drop policy if exists "employee read own pay components" on staff_pay_components;
create policy "employee read own pay components" on staff_pay_components
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('hr_admin', 'payroll_admin', 'owner')
    )
  );

drop policy if exists "service_role full staff_conduct_records" on staff_conduct_records;
create policy "service_role full staff_conduct_records" on staff_conduct_records
  for all to service_role using (true) with check (true);

drop policy if exists "employee read own conduct" on staff_conduct_records;
create policy "employee read own conduct" on staff_conduct_records
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('hr_admin', 'owner', 'supervisor')
    )
  );

drop policy if exists "service_role full rota_cover_templates" on rota_cover_templates;
create policy "service_role full rota_cover_templates" on rota_cover_templates
  for all to service_role using (true) with check (true);

drop policy if exists "supervisor read rota cover templates" on rota_cover_templates;
create policy "supervisor read rota cover templates" on rota_cover_templates
  for select to authenticated
  using (
    property_id = (select private.current_staff_property_id())
    and (select private.current_staff_access_level()) in (
      'supervisor', 'hr_admin', 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed default cover templates for Pelbu Suites Olakha
-- ---------------------------------------------------------------------------

insert into rota_cover_templates (
  property_id,
  name,
  outlet,
  days_of_week,
  starts_at,
  ends_at,
  slots_needed,
  preferred_role_labels,
  preferred_position_ilike,
  priority,
  notes
)
select
  p.id,
  seed.name,
  seed.outlet,
  seed.days_of_week,
  seed.starts_at::time,
  seed.ends_at::time,
  seed.slots_needed,
  seed.preferred_role_labels,
  seed.preferred_position_ilike,
  seed.priority,
  seed.notes
from properties p
cross join (
  values
    (
      'Front desk — morning',
      'front_desk',
      array[1,2,3,4,5,6,7]::smallint[],
      '07:00',
      '15:00',
      1,
      array['front_desk', 'reservation', 'manager']::text[],
      null::text,
      10,
      'Primary guest-facing desk cover'
    ),
    (
      'Front desk — evening',
      'front_desk',
      array[1,2,3,4,5,6,7]::smallint[],
      '15:00',
      '23:00',
      1,
      array['front_desk', 'reservation', 'manager']::text[],
      null::text,
      20,
      'Evening desk cover'
    ),
    (
      'Café — service',
      'cafe',
      array[1,2,3,4,5,6,7]::smallint[],
      '08:00',
      '16:00',
      2,
      array['fnb', 'kitchen']::text[],
      '%barista%'::text,
      30,
      'Café day service'
    ),
    (
      'Restaurant — lunch',
      'restaurant',
      array[1,2,3,4,5,6,7]::smallint[],
      '11:00',
      '15:00',
      2,
      array['fnb', 'kitchen']::text[],
      null::text,
      40,
      'Lunch service floor + kitchen'
    ),
    (
      'Restaurant — dinner',
      'restaurant',
      array[1,2,3,4,5,6]::smallint[],
      '17:00',
      '22:00',
      2,
      array['fnb', 'kitchen']::text[],
      null::text,
      50,
      'Dinner service (skip Sunday)'
    ),
    (
      'Housekeeping — morning',
      'housekeeping',
      array[1,2,3,4,5,6,7]::smallint[],
      '08:00',
      '16:00',
      2,
      array['housekeeping']::text[],
      null::text,
      60,
      'Room turn-down and make-up'
    ),
    (
      'Spa — day',
      'spa',
      array[1,2,3,4,5,6]::smallint[],
      '09:00',
      '17:00',
      1,
      array['spa']::text[],
      null::text,
      70,
      'Spa therapist cover'
    ),
    (
      'Security — late',
      'security',
      array[1,2,3,4,5,6,7]::smallint[],
      '22:00',
      '23:59',
      1,
      array['security']::text[],
      null::text,
      80,
      'Late security block (overnight handoff is manual)'
    )
) as seed(
  name,
  outlet,
  days_of_week,
  starts_at,
  ends_at,
  slots_needed,
  preferred_role_labels,
  preferred_position_ilike,
  priority,
  notes
)
where p.slug = 'pelbu-suites-olakha'
  and not exists (
    select 1
    from rota_cover_templates t
    where t.property_id = p.id
      and t.name = seed.name
  );
