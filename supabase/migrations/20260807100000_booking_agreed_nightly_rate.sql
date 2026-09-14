-- Manager-approved special nightly rate for regulars / negotiated stays.
-- When set, night-audit and day-1 room posting use this listed amount
-- (same tax inclusion basis as room_rates) instead of looking up the rate sheet.

alter table public.bookings
  add column if not exists agreed_nightly_rate_btn numeric(12, 2)
    check (
      agreed_nightly_rate_btn is null or agreed_nightly_rate_btn >= 0
    ),
  add column if not exists agreed_rate_reason text,
  add column if not exists agreed_rate_set_at timestamptz,
  add column if not exists agreed_rate_set_by text;

comment on column public.bookings.agreed_nightly_rate_btn is
  'Manager-approved nightly room rate (BTN). When set, overrides room_rates for folio room-night posts. Same tax inclusion basis as rates sheet.';

comment on column public.bookings.agreed_rate_reason is
  'Why this special rate was approved (regular client, complimentary partial, etc.).';

comment on column public.bookings.agreed_rate_set_at is
  'When the agreed rate was last set or cleared.';

comment on column public.bookings.agreed_rate_set_by is
  'Audit: env manager pin, or staff name/id who approved.';
