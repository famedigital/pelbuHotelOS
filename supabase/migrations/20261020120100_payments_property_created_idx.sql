-- Speed Bills hub payment history (property + created_at range).
create index if not exists payments_property_created_idx
  on payments (property_id, created_at desc);
