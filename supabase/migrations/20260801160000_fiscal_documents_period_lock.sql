-- Fiscal invoice/receipt sequences (MY-A8) + document registry.

create table if not exists fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  doc_kind text not null
    check (doc_kind = any (array['invoice'::text, 'receipt'::text, 'credit_note'::text])),
  doc_no text not null,
  fiscal_year smallint not null,
  sequence_no bigint not null check (sequence_no > 0),
  folio_id uuid references folios (id) on delete set null,
  payment_id uuid references payments (id) on delete set null,
  booking_id uuid references bookings (id) on delete set null,
  period_id uuid references accounting_periods (id) on delete set null,
  issued_at timestamptz not null default now(),
  issued_by text not null default 'desk',
  status text not null default 'issued'
    check (status = any (array['issued'::text, 'void'::text])),
  void_reason text,
  voided_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists fiscal_documents_property_doc_no_uidx
  on fiscal_documents (property_id, doc_no);

create unique index if not exists fiscal_documents_active_invoice_folio_uidx
  on fiscal_documents (property_id, folio_id)
  where doc_kind = 'invoice'
    and status = 'issued'
    and folio_id is not null;

create index if not exists fiscal_documents_property_kind_issued_idx
  on fiscal_documents (property_id, doc_kind, issued_at desc);

create index if not exists fiscal_documents_folio_idx
  on fiscal_documents (folio_id, doc_kind)
  where folio_id is not null;

alter table fiscal_documents enable row level security;

drop policy if exists fiscal_documents_service_role on fiscal_documents;
create policy fiscal_documents_service_role
  on fiscal_documents
  for all
  to service_role
  using (true)
  with check (true);

comment on table fiscal_documents is
  'Gapless fiscal invoice/receipt numbers allocated via property_sequences on issue.';
