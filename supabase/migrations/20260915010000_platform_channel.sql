-- Hotel OS platform channel: distributors, packages, AMC, royalty, leads, tickets, audit.
-- Apply to hotelos database only (schema-only SaaS; do not restore pelbu-full dump here).

-- ---------------------------------------------------------------------------
-- Distributors (partner offices)
-- ---------------------------------------------------------------------------
create table if not exists distributors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  status text not null default 'active'
    check (status = any (array['active'::text, 'suspended'::text])),
  suspended_at timestamptz,
  suspend_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists distributors_slug_uidx
  on distributors (lower(slug));

create table if not exists distributor_members (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'ops'
    check (role = any (array['owner'::text, 'ops'::text])),
  created_at timestamptz not null default now(),
  unique (distributor_id, user_id)
);

create index if not exists distributor_members_user_idx
  on distributor_members (user_id);

-- ---------------------------------------------------------------------------
-- Platform admins (Fame Digital)
-- ---------------------------------------------------------------------------
create table if not exists platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  role text not null default 'ops'
    check (role = any (array['owner'::text, 'ops'::text])),
  created_at timestamptz not null default now()
);

create unique index if not exists platform_admins_email_uidx
  on platform_admins (lower(email));

-- ---------------------------------------------------------------------------
-- Catalog packages
-- ---------------------------------------------------------------------------
create table if not exists catalog_packages (
  code text primary key,
  name text not null,
  room_min integer not null default 1,
  room_max integer,
  msrp_btn_mo numeric(12,2) not null,
  msrp_btn_year numeric(12,2) not null,
  royalty_btn_mo numeric(12,2) not null,
  billing_cycle text not null default 'monthly'
    check (billing_cycle = any (array['monthly'::text, 'annual'::text])),
  feature_flags jsonb not null default '{}'::jsonb,
  includes text[] not null default '{}',
  not_included text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into catalog_packages (
  code, name, room_min, room_max, msrp_btn_mo, msrp_btn_year, royalty_btn_mo, feature_flags, includes, not_included
) values
(
  'classic', 'Classic', 1, 15, 3500, 35000, 1200,
  '{"channel":false,"pos":false,"finance":false,"payroll":false,"multiProperty":false}'::jsonb,
  array['FO reservations','Check-in/out & folios','Housekeeping','Night audit','Basic reports','Fair-use ticket support'],
  array['Channel manager','24x7 WhatsApp','Guest website','Unlimited consulting']
),
(
  'plus', 'Plus', 16, 40, 5500, 55000, 1800,
  '{"channel":false,"pos":true,"finance":true,"payroll":false,"multiProperty":false}'::jsonb,
  array['Everything in Classic','POS / F&B light','Finance light'],
  array['Channel manager','Unlimited consulting']
),
(
  'pro', 'Pro', 41, 80, 8500, 85000, 2500,
  '{"channel":true,"pos":true,"finance":true,"payroll":false,"multiProperty":false}'::jsonb,
  array['Everything in Plus','Channel manager'],
  array['Custom development']
),
(
  'portfolio', 'Portfolio', 1, null, 3000, 30000, 1000,
  '{"channel":false,"pos":true,"finance":true,"payroll":false,"multiProperty":true}'::jsonb,
  array['Per-property desk','Owner multi-property switcher'],
  array['Consolidated P&L (later)']
),
(
  'chain', 'Chain', 81, null, 12000, 120000, 3000,
  '{"channel":true,"pos":true,"finance":true,"payroll":true,"multiProperty":true}'::jsonb,
  array['Custom quote from floor','Multi-property brand'],
  array['Unlimited free customisation']
)
on conflict (code) do update set
  name = excluded.name,
  msrp_btn_mo = excluded.msrp_btn_mo,
  msrp_btn_year = excluded.msrp_btn_year,
  royalty_btn_mo = excluded.royalty_btn_mo,
  feature_flags = excluded.feature_flags;

-- ---------------------------------------------------------------------------
-- Extend tenants (owner org)
-- ---------------------------------------------------------------------------
alter table tenants
  add column if not exists distributor_id uuid references distributors (id) on delete set null,
  add column if not exists package_code text references catalog_packages (code),
  add column if not exists amc_amount_btn numeric(12,2),
  add column if not exists amc_currency text not null default 'BTN',
  add column if not exists amc_renews_on date,
  add column if not exists amc_cycle text default 'monthly'
    check (amc_cycle is null or amc_cycle = any (array['monthly'::text, 'annual'::text, 'quarterly'::text])),
  add column if not exists trial_ends_on date,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspend_reason text,
  add column if not exists conditions_version text,
  add column if not exists conditions_accepted_at timestamptz,
  add column if not exists authorized_contacts jsonb not null default '[]'::jsonb,
  add column if not exists support_restricted boolean not null default false,
  add column if not exists support_hours_used_mo numeric(8,2) not null default 0,
  add column if not exists support_hours_month text,
  add column if not exists onboarding_fee_btn numeric(12,2),
  add column if not exists training_fee_btn numeric(12,2),
  add column if not exists onboarding_paid_at timestamptz,
  add column if not exists training_paid_at timestamptz,
  add column if not exists owner_kind text default 'independent'
    check (owner_kind is null or owner_kind = any (array['independent'::text, 'chain'::text, 'leased'::text]));

create index if not exists tenants_distributor_id_idx
  on tenants (distributor_id)
  where distributor_id is not null;

-- ---------------------------------------------------------------------------
-- Properties: commercial + go-live
-- ---------------------------------------------------------------------------
alter table properties
  add column if not exists distributor_id uuid references distributors (id) on delete set null,
  add column if not exists package_code text references catalog_packages (code),
  add column if not exists is_demo boolean not null default false,
  add column if not exists go_live_checklist jsonb not null default '{}'::jsonb,
  add column if not exists go_live_at timestamptz,
  add column if not exists amc_amount_btn numeric(12,2),
  add column if not exists amc_renews_on date,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspend_reason text;

create index if not exists properties_distributor_id_idx
  on properties (distributor_id)
  where distributor_id is not null;

create index if not exists properties_is_demo_idx
  on properties (is_demo)
  where is_demo = true;

-- ---------------------------------------------------------------------------
-- Invoices & leads & tickets & audit
-- ---------------------------------------------------------------------------
create table if not exists amc_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  property_id uuid references properties (id) on delete cascade,
  distributor_id uuid references distributors (id) on delete set null,
  period_start date,
  period_end date,
  amount_btn numeric(12,2) not null,
  status text not null default 'draft'
    check (status = any (array['draft'::text,'sent'::text,'paid'::text,'overdue'::text,'waived'::text])),
  paid_at timestamptz,
  bank_ref text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists royalty_invoices (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributors (id) on delete cascade,
  property_id uuid references properties (id) on delete set null,
  package_code text references catalog_packages (code),
  period_start date,
  period_end date,
  amount_btn numeric(12,2) not null,
  status text not null default 'draft'
    check (status = any (array['draft'::text,'sent'::text,'paid'::text,'overdue'::text,'waived'::text])),
  paid_at timestamptz,
  bank_ref text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  segment text not null default 'independent'
    check (segment = any (array['independent'::text,'chain'::text,'leased'::text])),
  rooms integer,
  dzongkhag text,
  notes text,
  status text not null default 'new'
    check (status = any (array['new'::text,'contacted'::text,'demo'::text,'won'::text,'lost'::text])),
  distributor_id uuid references distributors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_leads_status_idx on sales_leads (status);
create index if not exists sales_leads_distributor_idx on sales_leads (distributor_id);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  property_id uuid references properties (id) on delete cascade,
  distributor_id uuid references distributors (id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open'
    check (status = any (array['open'::text,'pending'::text,'resolved'::text,'closed'::text])),
  priority text not null default 'normal'
    check (priority = any (array['low'::text,'normal'::text,'critical'::text])),
  hours_logged numeric(8,2) not null default 0,
  billable_acknowledged boolean not null default false,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  actor_role text,
  action text not null,
  tenant_id uuid,
  property_id uuid,
  distributor_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_events_created_idx
  on platform_audit_events (created_at desc);

-- RLS: service role full access (ERP already uses admin client for ops)
alter table distributors enable row level security;
alter table distributor_members enable row level security;
alter table platform_admins enable row level security;
alter table catalog_packages enable row level security;
alter table amc_invoices enable row level security;
alter table royalty_invoices enable row level security;
alter table sales_leads enable row level security;
alter table support_tickets enable row level security;
alter table platform_audit_events enable row level security;

drop policy if exists distributors_service_role on distributors;
create policy distributors_service_role on distributors for all to service_role using (true) with check (true);

drop policy if exists distributor_members_service_role on distributor_members;
create policy distributor_members_service_role on distributor_members for all to service_role using (true) with check (true);

drop policy if exists platform_admins_service_role on platform_admins;
create policy platform_admins_service_role on platform_admins for all to service_role using (true) with check (true);

drop policy if exists catalog_packages_service_role on catalog_packages;
create policy catalog_packages_service_role on catalog_packages for all to service_role using (true) with check (true);

drop policy if exists catalog_packages_public_read on catalog_packages;
create policy catalog_packages_public_read on catalog_packages for select to anon, authenticated using (active = true);

drop policy if exists amc_invoices_service_role on amc_invoices;
create policy amc_invoices_service_role on amc_invoices for all to service_role using (true) with check (true);

drop policy if exists royalty_invoices_service_role on royalty_invoices;
create policy royalty_invoices_service_role on royalty_invoices for all to service_role using (true) with check (true);

drop policy if exists sales_leads_service_role on sales_leads;
create policy sales_leads_service_role on sales_leads for all to service_role using (true) with check (true);

drop policy if exists sales_leads_anon_insert on sales_leads;
create policy sales_leads_anon_insert on sales_leads for insert to anon, authenticated with check (true);

drop policy if exists support_tickets_service_role on support_tickets;
create policy support_tickets_service_role on support_tickets for all to service_role using (true) with check (true);

drop policy if exists platform_audit_events_service_role on platform_audit_events;
create policy platform_audit_events_service_role on platform_audit_events for all to service_role using (true) with check (true);

comment on table distributors is 'Partner offices that onboard hotels and collect AMC; pay royalty to Fame Digital.';
comment on table catalog_packages is 'MSRP and royalty catalog — editable; marketing site mirrors seed defaults.';
comment on table sales_leads is 'Marketing /demo pipeline assigned to distributors.';
