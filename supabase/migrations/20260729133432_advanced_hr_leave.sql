-- Effective-dated Bhutan leave policies, balances and approval workflow.
-- Statutory defaults source:
-- Regulation on Working Conditions 2022, Chapter 10 (Sections 178-220)
-- https://www.moice.gov.bt/wp-content/uploads/2022/06/Regulation-on-Working-Conditions-2022.pdf

create table if not exists hr_leave_policies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  effective_from date not null,
  effective_to date,
  unit text not null default 'working_day'
    check (unit in ('working_day', 'calendar_day')),
  accrual_frequency text not null
    check (accrual_frequency in ('monthly', 'annual', 'event', 'none')),
  accrual_days numeric(8, 3) not null default 0 check (accrual_days >= 0),
  minimum_service_months integer not null default 0
    check (minimum_service_months >= 0),
  starts_after_probation boolean not null default false,
  allow_half_day boolean not null default false,
  paid_rate numeric(5, 4) not null default 1
    check (paid_rate between 0 and 1),
  notice_days integer not null default 0 check (notice_days >= 0),
  evidence_after_days numeric(6, 2),
  carry_forward_years integer check (carry_forward_years is null or carry_forward_years >= 0),
  merge_unused_into_code text,
  encashable boolean not null default false,
  lifetime_occurrence_limit integer
    check (lifetime_occurrence_limit is null or lifetime_occurrence_limit > 0),
  is_active boolean not null default true,
  source_name text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_leave_policy_dates check (
    effective_to is null or effective_to >= effective_from
  ),
  unique (property_id, code, effective_from)
);

create index if not exists hr_leave_policies_active_idx
  on hr_leave_policies (property_id, code, effective_from desc)
  where is_active;

create table if not exists hr_holidays (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  is_paid boolean not null default true,
  source_url text,
  created_at timestamptz not null default now(),
  unique (property_id, holiday_date)
);

create index if not exists hr_holidays_date_idx
  on hr_holidays (property_id, holiday_date);

create table if not exists hr_leave_blackouts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  department text,
  leave_policy_id uuid references hr_leave_policies(id) on delete cascade,
  reason text not null,
  is_hard_block boolean not null default false,
  created_at timestamptz not null default now(),
  constraint hr_leave_blackout_dates check (ends_on >= starts_on)
);

create index if not exists hr_leave_blackouts_lookup_idx
  on hr_leave_blackouts (property_id, starts_on, ends_on);
create index if not exists hr_leave_blackouts_policy_fk_idx
  on hr_leave_blackouts (leave_policy_id)
  where leave_policy_id is not null;

alter table staff_leave
  drop constraint if exists staff_leave_leave_type_check;
alter table staff_leave
  add constraint staff_leave_leave_type_check
  check (leave_type in (
    'annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid', 'other'
  ));

alter table staff_leave
  add column if not exists leave_policy_id uuid
    references hr_leave_policies(id) on delete restrict,
  add column if not exists requested_days numeric(7, 2)
    check (requested_days is null or requested_days > 0),
  add column if not exists start_period text not null default 'full'
    check (start_period in ('full', 'am', 'pm')),
  add column if not exists end_period text not null default 'full'
    check (end_period in ('full', 'am', 'pm')),
  add column if not exists approval_stage text not null default 'supervisor_review'
    check (approval_stage in ('supervisor_review', 'hr_review', 'completed')),
  add column if not exists supervisor_decision text
    check (supervisor_decision is null or supervisor_decision in ('approved', 'denied')),
  add column if not exists supervisor_reviewed_at timestamptz,
  add column if not exists supervisor_reviewed_by_staff_id uuid
    references staff_members(id) on delete set null,
  add column if not exists supervisor_notes text,
  add column if not exists coverage_warnings jsonb not null default '[]'::jsonb,
  add column if not exists payroll_impact text not null default 'paid'
    check (payroll_impact in ('paid', 'unpaid', 'partial')),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

create index if not exists staff_leave_policy_fk_idx
  on staff_leave (leave_policy_id)
  where leave_policy_id is not null;
create index if not exists staff_leave_supervisor_reviewer_fk_idx
  on staff_leave (supervisor_reviewed_by_staff_id)
  where supervisor_reviewed_by_staff_id is not null;
create index if not exists staff_leave_stage_idx
  on staff_leave (property_id, approval_stage, starts_on)
  where status = 'requested';
create index if not exists staff_leave_overlap_idx
  on staff_leave (property_id, staff_id, starts_on, ends_on)
  where status in ('requested', 'approved');

