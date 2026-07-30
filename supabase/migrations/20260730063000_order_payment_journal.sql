-- Manual payment capture for confirmed public orders.
--
-- Pelbu does not use a WhatsApp Business API. The desk confirms an online
-- order, screenshots the confirmation slip, and asks the guest to pay by
-- mobile banking. When the transfer lands the guest sends the journal number
-- back on WhatsApp and the desk records it here — that record is what fires
-- the KOT, so the kitchen never cooks an unpaid online order.
alter table orders
  add column if not exists payment_journal_no text,
  add column if not exists payment_method text,
  add column if not exists payment_recorded_at timestamptz,
  add column if not exists payment_recorded_by uuid references staff_members(id) on delete set null;

comment on column orders.payment_journal_no is
  'Mobile-banking journal / transaction number the guest sent to the desk. Null until payment is recorded.';
comment on column orders.payment_method is
  'How the guest paid a public online order (mbob, bnb_mpay, bank_transfer, cash, card, other).';
comment on column orders.payment_recorded_at is
  'When the desk recorded payment for a public order. KOT fires from this moment.';
comment on column orders.payment_recorded_by is
  'Staff member who recorded the payment.';

alter table orders
  drop constraint if exists orders_payment_method_check;
alter table orders
  add constraint orders_payment_method_check
  check (
    payment_method is null
    or payment_method = any (
      array['mbob', 'bnb_mpay', 'bank_transfer', 'cash', 'card', 'other']
    )
  );

-- Desk lane: confirmed online orders still waiting for the journal number.
create index if not exists orders_awaiting_payment_idx
  on orders (property_id, confirmed_at)
  where order_source = 'public'
    and confirmed_at is not null
    and payment_recorded_at is null
    and voided_at is null;
