-- Advanced HR — versioned Bhutan payroll engine and immutable runs.
-- Rule sets are effective-dated; runs snapshot the rule set + per-staff inputs
-- so a finalized run is fully reproducible and immutable.

-- ---------------------------------------------------------------------------
-- Rule sets (effective-dated, versioned)
-- ---------------------------------------------------------------------------
create table if not exists payroll_rule_sets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  effective_from date not null,
  effective_to date,
  currency text not null default 'BTN',
  -- Provident fund (NPPF): 5% employee + 5% employer on basic wage.
  pf_employee_rate numeric(6,4) not null default 0.0500 check (pf_employee_rate >= 0 and pf_employee_rate <= 1),
  pf_employer_rate numeric(6,4) not null default 0.0500 check (pf_employer_rate >= 0 and pf_employer_rate <= 1),
  -- Premiums (Regulation on Working Conditions): overtime paid at 1.5x,
  -- public-holiday work carries a +50% premium over the salaried rate.
  overtime_multiplier numeric(6,4) not null default 1.5000 check (overtime_multiplier >= 1),
  public_holiday_premium_rate numeric(6,4) not null default 0.5000 check (public_holiday_premium_rate >= 0),
  night_premium_rate numeric(6,4) not null default 0.0000 check (night_premium_rate >= 0),
  standard_monthly_hours numeric(8,2) not null default 208 check (standard_monthly_hours > 0),
  standard_working_days numeric(6,2) not null default 26 check (standard_working_days > 0),
  -- Personal income tax (Income Tax Act of Bhutan 2025).
  pit_brackets jsonb not null default '[
    {"upTo": 300000, "rate": 0},
    {"upTo": 400000, "rate": 0.10},
    {"upTo": 650000, "rate": 0.15},
    {"upTo": 1000000, "rate": 0.20},
    {"upTo": 1500000, "rate": 0.25},
    {"upTo": null, "rate": 0.30}
  ]'::jsonb,
  pit_surcharge_threshold numeric(14,2) not null default 1000000,
  pit_surcharge_rate numeric(6,4) not null default 0.1000,
  annualization_factor numeric(6,2) not null default 12,
  notes text,
  source text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payroll_rule_sets_property_idx
  on payroll_rule_sets (property_id, effective_from desc);

create index if not exists payroll_rule_sets_active_idx
  on payroll_rule_sets (property_id, is_active, effective_from desc);

-- ---------------------------------------------------------------------------
-- Payroll periods
-- ---------------------------------------------------------------------------
create table if not exists payroll_periods (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  label text not null,
  period_start date not null,
  period_end date not null,
  pay_date date,
  status text not null default 'open'
    check (status = any (array['open'::text, 'locked'::text, 'closed'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (property_id, period_start, period_end)
);

create index if not exists payroll_periods_property_idx
  on payroll_periods (property_id, period_start desc);

-- ---------------------------------------------------------------------------
-- Payroll runs (immutable once finalized)
-- ---------------------------------------------------------------------------
create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_id uuid not null references payroll_periods(id) on delete cascade,
  rule_set_id uuid references payroll_rule_sets(id) on delete set null,
  sequence int not null default 1,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'calculated'::text,
      'approved'::text,
      'finalized'::text,
      'cancelled'::text
    ])),
  -- Immutable snapshot of the rule set used for this run.
  rule_snapshot jsonb,
  headcount int not null default 0,
  gross_total_btn numeric(14,2) not null default 0,
  deduction_total_btn numeric(14,2) not null default 0,
  employee_pf_total_btn numeric(14,2) not null default 0,
  employer_pf_total_btn numeric(14,2) not null default 0,
  pit_total_btn numeric(14,2) not null default 0,
  net_total_btn numeric(14,2) not null default 0,
  employer_cost_total_btn numeric(14,2) not null default 0,
  calculated_at timestamptz,
  calculated_by text,
  approved_at timestamptz,
  approved_by text,
  finalized_at timestamptz,
  finalized_by text,
  finance_expense_id uuid references expenses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, sequence)
);

create index if not exists payroll_runs_property_idx
  on payroll_runs (property_id, status, created_at desc);

create index if not exists payroll_runs_period_idx
  on payroll_runs (period_id, status);

create index if not exists payroll_runs_rule_set_idx
  on payroll_runs (rule_set_id);

