-- Double-entry accounting foundation for hotel finance.
-- Operational tables (folios, payments, expenses, payroll, inventory) remain source of truth.
-- Journals post idempotently from an opening-balance date forward.

-- ---------------------------------------------------------------------------
-- Departments / cost centres
-- ---------------------------------------------------------------------------
create table if not exists accounting_departments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null default 'ops'
    check (kind = any (array[
      'rooms'::text,
      'fb'::text,
      'spa'::text,
      'services'::text,
      'admin'::text,
      'ops'::text,
      'other'::text
    ])),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, code)
);

create index if not exists accounting_departments_property_idx
  on accounting_departments (property_id, sort_order);

alter table accounting_departments enable row level security;
drop policy if exists "service_role full accounting_departments" on accounting_departments;
create policy "service_role full accounting_departments" on accounting_departments
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------
create table if not exists accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null
    check (account_type = any (array[
      'asset'::text,
      'liability'::text,
      'equity'::text,
      'revenue'::text,
      'expense'::text,
      'cogs'::text
    ])),
  normal_balance text not null
    check (normal_balance = any (array['debit'::text, 'credit'::text])),
  parent_id uuid references accounting_accounts(id) on delete set null,
  department_id uuid references accounting_departments(id) on delete set null,
  is_system boolean not null default false,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  system_key text,
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, code),
  unique (property_id, system_key)
);

create index if not exists accounting_accounts_property_type_idx
  on accounting_accounts (property_id, account_type, code);
create index if not exists accounting_accounts_system_key_idx
  on accounting_accounts (property_id, system_key)
  where system_key is not null;

alter table accounting_accounts enable row level security;
drop policy if exists "service_role full accounting_accounts" on accounting_accounts;
create policy "service_role full accounting_accounts" on accounting_accounts
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Fiscal years + periods
-- ---------------------------------------------------------------------------
create table if not exists accounting_fiscal_years (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open'
    check (status = any (array['open'::text, 'closed'::text])),
  created_at timestamptz not null default now(),
  unique (property_id, label),
  check (ends_on > starts_on)
);

create table if not exists accounting_periods (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  fiscal_year_id uuid not null references accounting_fiscal_years(id) on delete cascade,
  label text not null,
  period_index int not null check (period_index between 1 and 12),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open'
    check (status = any (array[
      'open'::text,
      'soft_closed'::text,
      'closed'::text
    ])),
  closed_at timestamptz,
  closed_by text,
  created_at timestamptz not null default now(),
  unique (property_id, fiscal_year_id, period_index),
  check (ends_on >= starts_on)
);

create index if not exists accounting_periods_range_idx
  on accounting_periods (property_id, starts_on, ends_on);

alter table accounting_fiscal_years enable row level security;
alter table accounting_periods enable row level security;
drop policy if exists "service_role full accounting_fiscal_years" on accounting_fiscal_years;
create policy "service_role full accounting_fiscal_years" on accounting_fiscal_years
  for all to service_role using (true) with check (true);
drop policy if exists "service_role full accounting_periods" on accounting_periods;
create policy "service_role full accounting_periods" on accounting_periods
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Journals + lines
-- ---------------------------------------------------------------------------
create table if not exists accounting_journals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_id uuid references accounting_periods(id) on delete set null,
  journal_no text not null,
  journal_date date not null,
  journal_kind text not null default 'general'
    check (journal_kind = any (array[
      'general'::text,
      'opening'::text,
      'sales'::text,
      'payment'::text,
      'expense'::text,
      'payroll'::text,
      'inventory'::text,
      'bank'::text,
      'gst'::text,
      'depreciation'::text,
      'closing'::text,
      'reversal'::text
    ])),
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'posted'::text,
      'reversed'::text,
      'void'::text
    ])),
  memo text,
  source_table text,
  source_id uuid,
  source_event text,
  reverses_journal_id uuid references accounting_journals(id) on delete set null,
  posted_at timestamptz,
  posted_by text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (property_id, journal_no)
);

