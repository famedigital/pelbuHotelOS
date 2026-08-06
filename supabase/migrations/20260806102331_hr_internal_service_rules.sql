-- Internal Service Rules (ISR) — Bhutan: prepare → submit to Labour → approve → sign → PDF on file.

create table if not exists hr_internal_service_rules (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  version_label text not null,
  title text not null default 'Internal Service Rules',
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'submitted'::text,
      'approved'::text,
      'active'::text,
      'superseded'::text
    ])),
  notes text,
  scope_summary text,
  submitted_on date,
  labour_office text,
  labour_reference text,
  approved_on date,
  approval_reference text,
  signed_on date,
  signed_by_name text,
  pdf_public_id text,
  pdf_resource_type text not null default 'raw',
  pdf_file_name text,
  pdf_uploaded_at timestamptz,
  effective_from date,
  effective_to date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, version_label)
);

create index if not exists hr_isr_property_status_idx
  on hr_internal_service_rules (property_id, status, created_at desc);

create index if not exists hr_isr_property_current_idx
  on hr_internal_service_rules (property_id)
  where is_current = true;

comment on table hr_internal_service_rules is
  'Hotel Internal Service Rules (ISR) lifecycle for Bhutan: draft, submit to Labour, approve, sign, store PDF.';

comment on column hr_internal_service_rules.is_current is
  'True for the active signed ISR staff and auditors treat as in force; at most one current per property (enforced in app).';

alter table hr_internal_service_rules enable row level security;

drop policy if exists "service_role full hr_internal_service_rules" on hr_internal_service_rules;
create policy "service_role full hr_internal_service_rules" on hr_internal_service_rules
  for all to service_role using (true) with check (true);

-- Compliance vault category for Labour ISR PDF archive (all properties).
insert into property_compliance_categories (
  property_id, code, name, description, sort_order, is_seeded
)
select
  p.id,
  'isr',
  'Internal Service Rules (Labour)',
  'Signed ISR submitted to / approved by Labour — official PDF on file',
  55,
  true
from properties p
on conflict (property_id, code) do nothing;
