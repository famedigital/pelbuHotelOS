-- Online order Thimphu gate: capture the chosen delivery area separately from
-- the free-text landmark address so reporting + dispatch can group by zone.
alter table orders
  add column if not exists delivery_area text;

comment on column orders.delivery_area is
  'Thimphu delivery zone for taxi orders (e.g. Olakha, Motithang). Null for pickup.';

create index if not exists orders_delivery_area_idx
  on orders (property_id, delivery_type, delivery_area);
