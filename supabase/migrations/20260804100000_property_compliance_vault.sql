-- Phase 4: Compliance document vault (categories + uploads + lease package refs)

create table if not exists property_compliance_categories (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (property_id, code)
);

create index if not exists property_compliance_categories_property_idx
  on property_compliance_categories (property_id, sort_order);

alter table property_compliance_categories enable row level security;

drop policy if exists "service_role full property_compliance_categories" on property_compliance_categories;
create policy "service_role full property_compliance_categories" on property_compliance_categories
  for all to service_role using (true) with check (true);

create table if not exists property_compliance_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  category_id uuid not null references property_compliance_categories(id) on delete cascade,
  title text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  byte_size bigint,
  notes text,
  valid_from date,
  valid_until date,
  lease_agreement_ref text,
  deposit_slip_ref text,
  handover_inventory_ref text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists property_compliance_documents_property_idx
  on property_compliance_documents (property_id, uploaded_at desc);

create index if not exists property_compliance_documents_category_idx
  on property_compliance_documents (category_id, uploaded_at desc);

alter table property_compliance_documents enable row level security;

drop policy if exists "service_role full property_compliance_documents" on property_compliance_documents;
create policy "service_role full property_compliance_documents" on property_compliance_documents
  for all to service_role using (true) with check (true);

-- Seed Olakha compliance categories
insert into property_compliance_categories (
  property_id, code, name, description, sort_order, is_seeded
)
select
  p.id,
  v.code,
  v.name,
  v.description,
  v.sort_order,
  true
from properties p
cross join (
  values
    ('trade_license', 'Trade license', 'Municipal / RUB trade registration', 10),
    ('gst', 'GST & tax filings', 'BITS returns, payment confirmations', 20),
    ('fire_safety', 'Fire & safety', 'Inspection certificates, extinguishers', 30),
    ('lease', 'Lease package', 'Agreement, deposit slip, handover inventory', 40),
    ('insurance', 'Insurance', 'Property and liability policies', 50),
    ('staff', 'Staff contracts', 'Employment agreements, work permits', 60),
    ('other', 'Other compliance', 'Custom uploads', 90)
) as v(code, name, description, sort_order)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, code) do nothing;
