-- Property-scoped F&B outlets (cafe, pastry, rooftop, …).
-- Soft-archive only: is_active = false. Historical orders keep their outlet code.

create table if not exists property_outlets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null
    check (
      code ~ '^[a-z][a-z0-9_]{0,31}$'
      and code !~ '^_+|__+|__$'
    ),
  name text not null check (char_length(trim(name)) between 1 and 40),
  is_active boolean not null default true,
  sort_order int not null default 0
    check (sort_order >= 0 and sort_order <= 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code)
);

comment on table property_outlets is
  'F&B outlets per property. Archive with is_active=false; never hard-delete when history exists.';

create index if not exists property_outlets_property_active_idx
  on property_outlets (property_id, is_active, sort_order, name);

-- Seed the four legacy outlets for every property.
insert into property_outlets (property_id, code, name, is_active, sort_order)
select
  p.id,
  v.code,
  v.name,
  true,
  v.sort_order
from properties p
cross join (
  values
    ('cafe', 'Cafe', 10),
    ('pastry', 'Pastry', 20),
    ('restaurant', 'Restaurant', 30),
    ('bar', 'Bar', 40)
) as v(code, name, sort_order)
on conflict (property_id, code) do nothing;

-- Also ensure any orphan codes already used on menu/orders/tables/hours exist.
insert into property_outlets (property_id, code, name, is_active, sort_order)
select distinct
  mi.property_id,
  mi.outlet,
  initcap(replace(mi.outlet, '_', ' ')),
  true,
  100
from menu_items mi
where not exists (
  select 1 from property_outlets po
  where po.property_id = mi.property_id and po.code = mi.outlet
);

insert into property_outlets (property_id, code, name, is_active, sort_order)
select distinct
  o.property_id,
  o.outlet,
  initcap(replace(o.outlet, '_', ' ')),
  true,
  100
from orders o
where not exists (
  select 1 from property_outlets po
  where po.property_id = o.property_id and po.code = o.outlet
);

insert into property_outlets (property_id, code, name, is_active, sort_order)
select distinct
  dt.property_id,
  dt.outlet,
  initcap(replace(dt.outlet, '_', ' ')),
  true,
  100
from dining_tables dt
where dt.outlet is not null
  and not exists (
    select 1 from property_outlets po
    where po.property_id = dt.property_id and po.code = dt.outlet
  );

insert into property_outlets (property_id, code, name, is_active, sort_order)
select distinct
  oh.property_id,
  oh.outlet,
  initcap(replace(oh.outlet, '_', ' ')),
  true,
  100
from outlet_hours oh
where not exists (
  select 1 from property_outlets po
  where po.property_id = oh.property_id and po.code = oh.outlet
);

-- Drop closed enum CHECKs so custom outlet codes are allowed.
alter table menu_items drop constraint if exists menu_items_outlet_check;
alter table orders drop constraint if exists orders_outlet_check;
alter table dining_tables drop constraint if exists dining_tables_outlet_check;
alter table outlet_hours drop constraint if exists outlet_hours_outlet_check;

-- Composite FKs: outlet codes must exist for the property (null dining table outlet OK).
alter table menu_items
  add constraint menu_items_property_outlet_fkey
  foreign key (property_id, outlet)
  references property_outlets (property_id, code)
  on update cascade
  on delete restrict;

alter table orders
  add constraint orders_property_outlet_fkey
  foreign key (property_id, outlet)
  references property_outlets (property_id, code)
  on update cascade
  on delete restrict;

alter table dining_tables
  add constraint dining_tables_property_outlet_fkey
  foreign key (property_id, outlet)
  references property_outlets (property_id, code)
  on update cascade
  on delete restrict;

alter table outlet_hours
  add constraint outlet_hours_property_outlet_fkey
  foreign key (property_id, outlet)
  references property_outlets (property_id, code)
  on update cascade
  on delete restrict;

alter table property_outlets enable row level security;

drop policy if exists "public read active property_outlets" on property_outlets;
create policy "public read active property_outlets" on property_outlets
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists "service_role full property_outlets" on property_outlets;
create policy "service_role full property_outlets" on property_outlets
  for all to service_role
  using (true)
  with check (true);
