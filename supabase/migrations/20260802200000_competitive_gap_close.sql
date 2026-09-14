-- Competitive Position gap close (2026-08-02):
-- connecting rooms, night-audit close_time, loyalty ledger, tenant domain/billing deepen.

-- 1) Connecting rooms (bidirectional preferred; stored as FK on one side)
alter table room_units
  add column if not exists connecting_room_unit_id uuid
    references room_units (id) on delete set null;

create index if not exists room_units_connecting_idx
  on room_units (connecting_room_unit_id)
  where connecting_room_unit_id is not null;

comment on column room_units.connecting_room_unit_id is
  'Optional adjacent/connecting room unit for rack badges and twin sells.';

-- 2) Per-property night audit close time (local HH:MM in property timezone)
alter table properties
  add column if not exists night_audit_close_time text not null default '00:00';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_night_audit_close_time_chk'
  ) then
    alter table properties
      add constraint properties_night_audit_close_time_chk
      check (night_audit_close_time ~ '^[0-2][0-9]:[0-5][0-9]$');
  end if;
end $$;

comment on column properties.night_audit_close_time is
  'Local wall-clock HH:MM when nightly close may run (cron skips until this time in property TZ).';

-- 3) Guest loyalty points (portal lite)
create table if not exists guest_loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  contact_phone text not null,
  contact_email text,
  display_name text,
  points_balance integer not null default 0
    check (points_balance >= 0),
  tier text not null default 'member'
    check (tier = any (array['member'::text, 'silver'::text, 'gold'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, contact_phone)
);

create index if not exists guest_loyalty_accounts_property_idx
  on guest_loyalty_accounts (property_id);

comment on table guest_loyalty_accounts is
  'Per-property loyalty account keyed by guest phone. Portal lite looks up by phone + property.';

create table if not exists guest_loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  account_id uuid not null references guest_loyalty_accounts (id) on delete cascade,
  booking_id uuid references bookings (id) on delete set null,
  folio_id uuid references folios (id) on delete set null,
  delta_points integer not null,
  reason text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists guest_loyalty_ledger_account_idx
  on guest_loyalty_ledger (account_id, created_at desc);

comment on table guest_loyalty_ledger is
  'Append-only points movements. Balance is denormalized on guest_loyalty_accounts.';

alter table guest_loyalty_accounts enable row level security;
alter table guest_loyalty_ledger enable row level security;

drop policy if exists guest_loyalty_accounts_service_role on guest_loyalty_accounts;
create policy guest_loyalty_accounts_service_role
  on guest_loyalty_accounts for all to service_role
  using (true) with check (true);

drop policy if exists guest_loyalty_ledger_service_role on guest_loyalty_ledger;
create policy guest_loyalty_ledger_service_role
  on guest_loyalty_ledger for all to service_role
  using (true) with check (true);

-- Public portal reads own account by phone via service role only (no anon RLS yet).

-- 4) Tenant billing + domain certification deepen
alter table tenants
  add column if not exists billing_email text,
  add column if not exists seats_used integer not null default 0
    check (seats_used >= 0),
  add column if not exists domain_verify_token text,
  add column if not exists domain_verified_at timestamptz;

comment on column tenants.billing_email is
  'Invoice contact for SaaS billing (invoice-first; Stripe later).';
comment on column tenants.seats_used is
  'Desk-reported active staff seats vs seat_limit (soft cap).';
comment on column tenants.domain_verify_token is
  'TXT token for customer domain ownership check before cert attach.';
comment on column tenants.domain_verified_at is
  'When domain ownership was last verified (manual or API).';

alter table properties
  add column if not exists public_host_cert_status text not null default 'none',
  add column if not exists desk_host_cert_status text not null default 'none',
  add column if not exists host_verify_token text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_public_host_cert_status_chk'
  ) then
    alter table properties
      add constraint properties_public_host_cert_status_chk
      check (
        public_host_cert_status = any (
          array['none'::text, 'pending'::text, 'verified'::text, 'failed'::text]
        )
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_desk_host_cert_status_chk'
  ) then
    alter table properties
      add constraint properties_desk_host_cert_status_chk
      check (
        desk_host_cert_status = any (
          array['none'::text, 'pending'::text, 'verified'::text, 'failed'::text]
        )
      );
  end if;
end $$;

comment on column properties.public_host_cert_status is
  'Vercel/custom domain cert status for public_host: none|pending|verified|failed.';
comment on column properties.desk_host_cert_status is
  'Vercel/custom domain cert status for desk_host.';
comment on column properties.host_verify_token is
  'Per-property TXT verification token for white-label domains.';
