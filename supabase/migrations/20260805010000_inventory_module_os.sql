-- Inventory module OS: staff-defined categories + hotel-wide starter catalog

-- ---------------------------------------------------------------------------
-- Custom categories (per property)
-- ---------------------------------------------------------------------------
create table if not exists inventory_categories (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id, slug)
);

create index if not exists inventory_categories_property_idx
  on inventory_categories (property_id, is_active, sort_order);

alter table inventory_categories enable row level security;

drop policy if exists "service_role full inventory_categories" on inventory_categories;
create policy "service_role full inventory_categories" on inventory_categories
  for all to service_role using (true) with check (true);

-- Drop legacy enum check — categories live in inventory_categories
alter table inventory_items drop constraint if exists inventory_items_category_check;

-- Normalize legacy amenity slug
update inventory_items
set category = 'room_amenities'
where category = 'amenity';

-- ---------------------------------------------------------------------------
-- Seed standard categories for every property
-- ---------------------------------------------------------------------------
insert into inventory_categories (property_id, slug, name, sort_order)
select p.id, v.slug, v.name, v.ord
from properties p
cross join (values
  ('room_amenities', 'Room amenities', 1),
  ('grocery', 'Grocery', 2),
  ('meat', 'Meat', 3),
  ('vegetables', 'Vegetables', 4),
  ('produce', 'Produce', 5),
  ('dairy', 'Dairy', 6),
  ('dry', 'Dry goods', 7),
  ('beverage', 'Beverages', 8),
  ('linen', 'Linen', 9),
  ('cleaning', 'Cleaning supplies', 10),
  ('fnb_bar', 'F&B bar', 11),
  ('kitchen', 'Kitchen staples', 12),
  ('maintenance', 'Maintenance parts', 13),
  ('packaging', 'Packaging', 14),
  ('other', 'Other', 99)
) as v(slug, name, ord)
on conflict (property_id, slug) do nothing;

-- Allow maintenance / laundry location departments
alter table inventory_locations drop constraint if exists inventory_locations_department_check;
alter table inventory_locations add constraint inventory_locations_department_check
  check (department = any (array[
    'room'::text, 'pantry'::text, 'store'::text, 'fnb'::text, 'kitchen'::text,
    'maintenance'::text, 'laundry'::text, 'other'::text
  ]));

-- ---------------------------------------------------------------------------
-- Olakha: expanded starter SKUs (whole hotel — not amenities only)
-- ---------------------------------------------------------------------------
insert into inventory_items (
  property_id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn
)
select p.id, v.sku, v.name, v.cat, v.unit, v.qty, v.par, v.cost
from properties p
cross join (values
  ('AMN-COFFEE', 'Coffee sachets', 'room_amenities', 'ea', 300, 60, 4),
  ('AMN-WATER', 'Water bottles (500ml)', 'room_amenities', 'ea', 120, 40, 15),
  ('AMN-TISSUE', 'Tissue box', 'room_amenities', 'ea', 100, 30, 25),
  ('AMN-SLIPPER', 'Guest slippers (pair)', 'room_amenities', 'ea', 60, 20, 35),
  ('CUT-SPOON', 'Teaspoon', 'kitchen', 'ea', 200, 50, 8),
  ('CUT-FORK', 'Dinner fork', 'kitchen', 'ea', 200, 50, 12),
  ('CUT-KNIFE', 'Dinner knife', 'kitchen', 'ea', 200, 50, 12),
  ('GRO-RICE', 'Rice', 'grocery', 'kg', 80, 20, 45),
  ('GRO-OIL', 'Cooking oil', 'grocery', 'l', 40, 10, 120),
  ('GRO-SALT', 'Salt', 'grocery', 'kg', 25, 5, 18),
  ('GRO-FLOUR', 'Flour', 'grocery', 'kg', 30, 8, 35),
  ('MEAT-CHICKEN', 'Chicken (fresh)', 'meat', 'kg', 15, 5, 280),
  ('MEAT-PORK', 'Pork (fresh)', 'meat', 'kg', 10, 4, 320),
  ('VEG-ONION', 'Onions', 'vegetables', 'kg', 25, 8, 40),
  ('VEG-POTATO', 'Potatoes', 'vegetables', 'kg', 30, 10, 35),
  ('VEG-TOMATO', 'Tomatoes', 'vegetables', 'kg', 15, 5, 60),
  ('DAIRY-MILK', 'Fresh milk', 'dairy', 'l', 20, 6, 65),
  ('DAIRY-BUTTER', 'Butter', 'dairy', 'kg', 8, 3, 450),
  ('LIN-SHEET', 'Bed sheet (queen)', 'linen', 'ea', 40, 10, 850),
  ('LIN-TOWEL-BATH', 'Bath towel', 'linen', 'ea', 80, 20, 320),
  ('LIN-TOWEL-HAND', 'Hand towel', 'linen', 'ea', 100, 25, 120),
  ('CLN-DETERGENT', 'Laundry detergent', 'cleaning', 'l', 15, 4, 180),
  ('CLN-FLOOR', 'Floor cleaner', 'cleaning', 'l', 10, 3, 95),
  ('CLN-GLASS', 'Glass cleaner', 'cleaning', 'l', 8, 2, 85),
  ('CLN-SPONGE', 'Scouring sponges', 'cleaning', 'ea', 50, 15, 12),
  ('FNB-WHISKY', 'Whisky (750ml)', 'fnb_bar', 'ea', 12, 4, 1200),
  ('FNB-BEER', 'Beer (330ml)', 'fnb_bar', 'ea', 48, 12, 85),
  ('FNB-MIXER', 'Tonic water', 'fnb_bar', 'ea', 36, 12, 45),
  ('MAINT-BULB', 'LED bulb 9W', 'maintenance', 'ea', 30, 10, 95),
  ('MAINT-FUSE', 'MCB fuse 16A', 'maintenance', 'ea', 10, 4, 120),
  ('MAINT-TAPE', 'Electrical tape', 'maintenance', 'ea', 15, 5, 35),
  ('LPG-FULL', 'LPG cylinder (full)', 'kitchen', 'ea', 4, 1, 850),
  ('LPG-EMPTY', 'LPG cylinder (empty)', 'kitchen', 'ea', 2, 0, 0)
) as v(sku, name, cat, unit, qty, par, cost)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, sku) do nothing;

-- Backfill balances for newly seeded items at main store
insert into inventory_balances (property_id, item_id, location_id, qty_on_hand)
select i.property_id, i.id, l.id, i.qty_on_hand
from inventory_items i
join inventory_locations l
  on l.property_id = i.property_id and l.code = 'STORE'
join properties p on p.id = i.property_id and p.slug = 'pelbu-suites-olakha'
where i.qty_on_hand > 0
  and not exists (
    select 1 from inventory_balances b
    where b.item_id = i.id and b.location_id = l.id
  );

update inventory_items i
set default_location_id = l.id
from inventory_locations l
where l.property_id = i.property_id
  and l.code = 'STORE'
  and i.default_location_id is null;
