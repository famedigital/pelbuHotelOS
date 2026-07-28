-- P4: finance expenses + bank statement reconciliation
-- Desk/import path uses service_role. No anon access to money tables.

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  category text not null
    check (category = any (array[
      'supplies'::text,
      'utilities'::text,
      'payroll'::text,
      'maintenance'::text,
      'marketing'::text,
      'tax'::text,
      'bank_fee'::text,
      'other'::text
    ])),
  description text not null,
  amount_btn numeric(12,2) not null check (amount_btn > 0),
  gst_btn numeric(12,2) not null default 0 check (gst_btn >= 0),
  expense_date date not null,
  vendor text,
  payment_method text not null default 'bank'
    check (payment_method = any (array[
      'cash'::text,
      'bank'::text,
      'card'::text
    ])),
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_property_date_idx
  on expenses (property_id, expense_date desc);

alter table expenses enable row level security;

drop policy if exists "service_role full expenses" on expenses;
create policy "service_role full expenses" on expenses
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Bank statements (PDF upload metadata)
-- ---------------------------------------------------------------------------
create table if not exists bank_statements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  bank_code text not null
    check (bank_code = any (array[
      'bob'::text,
      'bnb'::text,
      'tbank'::text,
      'drukpnb'::text
    ])),
  account_label text,
  period_start date,
  period_end date,
  source_filename text,
  source_sha256 text,
  status text not null default 'uploaded'
    check (status = any (array[
      'uploaded'::text,
      'parsed'::text,
      'matched'::text,
      'archived'::text
    ])),
  parsed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists bank_statements_sha_uidx
  on bank_statements (property_id, source_sha256)
  where source_sha256 is not null;

create index if not exists bank_statements_property_idx
  on bank_statements (property_id, created_at desc);

alter table bank_statements enable row level security;

drop policy if exists "service_role full bank_statements" on bank_statements;
create policy "service_role full bank_statements" on bank_statements
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Normalized bank transactions (from Python parsers)
-- ---------------------------------------------------------------------------
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references bank_statements(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  bank_code text not null
    check (bank_code = any (array[
      'bob'::text,
      'bnb'::text,
      'tbank'::text,
      'drukpnb'::text
    ])),
  txn_date date not null,
  value_date date,
  description text not null,
  debit_btn numeric(12,2) not null default 0 check (debit_btn >= 0),
  credit_btn numeric(12,2) not null default 0 check (credit_btn >= 0),
  balance_btn numeric(12,2),
  reference text,
  raw_line text,
  fingerprint text not null,
  match_status text not null default 'unmatched'
    check (match_status = any (array[
      'unmatched'::text,
      'matched'::text,
      'ignored'::text,
      'exception'::text
    ])),
  created_at timestamptz not null default now(),
  constraint bank_transactions_amount_xor check (
    (debit_btn > 0 and credit_btn = 0)
    or (credit_btn > 0 and debit_btn = 0)
    or (debit_btn = 0 and credit_btn = 0)
  )
);

create unique index if not exists bank_transactions_fp_uidx
  on bank_transactions (statement_id, fingerprint);

create index if not exists bank_transactions_match_idx
  on bank_transactions (property_id, match_status, txn_date desc);

create index if not exists bank_transactions_amount_idx
  on bank_transactions (property_id, credit_btn, debit_btn, txn_date);

alter table bank_transactions enable row level security;

drop policy if exists "service_role full bank_transactions" on bank_transactions;
create policy "service_role full bank_transactions" on bank_transactions
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Recon matches: bank txn ↔ payment and/or expense
-- ---------------------------------------------------------------------------
create table if not exists bank_recon_matches (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  bank_txn_id uuid not null references bank_transactions(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  expense_id uuid references expenses(id) on delete set null,
  match_kind text not null
    check (match_kind = any (array['auto'::text, 'manual'::text])),
  matched_amount_btn numeric(12,2) not null check (matched_amount_btn > 0),
  note text,
  matched_by text,
  matched_at timestamptz not null default now(),
  constraint bank_recon_matches_target check (
    payment_id is not null or expense_id is not null
  )
);

create unique index if not exists bank_recon_matches_txn_uidx
  on bank_recon_matches (bank_txn_id);

create index if not exists bank_recon_matches_payment_idx
  on bank_recon_matches (payment_id)
  where payment_id is not null;

create index if not exists bank_recon_matches_expense_idx
  on bank_recon_matches (expense_id)
  where expense_id is not null;

alter table bank_recon_matches enable row level security;

drop policy if exists "service_role full bank_recon_matches" on bank_recon_matches;
create policy "service_role full bank_recon_matches" on bank_recon_matches
  for all to service_role using (true) with check (true);

-- Payments / folios: lock down to service_role (desk uses admin client)
drop policy if exists "service_role full payments" on payments;
create policy "service_role full payments" on payments
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full folios" on folios;
create policy "service_role full folios" on folios
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full folio_lines" on folio_lines;
create policy "service_role full folio_lines" on folio_lines
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- P4 hardening: public inserts must use the expected intake status only
-- ---------------------------------------------------------------------------
drop policy if exists "anon insert bookings" on bookings;
create policy "anon insert bookings" on bookings
  for insert to anon, authenticated
  with check (status = 'pending');

drop policy if exists "anon insert orders" on orders;
create policy "anon insert orders" on orders
  for insert to anon, authenticated
  with check (status = 'received');

drop policy if exists "anon insert booking_guests" on booking_guests;
create policy "anon insert booking_guests" on booking_guests
  for insert to anon, authenticated
  with check (true);

drop policy if exists "anon insert order_items" on order_items;
create policy "anon insert order_items" on order_items
  for insert to anon, authenticated
  with check (true);

drop policy if exists "anon insert enquiries" on enquiries;
create policy "anon insert enquiries" on enquiries
  for insert to anon, authenticated
  with check (status = 'new');

drop policy if exists "anon insert service_requests" on service_requests;
create policy "anon insert service_requests" on service_requests
  for insert to anon, authenticated
  with check (status = 'pending');

drop policy if exists "anon insert pending agents" on agents;
create policy "anon insert pending agents" on agents
  for insert to anon, authenticated
  with check (status = 'pending' and credit_limit = 0 and credit_used = 0);