create index if not exists accounting_journals_date_idx
  on accounting_journals (property_id, journal_date desc, status);
create index if not exists accounting_journals_source_idx
  on accounting_journals (property_id, source_table, source_id)
  where source_table is not null;

create table if not exists accounting_journal_lines (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  journal_id uuid not null references accounting_journals(id) on delete cascade,
  line_no int not null check (line_no > 0),
  account_id uuid not null references accounting_accounts(id),
  department_id uuid references accounting_departments(id) on delete set null,
  description text,
  debit_btn numeric(14,2) not null default 0 check (debit_btn >= 0),
  credit_btn numeric(14,2) not null default 0 check (credit_btn >= 0),
  created_at timestamptz not null default now(),
  unique (journal_id, line_no),
  check (
    (debit_btn > 0 and credit_btn = 0)
    or (credit_btn > 0 and debit_btn = 0)
  )
);

create index if not exists accounting_journal_lines_account_idx
  on accounting_journal_lines (property_id, account_id, journal_id);

alter table accounting_journals enable row level security;
alter table accounting_journal_lines enable row level security;
drop policy if exists "service_role full accounting_journals" on accounting_journals;
create policy "service_role full accounting_journals" on accounting_journals
  for all to service_role using (true) with check (true);
drop policy if exists "service_role full accounting_journal_lines" on accounting_journal_lines;
create policy "service_role full accounting_journal_lines" on accounting_journal_lines
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Idempotent posting events + mapping rules
-- ---------------------------------------------------------------------------
create table if not exists accounting_posting_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  event_type text not null,
  status text not null default 'pending'
    check (status = any (array[
      'pending'::text,
      'posted'::text,
      'skipped'::text,
      'error'::text
    ])),
  journal_id uuid references accounting_journals(id) on delete set null,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, source_table, source_id, event_type)
);

create index if not exists accounting_posting_events_status_idx
  on accounting_posting_events (property_id, status, created_at desc);

create table if not exists accounting_posting_rules (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  event_type text not null,
  debit_system_key text,
  credit_system_key text,
  department_code text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, event_type)
);

alter table accounting_posting_events enable row level security;
alter table accounting_posting_rules enable row level security;
drop policy if exists "service_role full accounting_posting_events" on accounting_posting_events;
create policy "service_role full accounting_posting_events" on accounting_posting_events
  for all to service_role using (true) with check (true);
drop policy if exists "service_role full accounting_posting_rules" on accounting_posting_rules;
create policy "service_role full accounting_posting_rules" on accounting_posting_rules
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Opening balance setup
-- ---------------------------------------------------------------------------
create table if not exists accounting_opening_balances (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  effective_date date not null,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'approved'::text,
      'posted'::text
    ])),
  journal_id uuid references accounting_journals(id) on delete set null,
  notes text,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  unique (property_id)
);

