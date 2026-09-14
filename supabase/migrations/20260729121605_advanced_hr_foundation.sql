-- Advanced hotel HR foundation: staff lifecycle, secure employee identity,
-- private records, announcements, delivery outbox, and workflow depth.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Staff identity and lifecycle
-- ---------------------------------------------------------------------------

alter table staff_members
  add column if not exists employee_code text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists access_level text not null default 'employee',
  add column if not exists department text,
  add column if not exists position_title text,
  add column if not exists manager_id uuid references staff_members(id) on delete set null,
  add column if not exists employment_type text not null default 'full_time',
  add column if not exists probation_ends_on date,
  add column if not exists contract_ends_on date,
  add column if not exists ended_on date,
  add column if not exists updated_at timestamptz not null default now();

with ranked as (
  select
    id,
    'EMP-' || lpad(
      row_number() over (partition by property_id order by created_at, id)::text,
      4,
      '0'
    ) as generated_code
  from staff_members
  where employee_code is null or btrim(employee_code) = ''
)
update staff_members sm
set employee_code = ranked.generated_code
from ranked
where sm.id = ranked.id;

alter table staff_members alter column employee_code set not null;

alter table staff_members drop constraint if exists staff_members_status_check;
alter table staff_members
  add constraint staff_members_status_check
  check (status = any (array[
    'active'::text,
    'inactive'::text,
    'on_leave'::text,
    'suspended'::text,
    'terminated'::text
  ]));

alter table staff_members
  drop constraint if exists staff_members_access_level_check;
alter table staff_members
  add constraint staff_members_access_level_check
  check (access_level = any (array[
    'employee'::text,
    'supervisor'::text,
    'hr_admin'::text,
    'payroll_admin'::text,
    'owner'::text
  ]));

alter table staff_members
  drop constraint if exists staff_members_employment_type_check;
alter table staff_members
  add constraint staff_members_employment_type_check
  check (employment_type = any (array[
    'full_time'::text,
    'part_time'::text,
    'casual'::text,
    'contract'::text,
    'intern'::text
  ]));

create unique index if not exists staff_members_property_employee_code_uidx
  on staff_members (property_id, employee_code);

create unique index if not exists staff_members_auth_user_uidx
  on staff_members (auth_user_id)
  where auth_user_id is not null;

create index if not exists staff_members_manager_idx
  on staff_members (property_id, manager_id, status);

create index if not exists staff_members_department_idx
  on staff_members (property_id, department, status);

