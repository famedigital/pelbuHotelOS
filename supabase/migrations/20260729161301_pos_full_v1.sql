-- POS full v1: dining tables, modifiers, voids, split tenders, order/item extensions
-- Additive only. Desk path uses service_role.

-- ---------------------------------------------------------------------------
-- menu_items extensions
-- ---------------------------------------------------------------------------
alter table menu_items
  add column if not exists is_popular boolean not null default false,
  add column if not exists prep_station text not null default 'kitchen'
    check (prep_station = any (array[
      'kitchen'::text,
      'bar'::text,
      'pastry'::text,
      'grill'::text,
      'cold'::text
    ]));

comment on column menu_items.is_popular is
  'Surfaced on POS favourites rail.';
comment on column menu_items.prep_station is
  'Default KDS / KOT routing station for this item.';

-- ---------------------------------------------------------------------------
-- Dining tables (floor plan)
-- ---------------------------------------------------------------------------
create table if not exists dining_tables (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  area text not null default 'main',
  seats int not null default 2 check (seats > 0 and seats <= 40),
  status text not null default 'free'
    check (status = any (array[
      'free'::text,
      'occupied'::text,
      'reserved'::text,
      'dirty'::text
    ])),
  pos_x numeric(8,2),
  pos_y numeric(8,2),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, name)
);

comment on table dining_tables is
  'Restaurant / cafe floor tables for POS table mode (named dining_tables to avoid SQL clash with information_schema.tables).';

-- ---------------------------------------------------------------------------
-- Modifier groups + options
-- ---------------------------------------------------------------------------
create table if not exists menu_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  label text not null,
  min_sel int not null default 0 check (min_sel >= 0),
  max_sel int not null default 1 check (max_sel >= 0),
  is_required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (max_sel >= min_sel)
);

create table if not exists menu_modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references menu_modifier_groups(id) on delete cascade,
  name text not null,
  price_btn numeric(12,2) not null default 0 check (price_btn >= 0),
  gst_applicable boolean not null default true,
  prep_station text
    check (prep_station is null or prep_station = any (array[
      'kitchen'::text,
      'bar'::text,
      'pastry'::text,
      'grill'::text,
      'cold'::text
    ])),
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders extensions
-- ---------------------------------------------------------------------------
alter table orders
  add column if not exists table_id uuid references dining_tables(id) on delete set null,
  add column if not exists covers int check (covers is null or (covers > 0 and covers <= 40)),
  add column if not exists server_staff_id uuid references staff_members(id) on delete set null,
  add column if not exists course_count int not null default 1 check (course_count >= 1 and course_count <= 12),
  add column if not exists is_parked boolean not null default false,
  add column if not exists parked_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists void_by text,
  add column if not exists comp_reason text;

comment on column orders.is_parked is
  'Held / parked ticket — visible in open-tickets drawer, not sent to kitchen until unparked.';
comment on column orders.voided_at is
  'When set, order is voided; kot_status should be cancelled.';

-- ---------------------------------------------------------------------------
-- order_items extensions
-- ---------------------------------------------------------------------------
alter table order_items
  add column if not exists modifiers jsonb not null default '[]'::jsonb,
  add column if not exists course_no int not null default 1 check (course_no >= 1 and course_no <= 12),
  add column if not exists seat_no int check (seat_no is null or (seat_no >= 1 and seat_no <= 40)),
  add column if not exists line_notes text,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

comment on column order_items.modifiers is
  'Array of {groupId, optionId, name, qty, priceBtn, gstApplicable}. Snapshot at order time.';

-- ---------------------------------------------------------------------------
-- Split tenders
-- ---------------------------------------------------------------------------
create table if not exists order_tenders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method text not null
    check (method = any (array[
      'cash'::text,
      'bank'::text,
      'card'::text,
      'agent_credit'::text,
      'bank_qr'::text,
      'pay_bt'::text,
      'deposit'::text,
      'room_charge'::text
    ])),
  amount_btn numeric(12,2) not null check (amount_btn > 0),
  reference text,
  folio_id uuid references folios(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Void / comp audit feed (night audit)
-- ---------------------------------------------------------------------------
create table if not exists pos_voids (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid references order_items(id) on delete set null,
  reason_code text not null
    check (reason_code = any (array[
      'guest_change'::text,
      'kitchen_error'::text,
      'wrong_item'::text,
      'comp'::text,
      'manager_comp'::text,
      'duplicate'::text,
      'training'::text,
      'other'::text
    ])),
  reason_text text,
  manager_staff_id uuid references staff_members(id) on delete set null,
  amount_btn numeric(12,2) not null default 0,
  created_by text not null default 'desk',
  created_at timestamptz not null default now()
);
