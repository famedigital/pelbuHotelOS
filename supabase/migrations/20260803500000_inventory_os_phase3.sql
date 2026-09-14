-- Phase 3: Inventory OS — locations, balances, transfers, damage, audits, PO stub

-- ---------------------------------------------------------------------------
-- Storage locations / departments
-- ---------------------------------------------------------------------------
create table if not exists inventory_locations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null,
  name text not null,
  department text not null default 'store'
    check (department = any (array[
      'room'::text, 'pantry'::text, 'store'::text, 'fnb'::text, 'kitchen'::text
    ])),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, code)
);

create index if not exists inventory_locations_property_idx
  on inventory_locations (property_id, is_active, sort_order);

alter table inventory_locations enable row level security;

drop policy if exists "service_role full inventory_locations" on inventory_locations;
create policy "service_role full inventory_locations" on inventory_locations
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Per-location balances (item total qty_on_hand remains canonical sum)
-- ---------------------------------------------------------------------------
create table if not exists inventory_balances (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  location_id uuid not null references inventory_locations(id) on delete cascade,
  qty_on_hand numeric(12,3) not null default 0 check (qty_on_hand >= 0),
  updated_at timestamptz not null default now(),
  unique (item_id, location_id)
);

create index if not exists inventory_balances_location_idx
  on inventory_balances (location_id, item_id);

alter table inventory_balances enable row level security;

drop policy if exists "service_role full inventory_balances" on inventory_balances;
create policy "service_role full inventory_balances" on inventory_balances
  for all to service_role using (true) with check (true);

alter table inventory_items
  add column if not exists default_location_id uuid references inventory_locations(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Movement extensions: location, transfer target, receipt photo, damage replace
-- ---------------------------------------------------------------------------
alter table inventory_movements
  add column if not exists location_id uuid references inventory_locations(id) on delete set null,
  add column if not exists to_location_id uuid references inventory_locations(id) on delete set null,
  add column if not exists photo_url text,
  add column if not exists total_amount_btn numeric(12,2),
  add column if not exists damage_replace_mode text;

alter table inventory_movements drop constraint if exists inventory_movements_damage_replace_mode_check;
alter table inventory_movements add constraint inventory_movements_damage_replace_mode_check
  check (damage_replace_mode is null or damage_replace_mode = any (array[
    'now'::text, 'later'::text, 'transfer'::text, 'purchase'::text
  ]));

alter table inventory_movements drop constraint if exists inventory_movements_movement_kind_check;
alter table inventory_movements add constraint inventory_movements_movement_kind_check
  check (movement_kind = any (array[
    'receive'::text,
    'adjust'::text,
    'waste'::text,
    'issue'::text,
    'count'::text,
    'transfer'::text,
    'damage'::text
  ]));

-- ---------------------------------------------------------------------------
-- Purchase orders (stub — draft → receive wired in Phase 3 UI)
-- ---------------------------------------------------------------------------
create table if not exists inventory_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  po_number text not null,
  vendor_name text,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text, 'ordered'::text, 'partial'::text, 'received'::text, 'cancelled'::text
    ])),
  notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, po_number)
);

create index if not exists inventory_purchase_orders_property_idx
  on inventory_purchase_orders (property_id, status, created_at desc);

alter table inventory_purchase_orders enable row level security;

drop policy if exists "service_role full inventory_purchase_orders" on inventory_purchase_orders;
create policy "service_role full inventory_purchase_orders" on inventory_purchase_orders
  for all to service_role using (true) with check (true);

create table if not exists inventory_purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references inventory_purchase_orders(id) on delete cascade,
  item_id uuid references inventory_items(id) on delete set null,
  sku_snapshot text,
  name_snapshot text not null,
  qty_ordered numeric(12,3) not null check (qty_ordered > 0),
  unit_cost_btn numeric(12,2) not null default 0 check (unit_cost_btn >= 0),
  qty_received numeric(12,3) not null default 0 check (qty_received >= 0),
  created_at timestamptz not null default now()
);

create index if not exists inventory_po_lines_po_idx
  on inventory_purchase_order_lines (purchase_order_id);

alter table inventory_purchase_order_lines enable row level security;

drop policy if exists "service_role full inventory_purchase_order_lines" on inventory_purchase_order_lines;
create policy "service_role full inventory_purchase_order_lines" on inventory_purchase_order_lines
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Stock audits
-- ---------------------------------------------------------------------------
create table if not exists inventory_audits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  location_id uuid references inventory_locations(id) on delete set null,
  business_date date not null default current_date,
  status text not null default 'open'
    check (status = any (array['open'::text, 'posted'::text, 'cancelled'::text])),
  notes text,
  posted_at timestamptz,
  created_by text not null default 'desk',
  created_at timestamptz not null default now()
);

create index if not exists inventory_audits_property_idx
  on inventory_audits (property_id, status, business_date desc);

alter table inventory_audits enable row level security;

drop policy if exists "service_role full inventory_audits" on inventory_audits;
create policy "service_role full inventory_audits" on inventory_audits
  for all to service_role using (true) with check (true);

create table if not exists inventory_audit_lines (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references inventory_audits(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  expected_qty numeric(12,3) not null default 0,
  counted_qty numeric(12,3),
  variance_qty numeric(12,3),
  notes text,
  unique (audit_id, item_id)
);

create index if not exists inventory_audit_lines_audit_idx
  on inventory_audit_lines (audit_id);

alter table inventory_audit_lines enable row level security;

drop policy if exists "service_role full inventory_audit_lines" on inventory_audit_lines;
create policy "service_role full inventory_audit_lines" on inventory_audit_lines
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed Olakha locations + backfill balances from current on-hand
-- ---------------------------------------------------------------------------
insert into inventory_locations (property_id, code, name, department, sort_order)
select p.id, v.code, v.name, v.dept, v.ord
from properties p
cross join (values
  ('STORE', 'Main store', 'store', 1),
  ('PANTRY', 'HK pantry', 'pantry', 2),
  ('FNB', 'F&B bar', 'fnb', 3),
  ('KITCHEN', 'Kitchen', 'kitchen', 4),
  ('ROOM-AMN', 'Room amenities', 'room', 5)
) as v(code, name, dept, ord)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, code) do nothing;

insert into inventory_balances (property_id, item_id, location_id, qty_on_hand)
select i.property_id, i.id, l.id, i.qty_on_hand
from inventory_items i
join inventory_locations l
  on l.property_id = i.property_id and l.code = 'STORE'
where i.qty_on_hand > 0
on conflict (item_id, location_id) do update
  set qty_on_hand = excluded.qty_on_hand,
      updated_at = now();

update inventory_items i
set default_location_id = l.id
from inventory_locations l
where l.property_id = i.property_id
  and l.code = 'STORE'
  and i.default_location_id is null;
