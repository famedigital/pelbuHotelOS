-- POS RLS + indexes for dining_tables, modifiers, order_tenders, pos_voids
-- Desk path uses service_role. No anon write access on new tables.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists dining_tables_property_idx
  on dining_tables (property_id, status, sort_order);

create index if not exists menu_modifier_groups_item_idx
  on menu_modifier_groups (menu_item_id, sort_order);

create index if not exists menu_modifier_groups_property_idx
  on menu_modifier_groups (property_id);

create index if not exists menu_modifier_options_group_idx
  on menu_modifier_options (group_id, sort_order);

create index if not exists orders_table_idx
  on orders (table_id) where table_id is not null;

create index if not exists orders_parked_idx
  on orders (property_id, is_parked, created_at desc)
  where is_parked = true and voided_at is null;

create index if not exists orders_open_tickets_idx
  on orders (property_id, created_at desc)
  where voided_at is null
    and kot_status = any (array['new'::text, 'preparing'::text, 'ready'::text]);

create index if not exists order_items_order_idx
  on order_items (order_id);

create index if not exists order_tenders_order_idx
  on order_tenders (order_id);

create index if not exists pos_voids_property_idx
  on pos_voids (property_id, created_at desc);

create index if not exists pos_voids_order_idx
  on pos_voids (order_id);

create index if not exists menu_items_popular_idx
  on menu_items (property_id, outlet, is_popular)
  where is_popular = true and is_available = true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table dining_tables enable row level security;
alter table menu_modifier_groups enable row level security;
alter table menu_modifier_options enable row level security;
alter table order_tenders enable row level security;
alter table pos_voids enable row level security;

drop policy if exists "service_role full dining_tables" on dining_tables;
create policy "service_role full dining_tables" on dining_tables
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full menu_modifier_groups" on menu_modifier_groups;
create policy "service_role full menu_modifier_groups" on menu_modifier_groups
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full menu_modifier_options" on menu_modifier_options;
create policy "service_role full menu_modifier_options" on menu_modifier_options
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full order_tenders" on order_tenders;
create policy "service_role full order_tenders" on order_tenders
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full pos_voids" on pos_voids;
create policy "service_role full pos_voids" on pos_voids
  for all to service_role using (true) with check (true);

-- Public read of modifier groups/options for available menu items (public F&B pages)
drop policy if exists "public read menu_modifier_groups" on menu_modifier_groups;
create policy "public read menu_modifier_groups" on menu_modifier_groups
  for select to anon, authenticated
  using (
    exists (
      select 1 from menu_items mi
      where mi.id = menu_modifier_groups.menu_item_id
        and mi.is_available = true
    )
  );

drop policy if exists "public read menu_modifier_options" on menu_modifier_options;
create policy "public read menu_modifier_options" on menu_modifier_options
  for select to anon, authenticated
  using (
    exists (
      select 1
      from menu_modifier_groups g
      join menu_items mi on mi.id = g.menu_item_id
      where g.id = menu_modifier_options.group_id
        and mi.is_available = true
    )
  );