create table if not exists accounting_opening_balance_lines (
  id uuid primary key default gen_random_uuid(),
  opening_balance_id uuid not null references accounting_opening_balances(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  account_id uuid not null references accounting_accounts(id),
  debit_btn numeric(14,2) not null default 0 check (debit_btn >= 0),
  credit_btn numeric(14,2) not null default 0 check (credit_btn >= 0),
  notes text,
  unique (opening_balance_id, account_id),
  check (
    (debit_btn > 0 and credit_btn = 0)
    or (credit_btn > 0 and debit_btn = 0)
    or (debit_btn = 0 and credit_btn = 0)
  )
);

alter table accounting_opening_balances enable row level security;
alter table accounting_opening_balance_lines enable row level security;
drop policy if exists "service_role full accounting_opening_balances" on accounting_opening_balances;
create policy "service_role full accounting_opening_balances" on accounting_opening_balances
  for all to service_role using (true) with check (true);
drop policy if exists "service_role full accounting_opening_balance_lines" on accounting_opening_balance_lines;
create policy "service_role full accounting_opening_balance_lines" on accounting_opening_balance_lines
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Vendors + AP bills
-- ---------------------------------------------------------------------------
create table if not exists accounting_vendors (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  tax_id text,
  phone text,
  email text,
  address text,
  payment_terms_days int not null default 0 check (payment_terms_days >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists accounting_vendors_property_idx
  on accounting_vendors (property_id, name);

create table if not exists accounting_bills (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  vendor_id uuid references accounting_vendors(id) on delete set null,
  bill_no text,
  bill_date date not null,
  due_date date,
  description text not null,
  amount_btn numeric(14,2) not null check (amount_btn > 0),
  gst_btn numeric(14,2) not null default 0 check (gst_btn >= 0),
  total_btn numeric(14,2) not null check (total_btn > 0),
  status text not null default 'open'
    check (status = any (array[
      'open'::text,
      'partial'::text,
      'paid'::text,
      'void'::text
    ])),
  expense_id uuid references expenses(id) on delete set null,
  journal_id uuid references accounting_journals(id) on delete set null,
  attachment_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists accounting_bills_property_date_idx
  on accounting_bills (property_id, bill_date desc, status);

alter table accounting_vendors enable row level security;
alter table accounting_bills enable row level security;
drop policy if exists "service_role full accounting_vendors" on accounting_vendors;
create policy "service_role full accounting_vendors" on accounting_vendors
  for all to service_role using (true) with check (true);
drop policy if exists "service_role full accounting_bills" on accounting_bills;
create policy "service_role full accounting_bills" on accounting_bills
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Budgets
-- ---------------------------------------------------------------------------
create table if not exists accounting_budgets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  fiscal_year_id uuid not null references accounting_fiscal_years(id) on delete cascade,
  account_id uuid not null references accounting_accounts(id) on delete cascade,
  period_id uuid references accounting_periods(id) on delete cascade,
  amount_btn numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, fiscal_year_id, account_id, period_id)
);

alter table accounting_budgets enable row level security;
drop policy if exists "service_role full accounting_budgets" on accounting_budgets;
create policy "service_role full accounting_budgets" on accounting_budgets
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Fixed assets
-- ---------------------------------------------------------------------------
create table if not exists accounting_fixed_assets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  asset_code text not null,
  name text not null,
  category text not null default 'equipment',
  purchase_date date not null,
  cost_btn numeric(14,2) not null check (cost_btn > 0),
  salvage_btn numeric(14,2) not null default 0 check (salvage_btn >= 0),
  useful_life_months int not null check (useful_life_months > 0),
  depreciation_method text not null default 'straight_line'
    check (depreciation_method = any (array['straight_line'::text])),
  asset_account_id uuid references accounting_accounts(id) on delete set null,
  accum_depr_account_id uuid references accounting_accounts(id) on delete set null,
  expense_account_id uuid references accounting_accounts(id) on delete set null,
  status text not null default 'active'
    check (status = any (array[
      'active'::text,
      'disposed'::text,
      'fully_depreciated'::text
    ])),
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, asset_code)
);

create table if not exists accounting_depreciation_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_id uuid not null references accounting_periods(id) on delete cascade,
  asset_id uuid not null references accounting_fixed_assets(id) on delete cascade,
  amount_btn numeric(14,2) not null check (amount_btn > 0),
  journal_id uuid references accounting_journals(id) on delete set null,
  run_date date not null,
  created_at timestamptz not null default now(),
  unique (property_id, period_id, asset_id)
);

alter table accounting_fixed_assets enable row level security;
alter table accounting_depreciation_runs enable row level security;
drop policy if exists "service_role full accounting_fixed_assets" on accounting_fixed_assets;
create policy "service_role full accounting_fixed_assets" on accounting_fixed_assets
  for all to service_role using (true) with check (true);