create table if not exists hr_leave_attachments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  leave_id uuid not null references staff_leave(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists hr_leave_attachments_leave_idx
  on hr_leave_attachments (leave_id, created_at);
create index if not exists hr_leave_attachments_staff_fk_idx
  on hr_leave_attachments (staff_id);
create index if not exists hr_leave_attachments_property_fk_idx
  on hr_leave_attachments (property_id);

create table if not exists hr_leave_ledger (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete restrict,
  leave_policy_id uuid not null references hr_leave_policies(id) on delete restrict,
  leave_id uuid references staff_leave(id) on delete restrict,
  transaction_date date not null,
  transaction_kind text not null
    check (transaction_kind in (
      'opening', 'accrual', 'taken', 'reversal', 'adjustment',
      'encashment', 'expiry', 'merge'
    )),
  days numeric(8, 3) not null check (days <> 0),
  idempotency_key text not null,
  notes text,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  unique (property_id, idempotency_key)
);

create index if not exists hr_leave_ledger_staff_idx
  on hr_leave_ledger (property_id, staff_id, leave_policy_id, transaction_date);
create index if not exists hr_leave_ledger_policy_fk_idx
  on hr_leave_ledger (leave_policy_id);
create index if not exists hr_leave_ledger_leave_fk_idx
  on hr_leave_ledger (leave_id)
  where leave_id is not null;

create table if not exists hr_leave_balances (
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete restrict,
  leave_policy_id uuid not null references hr_leave_policies(id) on delete restrict,
  balance_days numeric(9, 3) not null default 0,
  last_transaction_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (staff_id, leave_policy_id)
);

create index if not exists hr_leave_balances_property_idx
  on hr_leave_balances (property_id, staff_id);
create index if not exists hr_leave_balances_policy_fk_idx
  on hr_leave_balances (leave_policy_id);

create or replace function private.update_leave_balance_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hr_leave_balances (
    property_id,
    staff_id,
    leave_policy_id,
    balance_days,
    last_transaction_at,
    updated_at
  )
  values (
    new.property_id,
    new.staff_id,
    new.leave_policy_id,
    new.days,
    new.created_at,
    now()
  )
  on conflict (staff_id, leave_policy_id)
  do update set
    balance_days = public.hr_leave_balances.balance_days + excluded.balance_days,
    last_transaction_at = excluded.last_transaction_at,
    updated_at = now();
  return new;
end;
$$;

revoke all on function private.update_leave_balance_from_ledger()
  from public, anon, authenticated;

drop trigger if exists hr_leave_ledger_update_balance on hr_leave_ledger;
create trigger hr_leave_ledger_update_balance
after insert on hr_leave_ledger
for each row execute function private.update_leave_balance_from_ledger();

alter table hr_leave_policies enable row level security;
alter table hr_holidays enable row level security;
alter table hr_leave_blackouts enable row level security;
alter table hr_leave_attachments enable row level security;
alter table hr_leave_ledger enable row level security;
alter table hr_leave_balances enable row level security;

drop policy if exists "service_role full hr_leave_policies" on hr_leave_policies;
create policy "service_role full hr_leave_policies" on hr_leave_policies
  for all to service_role using (true) with check (true);
drop policy if exists "staff read property leave policies" on hr_leave_policies;
create policy "staff read property leave policies" on hr_leave_policies
  for select to authenticated
  using (property_id = (select private.current_staff_property_id()));

drop policy if exists "service_role full hr_holidays" on hr_holidays;
create policy "service_role full hr_holidays" on hr_holidays
  for all to service_role using (true) with check (true);
drop policy if exists "staff read property holidays" on hr_holidays;
create policy "staff read property holidays" on hr_holidays
  for select to authenticated
  using (property_id = (select private.current_staff_property_id()));

drop policy if exists "service_role full hr_leave_blackouts" on hr_leave_blackouts;
create policy "service_role full hr_leave_blackouts" on hr_leave_blackouts
  for all to service_role using (true) with check (true);
drop policy if exists "staff read property leave blackouts" on hr_leave_blackouts;
create policy "staff read property leave blackouts" on hr_leave_blackouts
  for select to authenticated
  using (property_id = (select private.current_staff_property_id()));

drop policy if exists "service_role full hr_leave_attachments" on hr_leave_attachments;
create policy "service_role full hr_leave_attachments" on hr_leave_attachments
  for all to service_role using (true) with check (true);
drop policy if exists "staff read own leave attachments" on hr_leave_attachments;
create policy "staff read own leave attachments" on hr_leave_attachments
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in
        ('supervisor', 'hr_admin', 'payroll_admin', 'owner')
    )
  );

