-- Stay hub payor split: agent (room package) vs guest (extras) on one folio

alter table folio_lines
  add column if not exists bill_to text not null default 'guest'
    check (bill_to in ('agent', 'guest'));

alter table folio_lines
  add column if not exists bill_to_set_by text,
  add column if not exists bill_to_reason text;

comment on column folio_lines.bill_to is
  'Who settles this charge: agent (room/package on credit) or guest (extras). Same folio.';

create index if not exists folio_lines_bill_to_idx
  on folio_lines (folio_id, bill_to)
  where status = 'posted';

-- Backfill: room + meal plan lines on bookings with agent_id → agent
-- when payment mode is credit / prepaid / partial
update folio_lines fl
set bill_to = 'agent'
from folios f
join bookings b on b.id = f.booking_id
where fl.folio_id = f.id
  and fl.bill_to = 'guest'
  and fl.source_type in ('room', 'meal_plan', 'cancel_fee', 'no_show_fee')
  and b.agent_id is not null
  and coalesce(b.payment_mode, '') in ('on_credit', 'prepaid', 'partial', 'agent_credit');
