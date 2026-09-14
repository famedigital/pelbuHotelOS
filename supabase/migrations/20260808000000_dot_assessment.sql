-- DOT Assessment: Hotel Classification System (HCS 2024) self-assessment worksheets

create table if not exists dot_assessments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  star_level smallint not null check (star_level in (3, 4)),
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'ready', 'archived')),
  property_info jsonb not null default '{}'::jsonb,
  lead_assessor text,
  assessor_2 text,
  assessor_3 text,
  assessed_on date,
  notes text,
  na_sections text[] not null default '{}',
  catalog_version text not null default 'hcs-2024',
  catalog_source text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dot_assessments_property_idx
  on dot_assessments (property_id, updated_at desc);

create index if not exists dot_assessments_property_status_idx
  on dot_assessments (property_id, status);

alter table dot_assessments enable row level security;

drop policy if exists "service_role full dot_assessments" on dot_assessments;
create policy "service_role full dot_assessments" on dot_assessments
  for all to service_role using (true) with check (true);

create table if not exists dot_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references dot_assessments(id) on delete cascade,
  criterion_code text not null,
  section_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'yes', 'no', 'na', 'scored')),
  score_m smallint check (score_m is null or score_m in (0, 1)),
  score_q smallint check (score_q is null or (score_q >= 1 and score_q <= 5)),
  score_p numeric(8, 2) check (score_p is null or score_p >= 0),
  remarks text,
  updated_at timestamptz not null default now(),
  unique (assessment_id, criterion_code)
);

create index if not exists dot_assessment_responses_assessment_idx
  on dot_assessment_responses (assessment_id, section_key);

alter table dot_assessment_responses enable row level security;

drop policy if exists "service_role full dot_assessment_responses" on dot_assessment_responses;
create policy "service_role full dot_assessment_responses" on dot_assessment_responses
  for all to service_role using (true) with check (true);

create table if not exists dot_assessment_evidence (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references dot_assessments(id) on delete cascade,
  criterion_code text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  byte_size bigint,
  caption text,
  uploaded_at timestamptz not null default now()
);

create index if not exists dot_assessment_evidence_assessment_idx
  on dot_assessment_evidence (assessment_id, criterion_code);

create index if not exists dot_assessment_evidence_criterion_idx
  on dot_assessment_evidence (assessment_id, criterion_code, uploaded_at desc);

alter table dot_assessment_evidence enable row level security;

drop policy if exists "service_role full dot_assessment_evidence" on dot_assessment_evidence;
create policy "service_role full dot_assessment_evidence" on dot_assessment_evidence
  for all to service_role using (true) with check (true);

comment on table dot_assessments is
  'Internal self-assessment runs of Bhutan HCS 2024 hotel classification checklists (DOT prep).';
comment on table dot_assessment_responses is
  'Per-criterion answers for a DOT assessment (M/Q/P/N/A + remarks).';
comment on table dot_assessment_evidence is
  'Photo/PDF evidence files for DOT assessment criteria (finance-private storage paths).';
