-- P5: HR, F&B inventory, room housekeeping units, audit trail
-- Desk path uses service_role. No anon access.

-- ---------------------------------------------------------------------------
-- Audit (money / approvals / overrides)
-- ---------------------------------------------------------------------------
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  actor text not null default 'desk',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_property_idx
  on audit_events (property_id, created_at desc);

create index if not exists audit_events_entity_idx
  on audit_events (entity_type, entity_id);

alter table audit_events enable row level security;

drop policy if exists "service_role full audit_events" on audit_events;
create policy "service_role full audit_events" on audit_events
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- HR: staff, shifts, leave
-- ---------------------------------------------------------------------------
create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  full_name text not null,
  role_label text not null
    check (role_label = any (array[
      'front_desk'::text,
      'reservation'::text,
      'fnb'::text,
      'kitchen'::text,
      'housekeeping'::text,
      'spa'::text,
      'security'::text,
      'maintenance'::text,
      'manager'::text,
      'other'::text
    ])),
  phone text,
  email text,
  status text not null default 'active'
    check (status = any (array['active'::text, 'inactive'::text])),
  hired_on date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists staff_members_property_idx
  on staff_members (property_id, status, full_name);

alter table staff_members enable row level security;

drop policy if exists "service_role full staff_members" on staff_members;
create policy "service_role full staff_members" on staff_members
  for all to service_role using (true) with check (true);

create table if not exists staff_shifts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  shift_date date not null,
  starts_at time not null,
  ends_at time not null,
  outlet text
    check (outlet is null or outlet = any (array[
      'front_desk'::text,
      'cafe'::text,
      'pastry'::text,
      'restaurant'::text,
      'bar'::text,
      'spa'::text,
      'housekeeping'::text,
      'other'::text
    ])),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists staff_shifts_date_idx
  on staff_shifts (property_id, shift_date desc);

create index if not exists staff_shifts_staff_idx
  on staff_shifts (staff_id, shift_date desc);

alter table staff_shifts enable row level security;

drop policy if exists "service_role full staff_shifts" on staff_shifts;
create policy "service_role full staff_shifts" on staff_shifts
  for all to service_role using (true) with check (true);

create table if not exists staff_leave (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  leave_type text not null
    check (leave_type = any (array[
      'annual'::text,
      'sick'::text,
      'unpaid'::text,
      'other'::text
    ])),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'approved'
    check (status = any (array[
      'requested'::text,
      'approved'::text,
      'denied'::text,
      'cancelled'::text
    ])),
  notes text,
  created_at timestamptz not null default now(),
  constraint staff_leave_range check (ends_on >= starts_on)
);

create index if not exists staff_leave_property_idx
  on staff_leave (property_id, starts_on desc);

alter table staff_leave enable row level security;

drop policy if exists "service_role full staff_leave" on staff_leave;
create policy "service_role full staff_leave" on staff_leave
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- F&B inventory (simple stock — recipe costing later)
-- ---------------------------------------------------------------------------
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null default 'other'
    check (category = any (array[
      'produce'::text,
      'dairy'::text,
      'meat'::text,
      'beverage'::text,
      'dry'::text,
      'packaging'::text,
      'amenity'::text,
      'other'::text
    ])),
  unit text not null default 'ea'
    check (unit = any (array[
      'ea'::text,
      'kg'::text,
      'g'::text,
      'l'::text,
      'ml'::text,
      'case'::text
    ])),
  qty_on_hand numeric(12,3) not null default 0,
  reorder_level numeric(12,3) not null default 0 check (reorder_level >= 0),
  unit_cost_btn numeric(12,2) not null default 0 check (unit_cost_btn >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, sku)
);

create index if not exists inventory_items_property_idx
  on inventory_items (property_id, is_active, category);

alter table inventory_items enable row level security;

drop policy if exists "service_role full inventory_items" on inventory_items;
create policy "service_role full inventory_items" on inventory_items
  for all to service_role using (true) with check (true);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  movement_kind text not null
    check (movement_kind = any (array[
      'receive'::text,
      'adjust'::text,
      'waste'::text,
      'issue'::text,
      'count'::text
    ])),
  qty_delta numeric(12,3) not null,
  unit_cost_btn numeric(12,2),
  reference text,
  notes text,
  created_by text not null default 'desk',
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_item_idx
  on inventory_movements (item_id, created_at desc);

create index if not exists inventory_movements_property_idx
  on inventory_movements (property_id, created_at desc);

alter table inventory_movements enable row level security;

drop policy if exists "service_role full inventory_movements" on inventory_movements;
create policy "service_role full inventory_movements" on inventory_movements
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Physical room units + housekeeping status
-- ---------------------------------------------------------------------------
create table if not exists room_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  room_type_id uuid not null references room_types(id) on delete cascade,
  label text not null,
  hk_status text not null default 'clean'
    check (hk_status = any (array[
      'clean'::text,
      'dirty'::text,
      'inspect'::text,
      'ooo'::text,
      'occupied'::text
    ])),
  floor_label text,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (property_id, label)
);

create index if not exists room_units_property_hk_idx
  on room_units (property_id, hk_status, label);

create index if not exists room_units_type_idx
  on room_units (room_type_id);

alter table room_units enable row level security;

drop policy if exists "service_role full room_units" on room_units;
create policy "service_role full room_units" on room_units
  for all to service_role using (true) with check (true);

-- Seed one physical unit per inventory slot (idempotent)
insert into room_units (property_id, room_type_id, label, hk_status)
select
  rt.property_id,
  rt.id,
  upper(rt.code) || '-' || lpad(gs.n::text, 2, '0'),
  'clean'
from room_types rt
cross join lateral generate_series(1, greatest(rt.unit_count, 0)) as gs(n)
where rt.unit_count > 0
  and not exists (
    select 1
    from room_units ru
    where ru.property_id = rt.property_id
      and ru.label = upper(rt.code) || '-' || lpad(gs.n::text, 2, '0')
  );

-- Seed a starter F&B stock list (adjust on desk)
insert into inventory_items (
  property_id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn
)
select p.id, v.sku, v.name, v.category, v.unit, v.qty, v.reorder, v.cost
from properties p
cross join (values
  ('DRY-RICE', 'Red rice (kg)', 'dry', 'kg', 40, 10, 85),
  ('DRY-EMA', 'Ema chilli (kg)', 'produce', 'kg', 8, 2, 120),
  ('BEV-SUJA', 'Suja tea bricks', 'beverage', 'ea', 24, 6, 45),
  ('BEV-BEER', 'Draught lager keg', 'beverage', 'ea', 2, 1, 2800),
  ('PKG-CUP', 'Takeaway cups', 'packaging', 'case', 6, 2, 350),
  ('AMN-SOAP', 'Guest soap bars', 'amenity', 'ea', 200, 50, 12)
) as v(sku, name, category, unit, qty, reorder, cost)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, sku) do nothing;
