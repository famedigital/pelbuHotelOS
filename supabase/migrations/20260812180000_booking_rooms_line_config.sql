-- Per-line meal / occupancy / pax / rate on booking_rooms (New booking multi-category).
-- Nullable columns inherit booking-level defaults for back-compat.

alter table booking_rooms
  add column if not exists meal_plan_code text,
  add column if not exists occupancy text
    check (occupancy is null or occupancy = any (array['single'::text, 'double'::text])),
  add column if not exists adults int check (adults is null or adults >= 1),
  add column if not exists children int check (children is null or children >= 0),
  add column if not exists extra_beds int check (extra_beds is null or extra_beds >= 0),
  add column if not exists sheet_nightly_rate_btn numeric(12, 2),
  add column if not exists agreed_nightly_rate_btn numeric(12, 2),
  add column if not exists rate_request_status text
    check (
      rate_request_status is null
      or rate_request_status = any (
        array['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]
      )
    ),
  add column if not exists rate_request_reason text;

-- Backfill from parent booking defaults where missing.
update booking_rooms br
set
  meal_plan_code = coalesce(br.meal_plan_code, b.meal_plan_code, 'EP'),
  adults = coalesce(br.adults, greatest(1, coalesce(b.adults, 1))),
  children = coalesce(br.children, greatest(0, coalesce(b.children, 0))),
  extra_beds = coalesce(br.extra_beds, greatest(0, coalesce(b.extra_beds, 0))),
  occupancy = coalesce(
    br.occupancy,
    case when coalesce(b.adults, 2) <= 1 then 'single' else 'double' end
  ),
  rate_request_status = coalesce(br.rate_request_status, 'none'),
  agreed_nightly_rate_btn = coalesce(
    br.agreed_nightly_rate_btn,
    b.agreed_nightly_rate_btn
  )
from bookings b
where b.id = br.booking_id
  and (
    br.meal_plan_code is null
    or br.adults is null
    or br.children is null
    or br.extra_beds is null
    or br.occupancy is null
    or br.rate_request_status is null
  );

comment on column booking_rooms.agreed_nightly_rate_btn is
  'Per-category negotiated nightly (null = use sheet / booking agreed).';
comment on column booking_rooms.rate_request_status is
  'none | pending | approved | rejected — GM queue for custom rates.';