drop policy if exists "service_role full accounting_depreciation_runs" on accounting_depreciation_runs;
create policy "service_role full accounting_depreciation_runs" on accounting_depreciation_runs
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Period close checklist
-- ---------------------------------------------------------------------------
create table if not exists accounting_close_checklists (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_id uuid not null references accounting_periods(id) on delete cascade,
  item_key text not null,
  label text not null,
  is_done boolean not null default false,
  done_at timestamptz,
  done_by text,
  notes text,
  unique (period_id, item_key)
);

alter table accounting_close_checklists enable row level security;
drop policy if exists "service_role full accounting_close_checklists" on accounting_close_checklists;
create policy "service_role full accounting_close_checklists" on accounting_close_checklists
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Link expenses to vendors optionally
-- ---------------------------------------------------------------------------
alter table expenses
  add column if not exists vendor_id uuid references accounting_vendors(id) on delete set null,
  add column if not exists journal_id uuid references accounting_journals(id) on delete set null,
  add column if not exists status text not null default 'posted'
    check (status = any (array[
      'draft'::text,
      'posted'::text,
      'void'::text
    ]));

-- ---------------------------------------------------------------------------
-- Journal balance enforcement (posted journals must balance)
-- ---------------------------------------------------------------------------
create or replace function accounting_assert_journal_balanced()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  debit_sum numeric(14,2);
  credit_sum numeric(14,2);
begin
  if new.status = 'posted' and (tg_op = 'INSERT' or old.status is distinct from 'posted') then
    select coalesce(sum(debit_btn), 0), coalesce(sum(credit_btn), 0)
      into debit_sum, credit_sum
    from accounting_journal_lines
    where journal_id = new.id;

    if debit_sum = 0 and credit_sum = 0 then
      raise exception 'Posted journal % has no lines', new.journal_no;
    end if;
    if debit_sum <> credit_sum then
      raise exception 'Posted journal % is unbalanced: debit % credit %',
        new.journal_no, debit_sum, credit_sum;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists accounting_journals_balance_trg on accounting_journals;
create trigger accounting_journals_balance_trg
  before insert or update of status on accounting_journals
  for each row execute function accounting_assert_journal_balanced();

-- Block edits to lines of posted journals
create or replace function accounting_guard_posted_journal_lines()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  j_status text;
  j_id uuid;
begin
  j_id := coalesce(new.journal_id, old.journal_id);
  select status into j_status from accounting_journals where id = j_id;
  if j_status in ('posted', 'reversed', 'void') then
    raise exception 'Cannot modify lines of a % journal', j_status;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists accounting_journal_lines_guard_trg on accounting_journal_lines;
create trigger accounting_journal_lines_guard_trg
  before insert or update or delete on accounting_journal_lines
  for each row execute function accounting_guard_posted_journal_lines();

-- Block posting into closed periods
create or replace function accounting_guard_closed_period()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  p_status text;
begin
  if new.period_id is null then
    return new;
  end if;
  select status into p_status from accounting_periods where id = new.period_id;
  if p_status = 'closed' and new.status = 'posted' then
    raise exception 'Cannot post into a closed accounting period';
  end if;
  return new;
end;
$$;

drop trigger if exists accounting_journals_period_guard_trg on accounting_journals;
create trigger accounting_journals_period_guard_trg
  before insert or update of status, period_id on accounting_journals
  for each row execute function accounting_guard_closed_period();

