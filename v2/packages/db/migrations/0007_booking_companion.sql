-- Sharing guest on the same room (primary remains bookings.guest_id → guests).
ALTER TABLE v2.bookings
  ADD COLUMN IF NOT EXISTS companion_name text,
  ADD COLUMN IF NOT EXISTS companion_passport_or_cid text,
  ADD COLUMN IF NOT EXISTS companion_nationality text;

COMMENT ON COLUMN v2.bookings.companion_name IS 'Optional sharing guest display name (max one companion per room)';
COMMENT ON COLUMN v2.bookings.companion_passport_or_cid IS 'Sharing guest passport / CID';
COMMENT ON COLUMN v2.bookings.companion_nationality IS 'Sharing guest nationality';
