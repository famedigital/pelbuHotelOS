-- Cover POS stock/shift foreign keys flagged by the Postgres advisor.
create index if not exists menu_stock_profiles_inventory_item_idx
  on menu_stock_profiles (inventory_item_id)
  where inventory_item_id is not null;
create index if not exists menu_recipe_items_inventory_item_idx
  on menu_recipe_items (inventory_item_id);
create index if not exists menu_recipe_items_property_idx
  on menu_recipe_items (property_id);

create index if not exists inventory_movements_order_item_idx
  on inventory_movements (order_item_id)
  where order_item_id is not null;

create index if not exists pos_shifts_opened_by_idx
  on pos_shifts (opened_by)
  where opened_by is not null;
create index if not exists pos_shifts_closed_by_idx
  on pos_shifts (closed_by)
  where closed_by is not null;
create index if not exists pos_shifts_manager_approved_by_idx
  on pos_shifts (manager_approved_by)
  where manager_approved_by is not null;

create index if not exists orders_room_unit_idx
  on orders (room_unit_id)
  where room_unit_id is not null;
create index if not exists orders_booking_guest_idx
  on orders (booking_guest_id)
  where booking_guest_id is not null;
