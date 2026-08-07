-- In-house mobile orders: charge to room (public menu).
alter table public.orders
  drop constraint if exists orders_delivery_type_check;

alter table public.orders
  add constraint orders_delivery_type_check
  check (
    delivery_type = any (
      array['pickup'::text, 'taxi'::text, 'room'::text]
    )
  );

comment on column public.orders.delivery_type is
  'pickup | taxi | room (in-house charge to folio after room+phone verify).';
