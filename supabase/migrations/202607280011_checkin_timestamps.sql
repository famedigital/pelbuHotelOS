-- P2b: check-in / check-out timestamps on bookings

alter table bookings
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_out_at timestamptz;
