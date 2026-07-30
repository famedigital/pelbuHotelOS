-- Online order confirmation gate.
--
-- Public orders land as `status = 'received'`. The desk reviews them,
-- collects payment (screenshot / QR), then confirms. Until `confirmed_at`
-- is set the order sits in a "pending confirm" lane on POS / dashboard and
-- does NOT enter the kitchen workflow (`kot_status` stays 'new' but the
-- order is gated by the absence of `confirmed_at`).
--
-- `confirmed_by` is the staff member who acknowledged the order so we can
-- trace accountability (audit_events already records the action).

alter table orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references staff_members(id) on delete set null;

comment on column orders.confirmed_at is
  'When the desk confirmed a public online order (after collecting payment). Null until confirmed.';
comment on column orders.confirmed_by is
  'Staff member who confirmed the public order. Null for desk-origin orders.';

create index if not exists orders_pending_confirm_idx
  on orders (property_id, order_source, confirmed_at)
  where order_source = 'public' and confirmed_at is null and voided_at is null;
