-- Phase 2: HK service flow, room amenity SKUs, lost & found

-- ---------------------------------------------------------------------------
-- FO service request flag on physical rooms
-- ---------------------------------------------------------------------------
alter table room_units
  add column if not exists service_requested_at timestamptz;

comment on column room_units.service_requested_at is
  'Set when front desk requests housekeeping service for this unit.';

-- ---------------------------------------------------------------------------
-- HK assignments: optional staff until assigned + mandatory checklist
-- ---------------------------------------------------------------------------
alter table hk_assignments
  alter column staff_id drop not null;

alter table hk_assignments
  add column if not exists requested_by text,
  add column if not exists checklist_clean_ok boolean not null default false,
  add column if not exists checklist_linen_ok boolean not null default false,
  add column if not exists checklist_amenities_ok boolean not null default false,
  add column if not exists checklist_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Room amenity par levels (inventory SKU qty per room turnover)
-- ---------------------------------------------------------------------------
create table if not exists room_amenity_pars (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  par_qty numeric(12,3) not null default 1 check (par_qty > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, inventory_item_id)
);

create index if not exists room_amenity_pars_property_idx
  on room_amenity_pars (property_id, is_active, sort_order);

alter table room_amenity_pars enable row level security;

drop policy if exists "service_role full room_amenity_pars" on room_amenity_pars;
create policy "service_role full room_amenity_pars" on room_amenity_pars
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Lost & found
-- ---------------------------------------------------------------------------
create table if not exists lost_found_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  room_unit_id uuid references room_units(id) on delete set null,
  found_by_staff_id uuid references staff_members(id) on delete set null,
  description text not null,
  found_at timestamptz not null default now(),
  status text not null default 'open'
    check (status = any (array['open'::text, 'claimed'::text, 'disposed'::text])),
  guest_name text,
  guest_contact text,
  claimed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists lost_found_items_property_idx
  on lost_found_items (property_id, status, found_at desc);

alter table lost_found_items enable row level security;

drop policy if exists "service_role full lost_found_items" on lost_found_items;
create policy "service_role full lost_found_items" on lost_found_items
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed Olakha room amenity SKUs + par (teabag, milk, sugar, etc.)
-- ---------------------------------------------------------------------------
insert into inventory_items (
  property_id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn
)
select p.id, v.sku, v.name, 'amenity', v.unit, v.qty, v.reorder, v.cost
from properties p
cross join (values
  ('AMN-TEA', 'Teabag sachets', 'ea', 500, 100, 3),
  ('AMN-MILK', 'Milk powder sachets', 'ea', 400, 80, 5),
  ('AMN-SUGAR', 'Sugar sachets', 'ea', 500, 100, 2),
  ('AMN-SOAP', 'Guest soap bars', 'ea', 200, 50, 12),
  ('AMN-SHAMPOO', 'Shampoo sachets', 'ea', 300, 60, 8),
  ('AMN-TOWEL', 'Hand towel (linen)', 'ea', 80, 20, 45)
) as v(sku, name, unit, qty, reorder, cost)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, sku) do nothing;

insert into room_amenity_pars (property_id, inventory_item_id, par_qty, sort_order)
select p.id, i.id, v.par, v.ord
from properties p
join inventory_items i on i.property_id = p.id
join (values
  ('AMN-TEA', 2, 1),
  ('AMN-MILK', 2, 2),
  ('AMN-SUGAR', 2, 3),
  ('AMN-SOAP', 1, 4),
  ('AMN-SHAMPOO', 1, 5)
) as v(sku, par, ord) on v.sku = i.sku
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, inventory_item_id) do nothing;