create index if not exists payroll_runs_finance_expense_idx
  on payroll_runs (finance_expense_id);

-- ---------------------------------------------------------------------------
-- Payroll run items (one per staff member per run)
-- ---------------------------------------------------------------------------
create table if not exists payroll_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete restrict,
  -- Snapshot of identity + pay basis at calculation time.
  employee_code text,
  full_name text,
  department text,
  position_title text,
  bank_name text,
  bank_account_number text,
  provident_fund_number text,
  tax_identifier text,
  basic_wage_btn numeric(12,2) not null default 0,
  -- Inputs captured for reproducibility.
  inputs jsonb not null default '{}'::jsonb,
  -- Computed line breakdown (earnings / deductions / employer costs).
  lines jsonb not null default '[]'::jsonb,
  gross_btn numeric(12,2) not null default 0,
  taxable_btn numeric(12,2) not null default 0,
  employee_pf_btn numeric(12,2) not null default 0,
  employer_pf_btn numeric(12,2) not null default 0,
  pit_btn numeric(12,2) not null default 0,
  other_deductions_btn numeric(12,2) not null default 0,
  net_btn numeric(12,2) not null default 0,
  employer_cost_btn numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid'
    check (payment_status = any (array['unpaid'::text, 'paid'::text, 'held'::text])),
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, staff_id)
);

create index if not exists payroll_run_items_run_idx
  on payroll_run_items (run_id);

create index if not exists payroll_run_items_property_idx
  on payroll_run_items (property_id);

create index if not exists payroll_run_items_staff_idx
  on payroll_run_items (staff_id, created_at desc);

