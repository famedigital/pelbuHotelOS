-- Phase 4: Finance / GST / bank proof / lease rent / vendor TPN

-- ---------------------------------------------------------------------------
-- Expenses: rent category + lease metadata
-- ---------------------------------------------------------------------------
alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category = any (array[
    'supplies'::text,
    'utilities'::text,
    'payroll'::text,
    'maintenance'::text,
    'marketing'::text,
    'tax'::text,
    'bank_fee'::text,
    'rent'::text,
    'other'::text
  ]));

alter table expenses
  add column if not exists lease_period_month date,
  add column if not exists lease_landlord text;

comment on column accounting_vendors.tax_id is
  'Vendor TPN (Tax Payer Number) for GST input credit.';

-- ---------------------------------------------------------------------------
-- Monthly GST / BITS return pack
-- ---------------------------------------------------------------------------
create table if not exists gst_return_packs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_month date not null,
  field_a_taxable_sales numeric(14,2) not null default 0,
  field_b_gst_output numeric(14,2) not null default 0,
  field_c_taxable_purchases numeric(14,2) not null default 0,
  field_d_gst_input numeric(14,2) not null default 0,
  field_e_net_payable numeric(14,2) not null default 0,
  status text not null default 'draft'
    check (status = any (array['draft'::text, 'filed'::text])),
  filed_at timestamptz,
  filed_confirmation_url text,
  bank_statement_id uuid references bank_statements(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, period_month)
);

create index if not exists gst_return_packs_property_idx
  on gst_return_packs (property_id, period_month desc);

alter table gst_return_packs enable row level security;
drop policy if exists "service_role full gst_return_packs" on gst_return_packs;
create policy "service_role full gst_return_packs" on gst_return_packs
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Bank / QR payment proof → pending_bank → confirm
-- ---------------------------------------------------------------------------
alter table payments
  add column if not exists confirmation_status text not null default 'confirmed'
    check (confirmation_status = any (array[
      'confirmed'::text,
      'pending_bank'::text,
      'rejected'::text
    ])),
  add column if not exists proof_url text,
  add column if not exists proof_submitted_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by text;

create index if not exists payments_pending_bank_idx
  on payments (property_id, confirmation_status, created_at desc)
  where confirmation_status = 'pending_bank';

alter table payment_links drop constraint if exists payment_links_status_check;
alter table payment_links add constraint payment_links_status_check
  check (status = any (array[
    'open'::text,
    'pending_bank'::text,
    'paid'::text,
    'expired'::text,
    'cancelled'::text
  ]));

alter table payment_links
  add column if not exists proof_url text,
  add column if not exists proof_submitted_at timestamptz,
  add column if not exists proof_reference text;

-- PO receive location (default store)
alter table inventory_purchase_orders
  add column if not exists receive_location_id uuid references inventory_locations(id) on delete set null;
