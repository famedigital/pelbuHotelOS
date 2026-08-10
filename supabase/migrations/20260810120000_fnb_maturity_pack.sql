-- F&B maturity pack: restaurant product mode, waste/temp/clean logs,
-- table lifecycle statuses, bilingual menu fields, dining reservations.

-- ---------------------------------------------------------------------------
-- Product pack (hotel PMS vs standalone restaurant)
-- ---------------------------------------------------------------------------
alter table properties
  add column if not exists product_pack text not null default 'hotel';

alter table properties drop constraint if exists properties_product_pack_check;
alter table properties
  add constraint properties_product_pack_check
  check (product_pack = any (array['hotel'::text, 'restaurant'::text]));

comment on column properties.product_pack is
  'hotel = full PMS; restaurant = POS/kitchen/inventory/finance/HR only (no rooms/channel).';

alter table properties
  add column if not exists pos_training_mode boolean not null default false;

comment on column properties.pos_training_mode is
  'When true, POS may skip real stock deduct / GL (training drills).';

-- ---------------------------------------------------------------------------
-- Menu bilingual + allergens + combo
-- ---------------------------------------------------------------------------
alter table menu_items
  add column if not exists name_dz text,
  add column if not exists allergens text[] not null default '{}',
  add column if not exists is_combo boolean not null default false,
  add column if not exists daypart text;

comment on column menu_items.name_dz is 'Optional Dzongkha dish name for menus.';
comment on column menu_items.allergens is 'Guest allergen flags (e.g. nuts, dairy, gluten).';
comment on column menu_items.is_combo is 'Set / combo meal sold as one SKU.';
comment on column menu_items.daypart is 'Optional daypart tag: breakfast|lunch|dinner|allday|bar.';

-- ---------------------------------------------------------------------------
-- Dining table lifecycle: ordered, billed
-- ---------------------------------------------------------------------------
alter table dining_tables drop constraint if exists dining_tables_status_check;
alter table dining_tables
  add constraint dining_tables_status_check
  check (status = any (array[
    'free'::text,
    'occupied'::text,
    'ordered'::text,
    'billed'::text,
    'reserved'::text,
    'dirty'::text
  ]));

-- ---------------------------------------------------------------------------
-- Waste book (BFDA-friendly)
-- ---------------------------------------------------------------------------
create table if not exists fnb_waste_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  logged_at timestamptz not null default now(),
  business_date date not null default (timezone('Asia/Thimphu', now()))::date,
  outlet text,
  item_name text not null,
  qty numeric(12,3) not null check (qty > 0),
  unit text not null default 'kg',
  reason_code text not null default 'spoilage'
    check (reason_code = any (array[
      'spoilage'::text,
      'prep_error'::text,
      'overproduction'::text,
      'drop'::text,
      'expiry'::text,
      'other'::text
    ])),
  notes text,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  logged_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists fnb_waste_log_property_date_idx
  on fnb_waste_log (property_id, business_date desc);

alter table fnb_waste_log enable row level security;
drop policy if exists "service_role full fnb_waste_log" on fnb_waste_log;
create policy "service_role full fnb_waste_log" on fnb_waste_log
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Fridge / freezer temperature log
-- ---------------------------------------------------------------------------
create table if not exists fnb_temp_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  logged_at timestamptz not null default now(),
  business_date date not null default (timezone('Asia/Thimphu', now()))::date,
  location_label text not null,
  temp_c numeric(5,2) not null,
  in_range boolean not null default true,
  notes text,
  logged_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists fnb_temp_log_property_date_idx
  on fnb_temp_log (property_id, business_date desc);

alter table fnb_temp_log enable row level security;
drop policy if exists "service_role full fnb_temp_log" on fnb_temp_log;
create policy "service_role full fnb_temp_log" on fnb_temp_log
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Daily cleaning / pest sign-off
-- ---------------------------------------------------------------------------
create table if not exists fnb_cleaning_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  business_date date not null default (timezone('Asia/Thimphu', now()))::date,
  area text not null,
  task text not null,
  completed boolean not null default true,
  completed_by_name text,
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, business_date, area, task)
);

create index if not exists fnb_cleaning_log_property_date_idx
  on fnb_cleaning_log (property_id, business_date desc);

alter table fnb_cleaning_log enable row level security;
drop policy if exists "service_role full fnb_cleaning_log" on fnb_cleaning_log;
create policy "service_role full fnb_cleaning_log" on fnb_cleaning_log
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Table reservations / waitlist
-- ---------------------------------------------------------------------------
create table if not exists dining_reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  guest_name text not null,
  phone text,
  party_size int not null default 2 check (party_size > 0 and party_size <= 60),
  reserved_for timestamptz not null,
  status text not null default 'booked'
    check (status = any (array[
      'booked'::text,
      'waitlist'::text,
      'seated'::text,
      'cancelled'::text,
      'no_show'::text,
      'done'::text
    ])),
  table_id uuid references dining_tables(id) on delete set null,
  outlet text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dining_reservations_property_time_idx
  on dining_reservations (property_id, reserved_for);

alter table dining_reservations enable row level security;
drop policy if exists "service_role full dining_reservations" on dining_reservations;
create policy "service_role full dining_reservations" on dining_reservations
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- F&B stamp loyalty (simple)
-- ---------------------------------------------------------------------------
create table if not exists fnb_loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  phone text not null,
  guest_name text,
  stamps int not null default 0 check (stamps >= 0),
  free_meals int not null default 0 check (free_meals >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (property_id, phone)
);

alter table fnb_loyalty_cards enable row level security;
drop policy if exists "service_role full fnb_loyalty_cards" on fnb_loyalty_cards;
create policy "service_role full fnb_loyalty_cards" on fnb_loyalty_cards
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- LPG / gas cylinder usage log
-- ---------------------------------------------------------------------------
create table if not exists fnb_gas_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  business_date date not null default (timezone('Asia/Thimphu', now()))::date,
  cylinders numeric(8,2) not null check (cylinders > 0),
  cost_btn numeric(12,2),
  notes text,
  logged_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists fnb_gas_log_property_date_idx
  on fnb_gas_log (property_id, business_date desc);

alter table fnb_gas_log enable row level security;
drop policy if exists "service_role full fnb_gas_log" on fnb_gas_log;
create policy "service_role full fnb_gas_log" on fnb_gas_log
  for all using (true) with check (true);
