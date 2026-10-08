-- Hotel statement (multi-account categories) and RRCO filing pack.
-- Desk money paths use service_role. No anon access.

-- ---------------------------------------------------------------------------
-- Accounts that pay hotel bills (operating, owner, related company)
-- ---------------------------------------------------------------------------
create table if not exists finance_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  label text not null,
  bank_code text not null default 'other'
    check (bank_code = any (array[
      'bob'::text, 'bnb'::text, 'tbank'::text, 'drukpnb'::text, 'other'::text
    ])),
  account_no text,
  account_role text not null
    check (account_role = any (array[
      'operating'::text, 'owner'::text, 'related'::text
    ])),
  opening_balance_btn numeric(14,2) not null default 0,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, label)
);

create index if not exists finance_bank_accounts_property_idx
  on finance_bank_accounts (property_id, sort_order);

alter table finance_bank_accounts enable row level security;
drop policy if exists "service_role full finance_bank_accounts" on finance_bank_accounts;
create policy "service_role full finance_bank_accounts" on finance_bank_accounts
  for all to service_role using (true) with check (true);

alter table bank_statements
  add column if not exists finance_account_id uuid references finance_bank_accounts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Classification of each bank line for the hotel statement
-- ---------------------------------------------------------------------------
create table if not exists statement_line_classes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  bank_txn_id uuid not null references bank_transactions(id) on delete cascade,
  category text not null,
  treatment text not null
    check (treatment = any (array[
      'unmatched'::text,
      'room_receipt'::text,
      'walkin_receipt'::text,
      'pos_receipt'::text,
      'agent_settlement'::text,
      'early_collection'::text,
      'owner_transfer'::text,
      'loan_in'::text,
      'loan_out'::text,
      'cash_deposit'::text,
      'expense'::text,
      'salary_bank'::text,
      'not_income'::text
    ])),
  party text,
  reason text,
  payment_id uuid references payments(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  folio_id uuid references folios(id) on delete set null,
  expense_id uuid references expenses(id) on delete set null,
  classified_at timestamptz not null default now(),
  unique (bank_txn_id)
);

create index if not exists statement_line_classes_property_idx
  on statement_line_classes (property_id, treatment);

alter table statement_line_classes enable row level security;
drop policy if exists "service_role full statement_line_classes" on statement_line_classes;
create policy "service_role full statement_line_classes" on statement_line_classes
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- RRCO income-year filing
-- ---------------------------------------------------------------------------
create table if not exists rrco_filings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  tax_year int not null check (tax_year between 2000 and 2100),
  cash_in_hand_btn numeric(14,2) not null default 0,
  tds_btn numeric(14,2) not null default 0,
  capital_btn numeric(14,2) not null default 0,
  prepared_by text,
  status text not null default 'draft'
    check (status = any (array['draft'::text, 'locked'::text])),
  created_at timestamptz not null default now(),
  unique (property_id, tax_year)
);

alter table rrco_filings enable row level security;
drop policy if exists "service_role full rrco_filings" on rrco_filings;
create policy "service_role full rrco_filings" on rrco_filings
  for all to service_role using (true) with check (true);

create table if not exists rrco_lines (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references rrco_filings(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  source_kind text not null
    check (source_kind = any (array[
      'bank'::text,
      'folio'::text,
      'pos'::text,
      'cash_payment'::text,
      'cash_expense'::text,
      'salary_sheet'::text,
      'comp'::text,
      'manual'::text
    ])),
  source_id uuid,
  txn_date date not null,
  description text not null,
  amount_btn numeric(14,2) not null check (amount_btn >= 0),
  side text not null check (side = any (array['credit'::text, 'debit'::text])),
  category text not null,
  treatment text not null
    check (treatment = any (array[
      'include_income'::text,
      'include_expense'::text,
      'comp'::text,
      'owner_transfer'::text,
      'loan'::text,
      'deposit'::text,
      'capital'::text,
      'personal'::text,
      'duplicate'::text,
      'sdf_passthrough'::text,
      'agent_settlement'::text,
      'salary_sheet'::text
    ])),
  reason text,
  original_ref text,
  party text,
  created_at timestamptz not null default now()
);

create unique index if not exists rrco_lines_source_uidx
  on rrco_lines (filing_id, source_kind, source_id)
  where source_id is not null;

create index if not exists rrco_lines_filing_idx
  on rrco_lines (filing_id, txn_date);

alter table rrco_lines enable row level security;
drop policy if exists "service_role full rrco_lines" on rrco_lines;
create policy "service_role full rrco_lines" on rrco_lines
  for all to service_role using (true) with check (true);

create table if not exists rrco_canonical_docs (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references rrco_filings(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  doc_kind text not null check (doc_kind = any (array['invoice'::text, 'bill'::text])),
  seq int not null check (seq > 0),
  doc_no text not null,
  doc_date date not null,
  source_kind text not null,
  source_id uuid,
  original_ref text,
  description text not null,
  category text not null,
  amount_btn numeric(14,2) not null check (amount_btn >= 0),
  unique (filing_id, doc_no)
);

create unique index if not exists rrco_canonical_source_uidx
  on rrco_canonical_docs (filing_id, source_kind, source_id)
  where source_id is not null;

create index if not exists rrco_canonical_filing_idx
  on rrco_canonical_docs (filing_id, doc_date, seq);

alter table rrco_canonical_docs enable row level security;
drop policy if exists "service_role full rrco_canonical_docs" on rrco_canonical_docs;
create policy "service_role full rrco_canonical_docs" on rrco_canonical_docs
  for all to service_role using (true) with check (true);

create table if not exists rrco_assessment_files (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references rrco_filings(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  label text not null,
  kind text not null
    check (kind = any (array[
      'statement'::text,
      'invoice'::text,
      'bill'::text,
      'comp_schedule'::text,
      'reason'::text,
      'other'::text
    ])),
  storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists rrco_assessment_files_filing_idx
  on rrco_assessment_files (filing_id, created_at desc);

alter table rrco_assessment_files enable row level security;
drop policy if exists "service_role full rrco_assessment_files" on rrco_assessment_files;
create policy "service_role full rrco_assessment_files" on rrco_assessment_files
  for all to service_role using (true) with check (true);

-- Accountant desk role
alter table staff_members drop constraint if exists staff_members_desk_role_check;
alter table staff_members
  add constraint staff_members_desk_role_check
  check (
    desk_role is null
    or desk_role = any (array[
      'front_desk'::text,
      'cashier'::text,
      'gm'::text,
      'hk'::text,
      'owner'::text,
      'fnb'::text,
      'kitchen'::text,
      'laundry'::text,
      'accountant'::text
    ])
  );

comment on column staff_members.desk_role is
  'ERP desk RBAC: front_desk | cashier | gm | hk | owner | fnb | kitchen | laundry | accountant. Null falls back to department / access_level mapping.';