-- ---------------------------------------------------------------------------
-- One-off adjustments applied to a period (bonuses, advances, corrections)
-- ---------------------------------------------------------------------------
create table if not exists payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_id uuid not null references payroll_periods(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  kind text not null
    check (kind = any (array[
      'earning'::text,
      'deduction'::text,
      'advance_repayment'::text
    ])),
  code text not null,
  label text not null,
  amount_btn numeric(12,2) not null check (amount_btn >= 0),
  taxable boolean not null default true,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists payroll_adjustments_period_idx
  on payroll_adjustments (period_id, staff_id);

create index if not exists payroll_adjustments_property_idx
  on payroll_adjustments (property_id);

create index if not exists payroll_adjustments_staff_idx
  on payroll_adjustments (staff_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuse shared helper if present)
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payroll_rule_sets_touch on payroll_rule_sets;
create trigger payroll_rule_sets_touch
  before update on payroll_rule_sets
  for each row execute function set_updated_at();

drop trigger if exists payroll_periods_touch on payroll_periods;
create trigger payroll_periods_touch
  before update on payroll_periods
  for each row execute function set_updated_at();

drop trigger if exists payroll_runs_touch on payroll_runs;
create trigger payroll_runs_touch
  before update on payroll_runs
  for each row execute function set_updated_at();

drop trigger if exists payroll_run_items_touch on payroll_run_items;
create trigger payroll_run_items_touch
  before update on payroll_run_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutability guard: finalized runs and their items cannot be mutated
-- (except marking payment status / references on items).
-- ---------------------------------------------------------------------------
create or replace function payroll_guard_finalized_run()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'finalized' then
      raise exception 'Finalized payroll runs are immutable and cannot be deleted.';
    end if;
    return old;
  end if;
  if old.status = 'finalized' and new.status = 'finalized' then
    -- Allow only benign metadata (notes, payment linkage) to change.
    if new.gross_total_btn is distinct from old.gross_total_btn
      or new.net_total_btn is distinct from old.net_total_btn
      or new.pit_total_btn is distinct from old.pit_total_btn
      or new.employee_pf_total_btn is distinct from old.employee_pf_total_btn
      or new.employer_pf_total_btn is distinct from old.employer_pf_total_btn
      or new.rule_snapshot is distinct from old.rule_snapshot
      or new.headcount is distinct from old.headcount then
      raise exception 'Finalized payroll run totals are immutable.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payroll_runs_guard on payroll_runs;
create trigger payroll_runs_guard
  before update or delete on payroll_runs
  for each row execute function payroll_guard_finalized_run();

create or replace function payroll_guard_finalized_item()
returns trigger
language plpgsql
as $$
declare
  run_status text;
begin
  select status into run_status
  from payroll_runs
  where id = coalesce(new.run_id, old.run_id);

  if run_status = 'finalized' then
    if tg_op = 'DELETE' then
      raise exception 'Cannot delete items from a finalized payroll run.';
    end if;
    if new.gross_btn is distinct from old.gross_btn
      or new.net_btn is distinct from old.net_btn
      or new.pit_btn is distinct from old.pit_btn
      or new.employee_pf_btn is distinct from old.employee_pf_btn
      or new.employer_pf_btn is distinct from old.employer_pf_btn
      or new.lines is distinct from old.lines
      or new.inputs is distinct from old.inputs then
      raise exception 'Finalized payslip amounts are immutable.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists payroll_run_items_guard on payroll_run_items;
create trigger payroll_run_items_guard
  before update or delete on payroll_run_items
  for each row execute function payroll_guard_finalized_item();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table payroll_rule_sets enable row level security;
alter table payroll_periods enable row level security;
alter table payroll_runs enable row level security;
alter table payroll_run_items enable row level security;
alter table payroll_adjustments enable row level security;

drop policy if exists "service_role full payroll_rule_sets" on payroll_rule_sets;
create policy "service_role full payroll_rule_sets" on payroll_rule_sets
  for all to service_role using (true) with check (true);

drop policy if exists "payroll admin read rule sets" on payroll_rule_sets;
create policy "payroll admin read rule sets" on payroll_rule_sets
  for select to authenticated
  using (
    property_id = (select private.current_staff_property_id())
    and (select private.current_staff_access_level()) in ('payroll_admin', 'owner')
  );

drop policy if exists "service_role full payroll_periods" on payroll_periods;
create policy "service_role full payroll_periods" on payroll_periods
  for all to service_role using (true) with check (true);

drop policy if exists "payroll admin read periods" on payroll_periods;
create policy "payroll admin read periods" on payroll_periods
  for select to authenticated
  using (
    property_id = (select private.current_staff_property_id())
    and (select private.current_staff_access_level()) in ('payroll_admin', 'owner')
  );

drop policy if exists "service_role full payroll_runs" on payroll_runs;
create policy "service_role full payroll_runs" on payroll_runs
  for all to service_role using (true) with check (true);

drop policy if exists "payroll admin read runs" on payroll_runs;
create policy "payroll admin read runs" on payroll_runs
  for select to authenticated
  using (
    property_id = (select private.current_staff_property_id())
    and (select private.current_staff_access_level()) in ('payroll_admin', 'owner')
  );

drop policy if exists "service_role full payroll_run_items" on payroll_run_items;
create policy "service_role full payroll_run_items" on payroll_run_items
  for all to service_role using (true) with check (true);

-- Employees can read their own finalized payslips; payroll admins read all.
drop policy if exists "employee read own payslips" on payroll_run_items;
create policy "employee read own payslips" on payroll_run_items
  for select to authenticated
  using (
    (
      staff_id = (select private.current_staff_id())
      and exists (
        select 1 from payroll_runs r
        where r.id = payroll_run_items.run_id
          and r.status in ('finalized')
      )
    )
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in ('payroll_admin', 'owner')
    )
  );

drop policy if exists "service_role full payroll_adjustments" on payroll_adjustments;
create policy "service_role full payroll_adjustments" on payroll_adjustments
  for all to service_role using (true) with check (true);

drop policy if exists "payroll admin read adjustments" on payroll_adjustments;
create policy "payroll admin read adjustments" on payroll_adjustments
  for select to authenticated
  using (
    property_id = (select private.current_staff_property_id())
    and (select private.current_staff_access_level()) in ('payroll_admin', 'owner')
  );

-- ---------------------------------------------------------------------------
-- Seed a default rule set per property that has staff (idempotent).
-- ---------------------------------------------------------------------------
insert into payroll_rule_sets (property_id, name, effective_from, source, notes)
select distinct sm.property_id,
       'Bhutan statutory (NPPF 5% + PIT 2025)',
       date '2026-01-01',
       'Income Tax Act of Bhutan 2025; NPPF Plan; Regulation on Working Conditions 2022',
       'Auto-seeded default. Adjust allowances and premiums per property policy.'
from staff_members sm
where not exists (
  select 1 from payroll_rule_sets rs where rs.property_id = sm.property_id
);
