-- Bar pour packs: spirits (ml / pek / bottle), beer cases, family links, menu categories.

-- ---------------------------------------------------------------------------
-- Property default pour
-- ---------------------------------------------------------------------------
alter table properties
  add column if not exists bar_standard_pour_ml numeric(12,1) not null default 30
    check (bar_standard_pour_ml > 0 and bar_standard_pour_ml <= 500);

comment on column properties.bar_standard_pour_ml is
  'Default spirit pour (pek) in millilitres — usually 30.';

-- ---------------------------------------------------------------------------
-- Inventory packaging for bar SKUs
-- ---------------------------------------------------------------------------
alter table inventory_items
  add column if not exists bottle_size_ml numeric(12,1)
    check (bottle_size_ml is null or (bottle_size_ml > 0 and bottle_size_ml <= 5000)),
  add column if not exists bottles_per_case integer
    check (bottles_per_case is null or (bottles_per_case >= 1 and bottles_per_case <= 500)),
  add column if not exists standard_pour_ml numeric(12,1)
    check (standard_pour_ml is null or (standard_pour_ml > 0 and standard_pour_ml <= 500)),
  add column if not exists bar_kind text
    check (bar_kind is null or bar_kind = any (array[
      'spirit'::text,
      'beer'::text,
      'mixer'::text,
      'other'::text
    ]));

comment on column inventory_items.bottle_size_ml is
  'Spirit bottle volume in ml; ledger unit for spirits is typically ml.';
comment on column inventory_items.bottles_per_case is
  'Beer / soda bottles (ea) per case for case receive math.';
comment on column inventory_items.standard_pour_ml is
  'Per-SKU pour override; null → property.bar_standard_pour_ml.';
comment on column inventory_items.bar_kind is
  'Marks ledger SKUs used by bar packs (spirit, beer, mixer).';

-- ---------------------------------------------------------------------------
-- Family groups Pek + Bottle sellables sharing one inventory SKU
-- ---------------------------------------------------------------------------
create table if not exists menu_item_families (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  bar_kind text not null
    check (bar_kind = any (array[
      'spirit'::text,
      'beer'::text,
      'mixer'::text,
      'other'::text
    ])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, name)
);

create index if not exists menu_item_families_property_idx
  on menu_item_families (property_id);
create index if not exists menu_item_families_inventory_idx
  on menu_item_families (inventory_item_id);

alter table menu_item_families enable row level security;

drop policy if exists "service role menu item families" on menu_item_families;
create policy "service role menu item families" on menu_item_families
  for all to service_role using (true) with check (true);

alter table menu_items
  add column if not exists family_id uuid references menu_item_families(id) on delete set null,
  add column if not exists sell_size text
    check (sell_size is null or sell_size = any (array[
      'pek'::text,
      'bottle'::text,
      'single'::text,
      'case'::text
    ]));

create index if not exists menu_items_family_idx on menu_items (family_id);

comment on column menu_items.family_id is
  'Optional bar family linking pack sell size (pek/bottle) to shared stock.';
comment on column menu_items.sell_size is
  'Sale unit within a bar family: pek, bottle, single bottle/can, case.';

-- ---------------------------------------------------------------------------
-- Managed categories (denormalized name still stored on menu_items.category)
-- ---------------------------------------------------------------------------
create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order <= 9999),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, name)
);

create unique index if not exists menu_categories_property_name_ci_uidx
  on menu_categories (property_id, lower(name));

create index if not exists menu_categories_property_sort_idx
  on menu_categories (property_id, is_active, sort_order, name);

alter table menu_categories enable row level security;

drop policy if exists "service role menu categories" on menu_categories;
create policy "service role menu categories" on menu_categories
  for all to service_role using (true) with check (true);

-- Seed categories from existing free-text values
insert into menu_categories (property_id, name, sort_order, is_active)
select
  m.property_id,
  trim(m.category) as name,
  min(m.sort_order)::integer,
  true
from menu_items m
where trim(m.category) <> ''
group by m.property_id, trim(m.category)
on conflict (property_id, name) do nothing;