-- ---------------------------------------------------------------------------
-- Seed helper: default CoA + departments + fiscal year for one property
-- ---------------------------------------------------------------------------
create or replace function accounting_seed_property(p_property_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  fy_id uuid;
  fy_start date;
  fy_end date;
  month_start date;
  i int;
  period_id uuid;
begin
  -- Departments
  insert into accounting_departments (property_id, code, name, kind, sort_order)
  values
    (p_property_id, 'ROOMS', 'Rooms', 'rooms', 10),
    (p_property_id, 'FB', 'Food & Beverage', 'fb', 20),
    (p_property_id, 'SPA', 'Spa & Wellness', 'spa', 30),
    (p_property_id, 'SVC', 'Guest Services', 'services', 40),
    (p_property_id, 'ADMIN', 'Administration', 'admin', 50)
  on conflict (property_id, code) do nothing;

  -- Chart of accounts (system_key used by posting engine)
  insert into accounting_accounts (
    property_id, code, name, account_type, normal_balance, is_system, system_key
  ) values
    (p_property_id, '1000', 'Cash on Hand', 'asset', 'debit', true, 'cash'),
    (p_property_id, '1010', 'Bank — Operating', 'asset', 'debit', true, 'bank'),
    (p_property_id, '1020', 'Card Clearing', 'asset', 'debit', true, 'card_clearing'),
    (p_property_id, '1100', 'Accounts Receivable — Guests', 'asset', 'debit', true, 'ar_guest'),
    (p_property_id, '1110', 'Accounts Receivable — Agents', 'asset', 'debit', true, 'ar_agent'),
    (p_property_id, '1200', 'Inventory', 'asset', 'debit', true, 'inventory'),
    (p_property_id, '1300', 'GST Input Credit', 'asset', 'debit', true, 'gst_input'),
    (p_property_id, '1500', 'Fixed Assets', 'asset', 'debit', true, 'fixed_assets'),
    (p_property_id, '1510', 'Accumulated Depreciation', 'asset', 'credit', true, 'accum_depr'),
    (p_property_id, '2000', 'Accounts Payable', 'liability', 'credit', true, 'ap'),
    (p_property_id, '2100', 'Guest Deposits', 'liability', 'credit', true, 'deposits'),
    (p_property_id, '2200', 'GST Output Payable', 'liability', 'credit', true, 'gst_output'),
    (p_property_id, '2300', 'Payroll Payable', 'liability', 'credit', true, 'payroll_payable'),
    (p_property_id, '2310', 'PF Payable', 'liability', 'credit', true, 'pf_payable'),
    (p_property_id, '2320', 'PIT Payable', 'liability', 'credit', true, 'pit_payable'),
    (p_property_id, '3000', 'Owner Equity', 'equity', 'credit', true, 'equity'),
    (p_property_id, '3100', 'Retained Earnings', 'equity', 'credit', true, 'retained_earnings'),
    (p_property_id, '3200', 'Opening Balance Equity', 'equity', 'credit', true, 'opening_equity'),
    (p_property_id, '4000', 'Room Revenue', 'revenue', 'credit', true, 'rev_rooms'),
    (p_property_id, '4100', 'F&B Revenue', 'revenue', 'credit', true, 'rev_fb'),
    (p_property_id, '4200', 'Spa Revenue', 'revenue', 'credit', true, 'rev_spa'),
    (p_property_id, '4300', 'Guest Services Revenue', 'revenue', 'credit', true, 'rev_services'),
    (p_property_id, '4400', 'Other Revenue', 'revenue', 'credit', true, 'rev_other'),
    (p_property_id, '5000', 'Cost of Goods Sold', 'cogs', 'debit', true, 'cogs'),
    (p_property_id, '6000', 'Supplies Expense', 'expense', 'debit', true, 'exp_supplies'),
    (p_property_id, '6100', 'Utilities Expense', 'expense', 'debit', true, 'exp_utilities'),
    (p_property_id, '6200', 'Payroll Expense', 'expense', 'debit', true, 'exp_payroll'),
    (p_property_id, '6300', 'Maintenance Expense', 'expense', 'debit', true, 'exp_maintenance'),
    (p_property_id, '6400', 'Marketing Expense', 'expense', 'debit', true, 'exp_marketing'),
    (p_property_id, '6500', 'Tax Expense', 'expense', 'debit', true, 'exp_tax'),
    (p_property_id, '6600', 'Bank Fees', 'expense', 'debit', true, 'exp_bank_fee'),
    (p_property_id, '6700', 'Depreciation Expense', 'expense', 'debit', true, 'exp_depreciation'),
    (p_property_id, '6900', 'Other Expense', 'expense', 'debit', true, 'exp_other')
  on conflict (property_id, code) do nothing;

  -- Posting rules
  insert into accounting_posting_rules (property_id, event_type, debit_system_key, credit_system_key, department_code)
  values
    (p_property_id, 'folio_line.room', 'ar_guest', 'rev_rooms', 'ROOMS'),
    (p_property_id, 'folio_line.order', 'ar_guest', 'rev_fb', 'FB'),
    (p_property_id, 'folio_line.service', 'ar_guest', 'rev_spa', 'SPA'),
    (p_property_id, 'folio_line.guest_service', 'ar_guest', 'rev_services', 'SVC'),
    (p_property_id, 'folio_line.other', 'ar_guest', 'rev_other', 'ADMIN'),
    (p_property_id, 'payment.cash', 'cash', 'ar_guest', null),
    (p_property_id, 'payment.bank', 'bank', 'ar_guest', null),
    (p_property_id, 'payment.card', 'card_clearing', 'ar_guest', null),
    (p_property_id, 'payment.agent_credit', 'ar_agent', 'ar_guest', null),
    (p_property_id, 'payment.deposit', 'bank', 'deposits', null),
    (p_property_id, 'payment.refund', 'ar_guest', 'bank', null),
    (p_property_id, 'expense.supplies', 'exp_supplies', 'bank', 'ADMIN'),
    (p_property_id, 'expense.utilities', 'exp_utilities', 'bank', 'ADMIN'),
    (p_property_id, 'expense.payroll', 'exp_payroll', 'payroll_payable', 'ADMIN'),
    (p_property_id, 'expense.maintenance', 'exp_maintenance', 'bank', 'ADMIN'),
    (p_property_id, 'expense.marketing', 'exp_marketing', 'bank', 'ADMIN'),
    (p_property_id, 'expense.tax', 'exp_tax', 'bank', 'ADMIN'),
    (p_property_id, 'expense.bank_fee', 'exp_bank_fee', 'bank', 'ADMIN'),
    (p_property_id, 'expense.other', 'exp_other', 'bank', 'ADMIN'),
    (p_property_id, 'inventory.receive', 'inventory', 'ap', null),
    (p_property_id, 'inventory.issue', 'cogs', 'inventory', 'FB'),
    (p_property_id, 'payroll.finalize', 'exp_payroll', 'payroll_payable', 'ADMIN')
  on conflict (property_id, event_type) do nothing;

  -- Fiscal year = calendar year of today
  fy_start := date_trunc('year', current_date)::date;
  fy_end := (fy_start + interval '1 year' - interval '1 day')::date;

  insert into accounting_fiscal_years (property_id, label, starts_on, ends_on)
  values (p_property_id, to_char(fy_start, 'YYYY'), fy_start, fy_end)
  on conflict (property_id, label) do nothing
  returning id into fy_id;

  if fy_id is null then
    select id into fy_id
    from accounting_fiscal_years
    where property_id = p_property_id and label = to_char(fy_start, 'YYYY');
  end if;

  for i in 0..11 loop
    month_start := (fy_start + (i || ' months')::interval)::date;
    insert into accounting_periods (
      property_id, fiscal_year_id, label, period_index, starts_on, ends_on
    ) values (
      p_property_id,
      fy_id,
      to_char(month_start, 'Mon YYYY'),
      i + 1,
      month_start,
      (month_start + interval '1 month' - interval '1 day')::date
    )
    on conflict (property_id, fiscal_year_id, period_index) do nothing;
  end loop;
end;
$$;

-- Seed all existing properties
do $$
declare
  r record;
begin
  for r in select id from properties loop
    perform accounting_seed_property(r.id);
  end loop;
end $$;

-- Auto-seed when a new property is created
create or replace function accounting_seed_on_property_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform accounting_seed_property(new.id);
  return new;
end;
$$;

drop trigger if exists accounting_seed_property_trg on properties;
create trigger accounting_seed_property_trg
  after insert on properties
  for each row execute function accounting_seed_on_property_insert();
