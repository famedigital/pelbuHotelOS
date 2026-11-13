-- Occupancy counts for Print Studio / desk pax (nullable until desk captures).
ALTER TABLE v2.bookings
  ADD COLUMN IF NOT EXISTS adults integer,
  ADD COLUMN IF NOT EXISTS children integer;

ALTER TABLE v2.bookings
  DROP CONSTRAINT IF EXISTS bookings_adults_check;
ALTER TABLE v2.bookings
  ADD CONSTRAINT bookings_adults_check
  CHECK (adults IS NULL OR adults >= 0);

ALTER TABLE v2.bookings
  DROP CONSTRAINT IF EXISTS bookings_children_check;
ALTER TABLE v2.bookings
  ADD CONSTRAINT bookings_children_check
  CHECK (children IS NULL OR children >= 0);

COMMENT ON COLUMN v2.bookings.adults IS 'Adult pax on the stay; null until desk/booking captures';
COMMENT ON COLUMN v2.bookings.children IS 'Child pax on the stay; null until desk/booking captures';
