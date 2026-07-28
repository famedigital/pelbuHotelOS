-- Hold TTL, deposit rules, multi-property setup (income streams + banks)

-- ---------------------------------------------------------------------------
-- Bookings: held / expired + token hold columns
-- ---------------------------------------------------------------------------
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings
  add constraint bookings_status_check
  check (status = any (array[
    'pending'::text,
    'held'::text,
    'confirmed'::text,
    'checked_in'::text,
    'checked_out'::text,
    'cancelled'::text,
    'no_show'::text,
    'expired'::text
  ]));

alter table bookings
  add column if not exists hold_expires_at timestamptz,
  add column if not exists token_required_btn numeric(12,2) not null default 0,
  add column if not exists token_received_btn numeric(12,2) not null default 0,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by text,
  add column if not exists hold_extended_count int not null default 0;

create index if not exists bookings_held_expires_idx
  on bookings (property_id, hold_expires_at)
  where status = 'held';

-- ---------------------------------------------------------------------------
-- Hold TTL rules (season × source)
-- ---------------------------------------------------------------------------
create table if not exists hold_ttl_rules (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  source text not null check (source = any (array[
    'owner'::text,
    'reservation'::text,
    'agent'::text,
    'client'::text,
    'ota'::text
  ])),
  season_kind text not null check (season_kind = any (array[
    'peak'::text,
    'lean'::text,
    'off'::text
  ])),
  ttl_hours int not null check (ttl_hours > 0),
  unique (property_id, source, season_kind)
);

create index if not exists hold_ttl_rules_property_idx
  on hold_ttl_rules (property_id);

alter table hold_ttl_rules enable row level security;

drop policy if exists "service_role full hold_ttl_rules" on hold_ttl_rules;
create policy "service_role full hold_ttl_rules" on hold_ttl_rules
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Deposit / token money rules
-- ---------------------------------------------------------------------------
create table if not exists property_deposit_rules (
  property_id uuid primary key references properties(id) on delete cascade,
  mode text not null default 'one_night'
    check (mode = any (array[
      'one_night'::text,
      'fixed'::text,
      'percent'::text
    ])),
  floor_btn numeric(12,2) not null default 0 check (floor_btn >= 0),
  percent numeric(5,2) check (percent is null or (percent > 0 and percent <= 100)),
  bank_hint text,
  updated_at timestamptz not null default now()
);

alter table property_deposit_rules enable row level security;

drop policy if exists "service_role full property_deposit_rules" on property_deposit_rules;
create policy "service_role full property_deposit_rules" on property_deposit_rules
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Property setup (wizard progress + income streams)
-- ---------------------------------------------------------------------------
alter table properties
  add column if not exists setup_step int not null default 1
    check (setup_step >= 1 and setup_step <= 5),
  add column if not exists setup_completed_at timestamptz,
  add column if not exists income_streams jsonb not null default '{
    "rooms": true,
    "outlets": ["cafe", "pastry", "restaurant", "bar"],
    "services": ["spa", "meeting", "steam"],
    "guest_services": ["taxi", "shop", "other"],
    "channel": false
  }'::jsonb,
  add column if not exists bank_accounts jsonb not null default '[]'::jsonb;

-- Flagship already live
update properties
set setup_step = 5,
    setup_completed_at = coalesce(setup_completed_at, now())
where slug = 'pelbu-suites-olakha'
  and setup_completed_at is null;

-- ---------------------------------------------------------------------------
-- Seed TTL + deposit rules for every existing property
-- ---------------------------------------------------------------------------
insert into hold_ttl_rules (property_id, source, season_kind, ttl_hours)
select p.id, v.source, v.season_kind, v.ttl_hours
from properties p
cross join (
  values
    ('client', 'peak', 12),
    ('client', 'lean', 48),
    ('client', 'off', 168),
    ('agent', 'peak', 24),
    ('agent', 'lean', 72),
    ('agent', 'off', 240),
    ('reservation', 'peak', 6),
    ('reservation', 'lean', 24),
    ('reservation', 'off', 72),
    ('owner', 'peak', 6),
    ('owner', 'lean', 24),
    ('owner', 'off', 72),
    ('ota', 'peak', 24),
    ('ota', 'lean', 48),
    ('ota', 'off', 72)
) as v(source, season_kind, ttl_hours)
on conflict (property_id, source, season_kind) do nothing;

insert into property_deposit_rules (property_id, mode, floor_btn, percent, bank_hint)
select
  p.id,
  'one_night',
  2000,
  null,
  'Transfer token money to Pelbu Suites · quote booking ID in remarks'
from properties p
on conflict (property_id) do nothing;
