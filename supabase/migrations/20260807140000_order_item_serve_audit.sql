-- Per-item serve audit + order-level served-by for KOT pass / front-desk reconciliation.
-- Desk money collection shows room-charge items so staff can correct voids with clear audit.

alter table public.orders
  add column if not exists ready_at timestamptz,
  add column if not exists ready_by text,
  add column if not exists served_at timestamptz,
  add column if not exists served_by text;

comment on column public.orders.ready_at is
  'When KOT was marked ready (pass / expo handoff).';
comment on column public.orders.ready_by is
  'Staff/desk name who marked the ticket ready.';
comment on column public.orders.served_at is
  'When the pass marked food served to guest.';
comment on column public.orders.served_by is
  'Staff/desk name who marked served — audit for guest disputes.';

alter table public.order_items
  add column if not exists kot_status text not null default 'new'
    check (
      kot_status = any (
        array[
          'new'::text,
          'preparing'::text,
          'ready'::text,
          'served'::text,
          'cancelled'::text
        ]
      )
    ),
  add column if not exists ready_at timestamptz,
  add column if not exists ready_by text,
  add column if not exists served_at timestamptz,
  add column if not exists served_by text;

comment on column public.order_items.kot_status is
  'Item prep/serve status (mirrors order KOT flow). Per-line serve audit for voids after KOT.';
comment on column public.order_items.served_at is
  'When this line was confirmed served to the guest.';
comment on column public.order_items.served_by is
  'Who marked this line served (pass, waiter, or desk).';

create index if not exists order_items_kot_status_idx
  on public.order_items (order_id, kot_status)
  where voided_at is null;

-- Backfill item status from parent order for live room tickets.
update public.order_items oi
set kot_status = case
  when oi.voided_at is not null then 'cancelled'
  when o.kot_status in ('new', 'preparing', 'ready', 'served', 'cancelled')
    then o.kot_status
  else 'new'
end,
ready_at = coalesce(oi.ready_at, case when o.kot_status in ('ready', 'served') then o.settled_at end),
served_at = coalesce(oi.served_at, case when o.kot_status = 'served' then o.settled_at end)
from public.orders o
where o.id = oi.order_id
  and oi.kot_status = 'new'
  and o.kot_status is not null
  and o.kot_status <> 'new';
