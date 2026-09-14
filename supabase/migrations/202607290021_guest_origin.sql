-- 202607290021_guest_origin.sql
-- Add bookings.guest_origin to drive conditional guide/SDF requirements.
-- International tourists need a guide; regional / official / local guests often do not.

alter table bookings
  add column if not exists guest_origin text
  default 'international'
  check (guest_origin = any (array[
    'international'::text,
    'regional'::text,
    'official'::text,
    'local'::text
  ]));

-- Backfill any pre-existing rows to the safest default (most bookings are tourists).
update bookings set guest_origin = 'international' where guest_origin is null;

-- Index for future market-mix / night-audit reporting.
create index if not exists bookings_guest_origin_idx on bookings(guest_origin);
