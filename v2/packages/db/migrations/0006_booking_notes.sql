-- Desk stay notes on bookings (StayView / StayHub hydrate).
ALTER TABLE v2.bookings
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN v2.bookings.notes IS 'FO stay notes captured at desk; survive hydrate';
