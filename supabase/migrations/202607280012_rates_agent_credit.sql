-- P3: rate matrix + agent credit ledger

create table if not exists room_rates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  room_type_id uuid not null references room_types(id) on delete cascade,
  season_kind text not null check (season_kind = any (array['peak'::text,'lean'::text,'off'::text])),
  rate_tier text not null check (rate_tier = any (array[
    'public'::text,
    'friends'::text,
    'family'::text,
    'mutual_friends'::text,
    'agents'::text,
    'mou_agents'::text
  ])),
  amount_btn numeric(12,2) not null check (amount_btn >= 0),
  currency text not null default 'BTN',
  unique (property_id, room_type_id, season_kind, rate_tier)
);

create index if not exists room_rates_lookup_idx
  on room_rates (property_id, season_kind, rate_tier);

alter table room_rates enable row level security;

drop policy if exists "public read room_rates" on room_rates;
create policy "public read room_rates" on room_rates
  for select using (true);

create table if not exists agent_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  entry_type text not null check (entry_type = any (array[
    'charge'::text,
    'payment'::text,
    'adjustment'::text,
    'limit_set'::text
  ])),
  amount_btn numeric(12,2) not null,
  balance_after_btn numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists agent_credit_ledger_agent_idx
  on agent_credit_ledger (agent_id, created_at desc);

alter table agent_credit_ledger enable row level security;

-- Seed rate tiers for Pelbu
insert into rate_tiers (property_id, code)
select p.id, v.code
from properties p
cross join (values
  ('public'),
  ('friends'),
  ('family'),
  ('mutual_friends'),
  ('agents'),
  ('mou_agents')
) as v(code)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from rate_tiers r where r.property_id = p.id and r.code = v.code
);

-- Seed seasons (approx calendar windows — adjust in CMS later)
insert into seasons (property_id, kind, starts_on, ends_on)
select p.id, v.kind, v.starts_on::date, v.ends_on::date
from properties p
cross join (values
  ('peak', '2026-03-01', '2026-05-31'),
  ('lean', '2026-06-01', '2026-08-31'),
  ('off', '2026-09-01', '2026-11-30'),
  ('peak', '2026-12-01', '2027-02-28')
) as v(kind, starts_on, ends_on)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from seasons s
  where s.property_id = p.id and s.kind = v.kind and s.starts_on = v.starts_on::date
);

-- Seed sample room rates (guest sellable only)
insert into room_rates (property_id, room_type_id, season_kind, rate_tier, amount_btn)
select p.id, rt.id, v.season_kind, v.rate_tier, v.amount_btn
from properties p
join room_types rt on rt.property_id = p.id and rt.inventory_kind = 'sellable_guest'
cross join (values
  ('peak','public',6500),
  ('peak','agents',5500),
  ('peak','mou_agents',5000),
  ('peak','friends',5200),
  ('peak','family',4800),
  ('peak','mutual_friends',5000),
  ('lean','public',4800),
  ('lean','agents',4200),
  ('lean','mou_agents',3900),
  ('lean','friends',4000),
  ('lean','family',3700),
  ('lean','mutual_friends',3900),
  ('off','public',3800),
  ('off','agents',3400),
  ('off','mou_agents',3200),
  ('off','friends',3300),
  ('off','family',3000),
  ('off','mutual_friends',3200)
) as v(season_kind, rate_tier, amount_btn)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from room_rates rr
  where rr.property_id = p.id
    and rr.room_type_id = rt.id
    and rr.season_kind = v.season_kind
    and rr.rate_tier = v.rate_tier
);
