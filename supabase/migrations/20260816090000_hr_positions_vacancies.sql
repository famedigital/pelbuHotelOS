-- Position catalog (TOR + templates), job vacancies, public interest applications.
-- Desk service-role pattern; public apply via server action only.

-- ---------------------------------------------------------------------------
-- Position definitions (reusable TOR by department/title)
-- ---------------------------------------------------------------------------

create table if not exists hr_job_positions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  department text not null check (char_length(btrim(department)) between 1 and 80),
  employment_type_default text not null default 'full_time'
    check (employment_type_default = any (array[
      'full_time'::text,
      'part_time'::text,
      'casual'::text,
      'contract'::text,
      'intern'::text
    ])),
  tor_summary text,
  tor_body text,
  publish_tor_public boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_job_positions_tor_public_has_content
    check (
      not publish_tor_public
      or (
        (tor_summary is not null and char_length(btrim(tor_summary)) > 0)
        or (tor_body is not null and char_length(btrim(tor_body)) > 0)
      )
    )
);

create unique index if not exists hr_job_positions_property_title_dept_uidx
  on hr_job_positions (property_id, lower(btrim(title)), lower(btrim(department)))
  where is_active = true;

create index if not exists hr_job_positions_property_dept_idx
  on hr_job_positions (property_id, department, is_active);

comment on table hr_job_positions is
  'Property job roles with TOR text; vacancies and templates hang off this catalog.';

-- ---------------------------------------------------------------------------
-- Position-wise template files (Cloudinary)
-- ---------------------------------------------------------------------------

create table if not exists hr_position_templates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  position_id uuid not null references hr_job_positions(id) on delete cascade,
  template_kind text not null
    check (template_kind = any (array[
      'tor'::text,
      'job_desc'::text,
      'application_form'::text,
      'offer_letter'::text,
      'contract'::text,
      'checklist'::text,
      'other'::text
    ])),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  cloudinary_public_id text not null check (char_length(btrim(cloudinary_public_id)) > 0),
  resource_type text not null default 'raw'
    check (resource_type = any (array['image'::text, 'raw'::text, 'video'::text])),
  file_url text,
  is_public boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_position_templates_position_idx
  on hr_position_templates (property_id, position_id, sort_order, created_at);

comment on table hr_position_templates is
  'Uploaded TOR/PDFs and forms for a position; is_public gates careers downloads.';

-- ---------------------------------------------------------------------------
-- Vacancies (open headcount for a position)
-- ---------------------------------------------------------------------------

create table if not exists hr_job_vacancies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  position_id uuid not null references hr_job_positions(id) on delete restrict,
  headcount int not null default 1 check (headcount >= 1 and headcount <= 99),
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'open'::text,
      'filled'::text,
      'closed'::text
    ])),
  publish_public boolean not null default false,
  salary_min_btn numeric(12,2)
    check (salary_min_btn is null or salary_min_btn >= 0),
  salary_max_btn numeric(12,2)
    check (salary_max_btn is null or salary_max_btn >= 0),
  salary_note text,
  show_salary_public boolean not null default false,
  posting_note text,
  opens_on date,
  closes_on date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_job_vacancies_salary_range_check
    check (
      salary_min_btn is null
      or salary_max_btn is null
      or salary_max_btn >= salary_min_btn
    ),
  constraint hr_job_vacancies_dates_check
    check (closes_on is null or opens_on is null or closes_on >= opens_on),
  constraint hr_job_vacancies_public_open_check
    check (not publish_public or status = 'open')
);

create index if not exists hr_job_vacancies_property_status_idx
  on hr_job_vacancies (property_id, status, publish_public);

create index if not exists hr_job_vacancies_position_idx
  on hr_job_vacancies (property_id, position_id);

comment on table hr_job_vacancies is
  'Open staffing needs for a catalog position; publish_public feeds /careers.';

-- ---------------------------------------------------------------------------
-- Interest applications
-- ---------------------------------------------------------------------------

create table if not exists hr_vacancy_applications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  vacancy_id uuid not null references hr_job_vacancies(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone text not null check (char_length(btrim(phone)) between 6 and 40),
  email text,
  message text,
  status text not null default 'new'
    check (status = any (array[
      'new'::text,
      'reviewed'::text,
      'shortlisted'::text,
      'rejected'::text,
      'hired'::text
    ])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_vacancy_applications_vacancy_idx
  on hr_vacancy_applications (property_id, vacancy_id, status, created_at desc);

create index if not exists hr_vacancy_applications_property_new_idx
  on hr_vacancy_applications (property_id, status, created_at desc);

comment on table hr_vacancy_applications is
  'Public interest form rows for open vacancies; insert via service-role action.';

-- ---------------------------------------------------------------------------
-- RLS: service_role full access (desk uses admin client)
-- ---------------------------------------------------------------------------

alter table hr_job_positions enable row level security;
alter table hr_position_templates enable row level security;
alter table hr_job_vacancies enable row level security;
alter table hr_vacancy_applications enable row level security;

drop policy if exists "service_role full hr_job_positions" on hr_job_positions;
create policy "service_role full hr_job_positions" on hr_job_positions
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full hr_position_templates" on hr_position_templates;
create policy "service_role full hr_position_templates" on hr_position_templates
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full hr_job_vacancies" on hr_job_vacancies;
create policy "service_role full hr_job_vacancies" on hr_job_vacancies
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full hr_vacancy_applications" on hr_vacancy_applications;
create policy "service_role full hr_vacancy_applications" on hr_vacancy_applications
  for all to service_role using (true) with check (true);