drop policy if exists "service_role full hr_leave_ledger" on hr_leave_ledger;
create policy "service_role full hr_leave_ledger" on hr_leave_ledger
  for all to service_role using (true) with check (true);
drop policy if exists "staff read own leave ledger" on hr_leave_ledger;
create policy "staff read own leave ledger" on hr_leave_ledger
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in
        ('supervisor', 'hr_admin', 'payroll_admin', 'owner')
    )
  );

drop policy if exists "service_role full hr_leave_balances" on hr_leave_balances;
create policy "service_role full hr_leave_balances" on hr_leave_balances
  for all to service_role using (true) with check (true);
drop policy if exists "staff read own leave balances" on hr_leave_balances;
create policy "staff read own leave balances" on hr_leave_balances
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in
        ('supervisor', 'hr_admin', 'payroll_admin', 'owner')
    )
  );

revoke insert, update, delete on
  hr_leave_policies,
  hr_holidays,
  hr_leave_blackouts,
  hr_leave_attachments,
  hr_leave_ledger,
  hr_leave_balances
from authenticated;
grant select on
  hr_leave_policies,
  hr_holidays,
  hr_leave_blackouts,
  hr_leave_attachments,
  hr_leave_ledger,
  hr_leave_balances
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hr-private',
  'hr-private',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Versioned statutory minimums. Hotels may add more advantageous policies.
insert into hr_leave_policies (
  property_id, code, name, description, effective_from, unit,
  accrual_frequency, accrual_days, minimum_service_months,
  starts_after_probation, allow_half_day, paid_rate, notice_days,
  evidence_after_days, carry_forward_years, merge_unused_into_code,
  encashable, lifetime_occurrence_limit, source_name, source_url
)
select
  p.id,
  seed.code,
  seed.name,
  seed.description,
  date '2022-01-01',
  seed.unit,
  seed.accrual_frequency,
  seed.accrual_days,
  seed.minimum_service_months,
  seed.starts_after_probation,
  seed.allow_half_day,
  seed.paid_rate,
  seed.notice_days,
  seed.evidence_after_days,
  seed.carry_forward_years,
  seed.merge_unused_into_code,
  seed.encashable,
  seed.lifetime_occurrence_limit,
  'Bhutan Regulation on Working Conditions 2022',
  'https://www.moice.gov.bt/wp-content/uploads/2022/06/Regulation-on-Working-Conditions-2022.pdf'
from properties p
cross join (
  values
    (
      'annual', 'Annual leave',
      'Minimum 1.5 working days per month after probation.',
      'working_day', 'monthly', 1.5::numeric, 0, true, false,
      1::numeric, 14, null::numeric, null::integer, null::text,
      true, null::integer
    ),
    (
      'sick', 'Sick leave',
      'Minimum 5 working days per year; may be taken for part of a day.',
      'working_day', 'annual', 5::numeric, 0, false, true,
      1::numeric, 0, 1::numeric, 5, null::text,
      false, null::integer
    ),
    (
      'casual', 'Casual leave',
      'Minimum 5 working days per year after probation; unused leave merges into annual.',
      'working_day', 'annual', 5::numeric, 0, true, true,
      1::numeric, 0, null::numeric, 0, 'annual',
      false, null::integer
    ),
    (
      'maternity', 'Maternity leave',
      'Minimum 2 months paid leave after 12 months continuous employment.',
      'calendar_day', 'event', 60::numeric, 12, false, false,
      1::numeric, 60, 0::numeric, null::integer, null::text,
      false, 3
    ),
    (
      'paternity', 'Paternity leave',
      'Minimum 10 working days after 12 months continuous employment.',
      'working_day', 'event', 10::numeric, 12, false, false,
      1::numeric, 0, null::numeric, null::integer, null::text,
      false, 3
    ),
    (
      'unpaid', 'Unpaid leave',
      'Discretionary unpaid leave subject to employer approval.',
      'calendar_day', 'none', 0::numeric, 0, false, true,
      0::numeric, 0, null::numeric, null::integer, null::text,
      false, null::integer
    )
) as seed (
  code, name, description, unit, accrual_frequency, accrual_days,
  minimum_service_months, starts_after_probation, allow_half_day,
  paid_rate, notice_days, evidence_after_days, carry_forward_years,
  merge_unused_into_code, encashable, lifetime_occurrence_limit
)
on conflict (property_id, code, effective_from) do nothing;

do $$
begin
  alter publication supabase_realtime add table hr_leave_balances;
exception
  when duplicate_object then null;
end
$$;