create table if not exists staff_private_profiles (
  staff_id uuid primary key references staff_members(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  cid_number text,
  date_of_birth date,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  bank_name text,
  bank_account_number text,
  tax_identifier text,
  provident_fund_number text,
  base_wage_btn numeric(12,2) check (base_wage_btn is null or base_wage_btn >= 0),
  pay_schedule text not null default 'monthly'
    check (pay_schedule = any (array['monthly'::text, 'fortnightly'::text, 'weekly'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, staff_id)
);

create index if not exists staff_private_profiles_property_idx
  on staff_private_profiles (property_id, staff_id);

create table if not exists staff_employment_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete restrict,
  event_type text not null
    check (event_type = any (array[
      'hire'::text,
      'promotion'::text,
      'transfer'::text,
      'wage_change'::text,
      'suspension'::text,
      'reactivation'::text,
      'resignation'::text,
      'termination'::text,
      'note'::text
    ])),
  effective_on date not null default current_date,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_by text not null default 'desk',
  created_at timestamptz not null default now()
);

create index if not exists staff_employment_events_staff_idx
  on staff_employment_events (property_id, staff_id, effective_on desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Existing shift and leave workflow depth
-- ---------------------------------------------------------------------------

alter table staff_shifts
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table staff_shifts
  drop constraint if exists staff_shifts_status_check;
alter table staff_shifts
  add constraint staff_shifts_status_check
  check (status = any (array['draft'::text, 'published'::text, 'cancelled'::text]));

alter table staff_leave alter column status set default 'requested';
alter table staff_leave
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_staff_id uuid references staff_members(id) on delete set null,
  add column if not exists decision_notes text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists staff_leave_pending_idx
  on staff_leave (property_id, status, starts_on)
  where status = 'requested';

-- ---------------------------------------------------------------------------
-- HR/company notice board and free-first notification delivery
-- ---------------------------------------------------------------------------

create table if not exists hr_announcements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  category text not null default 'company'
    check (category = any (array[
      'company'::text,
      'hr'::text,
      'policy'::text,
      'operations'::text,
      'work_order'::text,
      'emergency'::text
    ])),
  priority text not null default 'normal'
    check (priority = any (array['normal'::text, 'important'::text, 'urgent'::text])),
  status text not null default 'draft'
    check (status = any (array['draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text])),
  audience_kind text not null default 'all'
    check (audience_kind = any (array[
      'all'::text,
      'department'::text,
      'role'::text,
      'shift'::text,
      'selected'::text
    ])),
  audience_value text,
  requires_acknowledgement boolean not null default false,
  is_pinned boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  work_order_id uuid references maintenance_orders(id) on delete set null,
  revision_of_id uuid references hr_announcements(id) on delete set null,
  publish_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  created_by_staff_id uuid references staff_members(id) on delete set null,
  created_by text not null default 'desk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_announcements_expiry_check
    check (expires_at is null or expires_at > coalesce(publish_at, created_at)),
  constraint hr_announcements_audience_value_check
    check (
      (audience_kind = 'all' and audience_value is null)
      or audience_kind <> 'all'
    )
);

create index if not exists hr_announcements_property_feed_idx
  on hr_announcements (property_id, status, is_pinned desc, published_at desc);

create index if not exists hr_announcements_scheduled_idx
  on hr_announcements (publish_at)
  where status = 'scheduled';

create table if not exists hr_announcement_recipients (
  announcement_id uuid not null references hr_announcements(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  reminder_count integer not null default 0 check (reminder_count >= 0),
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (announcement_id, staff_id)
);

create index if not exists hr_announcement_recipients_staff_idx
  on hr_announcement_recipients (property_id, staff_id, read_at, created_at desc);

create table if not exists hr_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid references staff_members(id) on delete cascade,
  announcement_id uuid references hr_announcements(id) on delete cascade,
  channel text not null
    check (channel = any (array['in_app'::text, 'web_push'::text, 'email'::text, 'whatsapp'::text])),
  event_type text not null,
  status text not null default 'pending'
    check (status = any (array['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text])),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (channel, idempotency_key)
);

create index if not exists hr_notification_outbox_pending_idx
  on hr_notification_outbox (status, available_at)
  where status in ('pending', 'failed');

create table if not exists hr_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, endpoint)
);

create index if not exists hr_push_subscriptions_staff_idx
  on hr_push_subscriptions (property_id, staff_id, is_active);

-- ---------------------------------------------------------------------------
-- Authenticated employee helpers and RLS
-- Authorization is derived from staff_members.auth_user_id, never user_metadata.
-- ---------------------------------------------------------------------------

create or replace function private.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select id
  from public.staff_members
  where auth_user_id = (select auth.uid())
    and status in ('active', 'on_leave')
  limit 1
$$;

create or replace function private.current_staff_property_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select property_id
  from public.staff_members
  where auth_user_id = (select auth.uid())
    and status in ('active', 'on_leave')
  limit 1
$$;

create or replace function private.current_staff_access_level()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select access_level
  from public.staff_members
  where auth_user_id = (select auth.uid())
    and status in ('active', 'on_leave')
  limit 1
$$;

revoke all on function private.current_staff_id() from public, anon;
revoke all on function private.current_staff_property_id() from public, anon;
revoke all on function private.current_staff_access_level() from public, anon;
grant execute on function private.current_staff_id() to authenticated, service_role;
grant execute on function private.current_staff_property_id() to authenticated, service_role;
grant execute on function private.current_staff_access_level() to authenticated, service_role;

alter table staff_private_profiles enable row level security;
alter table staff_employment_events enable row level security;
alter table hr_announcements enable row level security;
alter table hr_announcement_recipients enable row level security;
alter table hr_notification_outbox enable row level security;
alter table hr_push_subscriptions enable row level security;

drop policy if exists "service_role full staff_private_profiles" on staff_private_profiles;
create policy "service_role full staff_private_profiles" on staff_private_profiles
  for all to service_role using (true) with check (true);

drop policy if exists "employee read own private profile" on staff_private_profiles;
create policy "employee read own private profile" on staff_private_profiles
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('hr_admin', 'payroll_admin', 'owner')
    )
  );

drop policy if exists "service_role full staff_employment_events" on staff_employment_events;
create policy "service_role full staff_employment_events" on staff_employment_events
  for all to service_role using (true) with check (true);

drop policy if exists "employee read own employment events" on staff_employment_events;
create policy "employee read own employment events" on staff_employment_events
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('hr_admin', 'owner')
    )
  );

drop policy if exists "employee read own staff record" on staff_members;
create policy "employee read own staff record" on staff_members
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('supervisor', 'hr_admin', 'payroll_admin', 'owner')
    )
  );

