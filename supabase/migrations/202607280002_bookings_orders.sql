-- Public booking contact fields + F&B menu/orders (Pelbu Olakha)
-- Applied remotely via Supabase MCP; kept here for local/replay.

alter table bookings
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists adults int not null default 1,
  add column if not exists rooms int not null default 1,
  add column if not exists notes text;

alter table bookings
  drop constraint if exists bookings_status_check;

alter table bookings
  add constraint bookings_status_check
  check (status = any (array[
    'pending'::text,
    'confirmed'::text,
    'checked_in'::text,
    'checked_out'::text,
    'cancelled'::text,
    'no_show'::text
  ]));

alter table bookings alter column status set default 'pending';

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  outlet text not null check (outlet = any (array['cafe'::text,'pastry'::text,'restaurant'::text,'bar'::text])),
  category text not null,
  name text not null,
  description text,
  price_btn numeric(12,2) not null check (price_btn >= 0),
  gst_applicable boolean not null default true,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  outlet text not null check (outlet = any (array['cafe'::text,'pastry'::text,'restaurant'::text,'bar'::text])),
  customer_name text not null,
  phone text not null,
  delivery_type text not null check (delivery_type = any (array['pickup'::text,'taxi'::text])),
  delivery_address text,
  status text not null default 'received' check (status = any (array[
    'received'::text,
    'preparing'::text,
    'ready'::text,
    'out_for_delivery'::text,
    'completed'::text,
    'cancelled'::text
  ])),
  notes text,
  subtotal_btn numeric(12,2) not null default 0,
  gst_btn numeric(12,2) not null default 0,
  total_btn numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name_snapshot text not null,
  qty int not null check (qty > 0),
  unit_price_btn numeric(12,2) not null,
  gst_applicable boolean not null default true
);

alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "public read menu_items" on menu_items;
create policy "public read menu_items" on menu_items
  for select using (is_available = true);

drop policy if exists "anon insert bookings" on bookings;
create policy "anon insert bookings" on bookings
  for insert to anon, authenticated
  with check (source = 'client');

drop policy if exists "anon insert booking_guests" on booking_guests;
create policy "anon insert booking_guests" on booking_guests
  for insert to anon, authenticated
  with check (true);

drop policy if exists "anon insert orders" on orders;
create policy "anon insert orders" on orders
  for insert to anon, authenticated
  with check (true);

drop policy if exists "anon insert order_items" on order_items;
create policy "anon insert order_items" on order_items
  for insert to anon, authenticated
  with check (true);

insert into menu_items (property_id, outlet, category, name, description, price_btn, gst_applicable, sort_order)
select p.id, v.outlet, v.category, v.name, v.description, v.price_btn, v.gst_applicable, v.sort_order
from properties p
cross join (values
  ('cafe','Breakfast','Suja & Khabzay','Butter tea with traditional biscuits',120,true,10),
  ('cafe','Breakfast','Himalayan Oats Bowl','Local honey, dried apple, walnuts',280,true,20),
  ('cafe','Breakfast','Egg & Cheese Paratha','Flaky paratha, farm egg, cheddar',320,true,30),
  ('cafe','Lunch','Thukpa Cup','Clear noodle soup, herbs, chili oil',350,true,40),
  ('cafe','Lunch','Chicken Momos (6)','Steamed, tomato achar',380,true,50),
  ('cafe','Lunch','Olakha Club Sandwich','Chicken, egg, salad, fries',450,true,60),
  ('cafe','Dinner','Ema Datshi Rice Bowl','Classic chili cheese with red rice',420,true,70),
  ('cafe','Dinner','Grilled Chicken Plate','Seasonal salad, mashed potato',520,true,80),
  ('pastry','Pastry','Butter Croissant','Baked fresh morning',90,true,90),
  ('pastry','Pastry','Cardamom Bun','Soft bun, local cardamom',95,true,100),
  ('pastry','Pastry','Dark Chocolate Brownie','Walnut, sea salt',150,true,110),
  ('pastry','Pastry','Apple Crumble Slice','Thimphu apple, oat topping',160,true,120)
) as v(outlet, category, name, description, price_btn, gst_applicable, sort_order)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from menu_items m where m.property_id = p.id and m.name = v.name
);
