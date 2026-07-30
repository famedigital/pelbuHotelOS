-- Allow re-preparing bags: voided rows may keep old bag_seq values.
alter table laundry_order_bags drop constraint if exists laundry_order_bags_order_id_bag_seq_key;
create unique index if not exists laundry_bags_active_seq_uidx
  on laundry_order_bags (order_id, bag_seq)
  where status <> 'voided';
