-- Hotel OS v2 additive schema (safe for Innora v1 — no drops/renames of money tables)

-- Idempotency (shared with sync replay)
create table if not exists public.idempotency_keys (
  property_id uuid not null references public.properties(id) on delete cascade,
  idempotency_key text not null,
  operation text not null,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (property_id, idempotency_key)
);

alter table public.idempotency_keys enable row level security;
drop policy if exists "service_role full idempotency_keys" on public.idempotency_keys;
create policy "service_role full idempotency_keys" on public.idempotency_keys
  for all to service_role using (true) with check (true);

-- Cash till shifts
create table if not exists public.cash_till_shifts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'open'
    check (status = any (array['open'::text, 'closed'::text])),
  opening_balance_btn numeric(14,2) not null default 0,
  collected_cash_btn numeric(14,2) not null default 0,
  petty_cash_outflow_btn numeric(14,2) not null default 0,
  opened_by_staff_id uuid references public.staff_members(id) on delete set null,
  opened_by_name text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by_staff_id uuid references public.staff_members(id) on delete set null,
  notes text
);

create index if not exists cash_till_shifts_property_open_idx
  on public.cash_till_shifts (property_id, status, opened_at desc);

alter table public.cash_till_shifts enable row level security;
drop policy if exists "service_role full cash_till_shifts" on public.cash_till_shifts;
create policy "service_role full cash_till_shifts" on public.cash_till_shifts
  for all to service_role using (true) with check (true);

-- Property expenses (Cash Drawer Sync Law)
create table if not exists public.property_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category text not null,
  description text not null,
  amount_btn numeric(14,2) not null check (amount_btn >= 0),
  paid_via text not null
    check (paid_via = any (array[
      'front_till'::text,
      'mbob_wire'::text,
      'cheque'::text,
      'credit_unpaid'::text
    ])),
  supplier_name text,
  recorded_by_staff_id uuid references public.staff_members(id) on delete set null,
  recorded_at timestamptz not null default now(),
  till_shift_id uuid references public.cash_till_shifts(id) on delete set null,
  idempotency_key text,
  unique (property_id, idempotency_key)
);

create index if not exists property_expenses_property_recorded_idx
  on public.property_expenses (property_id, recorded_at desc);

alter table public.property_expenses enable row level security;
drop policy if exists "service_role full property_expenses" on public.property_expenses;
create policy "service_role full property_expenses" on public.property_expenses
  for all to service_role using (true) with check (true);

create or replace function public.record_expense_and_till_deduct(
  p_property_id uuid,
  p_staff_id uuid,
  p_category text,
  p_description text,
  p_amount_btn numeric,
  p_paid_via text,
  p_supplier_name text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.property_expenses%rowtype;
  v_shift public.cash_till_shifts%rowtype;
  v_expense public.property_expenses%rowtype;
  v_staff_name text;
begin
  if p_amount_btn is null or p_amount_btn < 0 then
    raise exception 'amount must be >= 0';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
    from public.property_expenses
    where property_id = p_property_id
      and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'expense_id', v_existing.id, 'replayed', true);
    end if;
  end if;

  select full_name into v_staff_name from public.staff_members where id = p_staff_id;

  select * into v_shift
  from public.cash_till_shifts
  where property_id = p_property_id and status = 'open'
  order by opened_at desc
  limit 1
  for update;

  if not found then
    insert into public.cash_till_shifts (
      property_id, status, opening_balance_btn, opened_by_staff_id, opened_by_name
    ) values (
      p_property_id, 'open', 0, p_staff_id, coalesce(v_staff_name, 'desk')
    )
    returning * into v_shift;
  end if;

  insert into public.property_expenses (
    property_id, category, description, amount_btn, paid_via, supplier_name,
    recorded_by_staff_id, till_shift_id, idempotency_key
  ) values (
    p_property_id, p_category, p_description, p_amount_btn, p_paid_via, p_supplier_name,
    p_staff_id, v_shift.id, p_idempotency_key
  )
  returning * into v_expense;

  if p_paid_via = 'front_till' then
    update public.cash_till_shifts
    set petty_cash_outflow_btn = petty_cash_outflow_btn + p_amount_btn
    where id = v_shift.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'expense_id', v_expense.id,
    'till_shift_id', v_shift.id,
    'replayed', false
  );
end;
$$;

revoke all on function public.record_expense_and_till_deduct(uuid, uuid, text, text, numeric, text, text, text) from public;
grant execute on function public.record_expense_and_till_deduct(uuid, uuid, text, text, numeric, text, text, text) to service_role;

-- SaaS license / SuperAdmin
create table if not exists public.saas_tenant_licenses (
  property_id uuid primary key references public.properties(id) on delete cascade,
  tier text not null default 'boutique'
    check (tier = any (array['boutique'::text, 'professional'::text, 'resort'::text])),
  status text not null default 'active'
    check (status = any (array[
      'active'::text,
      'grace'::text,
      'soft_lock'::text,
      'hard_lock'::text
    ])),
  mrr_btn numeric(12,2) not null default 3500,
  paid_through date,
  grace_until date,
  last_payment_at timestamptz,
  last_payment_channel text,
  updated_at timestamptz not null default now()
);

alter table public.saas_tenant_licenses enable row level security;
drop policy if exists "service_role full saas_tenant_licenses" on public.saas_tenant_licenses;
create policy "service_role full saas_tenant_licenses" on public.saas_tenant_licenses
  for all to service_role using (true) with check (true);

create table if not exists public.saas_bypass_tokens (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  token_code text not null unique,
  created_by text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.saas_bypass_tokens enable row level security;
drop policy if exists "service_role full saas_bypass_tokens" on public.saas_bypass_tokens;
create policy "service_role full saas_bypass_tokens" on public.saas_bypass_tokens
  for all to service_role using (true) with check (true);

-- National marketplace commission ledger
create table if not exists public.marketplace_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  market text not null check (market = any (array['local'::text, 'international'::text])),
  gross_btn numeric(14,2) not null,
  commission_rate numeric(6,4) not null,
  commission_btn numeric(14,2) not null,
  currency text not null default 'BTN',
  created_at timestamptz not null default now()
);

create index if not exists marketplace_commission_property_idx
  on public.marketplace_commission_ledger (property_id, created_at desc);

alter table public.marketplace_commission_ledger enable row level security;
drop policy if exists "service_role full marketplace_commission_ledger" on public.marketplace_commission_ledger;
create policy "service_role full marketplace_commission_ledger" on public.marketplace_commission_ledger
  for all to service_role using (true) with check (true);

-- Fleet registry (Master Registry)
create table if not exists public.property_fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  plate_number text not null,
  vehicle_type text not null default 'hiace',
  driver_name text,
  driver_mobile text,
  dorm_room_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, plate_number)
);

alter table public.property_fleet_vehicles enable row level security;
drop policy if exists "service_role full property_fleet_vehicles" on public.property_fleet_vehicles;
create policy "service_role full property_fleet_vehicles" on public.property_fleet_vehicles
  for all to service_role using (true) with check (true);

-- FX rates (RMA sync target)
create table if not exists public.rma_fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null default 'BTN',
  quote_currency text not null,
  rate numeric(18,8) not null,
  as_of date not null default (timezone('Asia/Thimphu', now()))::date,
  source text not null default 'rma',
  unique (base_currency, quote_currency, as_of)
);

alter table public.rma_fx_rates enable row level security;
drop policy if exists "service_role full rma_fx_rates" on public.rma_fx_rates;
create policy "service_role full rma_fx_rates" on public.rma_fx_rates
  for all to service_role using (true) with check (true);