drop policy if exists "employee read own shifts" on staff_shifts;
create policy "employee read own shifts" on staff_shifts
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('supervisor', 'hr_admin', 'owner')
    )
  );

drop policy if exists "employee read own leave" on staff_leave;
create policy "employee read own leave" on staff_leave
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('supervisor', 'hr_admin', 'payroll_admin', 'owner')
    )
  );

drop policy if exists "service_role full hr_announcements" on hr_announcements;
create policy "service_role full hr_announcements" on hr_announcements
  for all to service_role using (true) with check (true);

drop policy if exists "employee read assigned announcements" on hr_announcements;
create policy "employee read assigned announcements" on hr_announcements
  for select to authenticated
  using (
    status = 'published'
    and (expires_at is null or expires_at > now())
    and exists (
      select 1
      from hr_announcement_recipients recipient
      where recipient.announcement_id = hr_announcements.id
        and recipient.staff_id = (select private.current_staff_id())
    )
  );

drop policy if exists "service_role full hr_announcement_recipients" on hr_announcement_recipients;
create policy "service_role full hr_announcement_recipients" on hr_announcement_recipients
  for all to service_role using (true) with check (true);

drop policy if exists "employee read own announcement receipt" on hr_announcement_recipients;
create policy "employee read own announcement receipt" on hr_announcement_recipients
  for select to authenticated
  using (staff_id = (select private.current_staff_id()));

drop policy if exists "employee update own announcement receipt" on hr_announcement_recipients;
create policy "employee update own announcement receipt" on hr_announcement_recipients
  for update to authenticated
  using (staff_id = (select private.current_staff_id()))
  with check (
    staff_id = (select private.current_staff_id())
    and property_id = (select private.current_staff_property_id())
  );

revoke update on hr_announcement_recipients from authenticated;
grant update (read_at, acknowledged_at) on hr_announcement_recipients to authenticated;

drop policy if exists "service_role full hr_notification_outbox" on hr_notification_outbox;
create policy "service_role full hr_notification_outbox" on hr_notification_outbox
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full hr_push_subscriptions" on hr_push_subscriptions;
create policy "service_role full hr_push_subscriptions" on hr_push_subscriptions
  for all to service_role using (true) with check (true);

drop policy if exists "employee manage own push subscriptions" on hr_push_subscriptions;
create policy "employee manage own push subscriptions" on hr_push_subscriptions
  for all to authenticated
  using (staff_id = (select private.current_staff_id()))
  with check (
    staff_id = (select private.current_staff_id())
    and property_id = (select private.current_staff_property_id())
  );

-- Add employee-facing operational tables to Realtime once, when available.
do $$
begin
  alter publication supabase_realtime add table staff_shifts;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table staff_leave;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table hr_announcements;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table hr_announcement_recipients;
exception
  when duplicate_object then null;
end $$;
