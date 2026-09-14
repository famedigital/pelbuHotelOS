-- POS floor plan: scope dining tables to an outlet so cafe / restaurant / bar
-- each get their own table map. Null outlet = shared across outlets.

alter table dining_tables
  add column if not exists outlet text
    check (outlet is null or outlet = any (array[
      'cafe'::text,
      'pastry'::text,
      'restaurant'::text,
      'bar'::text
    ]));

comment on column dining_tables.outlet is
  'Outlet this table belongs to. Null = shared / visible on every outlet floor plan.';

create index if not exists dining_tables_outlet_idx
  on dining_tables (property_id, outlet, status, sort_order);
