-- Phase 5: Kitchen ops, performance targets, kitchen events

-- ---------------------------------------------------------------------------
-- Owner performance targets (day / season / year)
-- ---------------------------------------------------------------------------
create table if not exists property_performance_targets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  period_kind text not null
    check (period_kind = any (array['day'::text, 'season'::text, 'year'::text])),
  period_key text not null,
  metric text not null
    check (metric = any (array[
      'revenue'::text,
      'occupancy'::text,
      'adr'::text,
      'revpar'::text,
      'fnb_sales'::text,
      'food_cost_pct'::text
    ])),
  target_value numeric(14,2) not null check (target_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, period_kind, period_key, metric)
);

create index if not exists property_performance_targets_property_idx
  on property_performance_targets (property_id, period_kind, period_key);

alter table property_performance_targets enable row level security;

drop policy if exists "service_role full property_performance_targets" on property_performance_targets;
create policy "service_role full property_performance_targets" on property_performance_targets
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Kitchen events lite (banquets, group meals)
-- ---------------------------------------------------------------------------
create table if not exists kitchen_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  event_date date not null,
  title text not null,
  covers int not null default 0 check (covers >= 0),
  meal_period text not null default 'all'
    check (meal_period = any (array[
      'breakfast'::text, 'lunch'::text, 'dinner'::text, 'all'::text
    ])),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists kitchen_events_property_date_idx
  on kitchen_events (property_id, event_date desc);

alter table kitchen_events enable row level security;

drop policy if exists "service_role full kitchen_events" on kitchen_events;
create policy "service_role full kitchen_events" on kitchen_events
  for all to service_role using (true) with check (true);

-- LPG cylinder SKUs for kitchen board (Olakha seed)
insert into inventory_items (
  property_id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn
)
select p.id, v.sku, v.name, v.category, v.unit, v.qty, v.reorder, v.cost
from properties p
cross join (values
  ('LPG-FULL', 'LPG cylinder (full)', 'other', 'ea', 4, 2, 850),
  ('LPG-EMPTY', 'LPG cylinder (empty)', 'other', 'ea', 2, 0, 0)
) as v(sku, name, category, unit, qty, reorder, cost)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, sku) do nothing;

-- Default month targets for Olakha (owner can edit on performance page)
insert into property_performance_targets (
  property_id, period_kind, period_key, metric, target_value, notes
)
select
  p.id,
  v.period_kind,
  v.period_key,
  v.metric,
  v.target_value,
  v.notes
from properties p
cross join (
  values
    ('year', '2026', 'revenue', 12000000::numeric, 'Annual room + F&B target'),
    ('year', '2026', 'occupancy', 72::numeric, 'Sellable OCC % target'),
    ('year', '2026', 'adr', 4500::numeric, 'Average daily rate Nu'),
    ('year', '2026', 'fnb_sales', 2400000::numeric, 'F&B outlet sales'),
    ('year', '2026', 'food_cost_pct', 32::numeric, 'Food cost % of F&B sales')
) as v(period_kind, period_key, metric, target_value, notes)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, period_kind, period_key, metric) do nothing;
