-- Add quoted_total_btn snapshot to bookings.
-- Captures the public-tier price the guest saw in the /book wizard preview
-- at submit time, so the quoted amount survives later rate changes.
-- Optional column: legacy createBooking path (no wizard) leaves it NULL.

alter table public.bookings
  add column if not exists quoted_total_btn numeric(14,2) null;

comment on column public.bookings.quoted_total_btn is
  'Snapshot of the public-tier stay total the guest saw in the /book wizard at submit time. NULL when booked via legacy single-form or desk fast-book.';
