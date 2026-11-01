-- Enterprise perf indexes (TECH-STACK-UPGRADES §4) — real schema only.
-- Transactional CREATE INDEX IF NOT EXISTS (no CONCURRENTLY).

CREATE INDEX IF NOT EXISTS bookings_property_cin_cout_status_idx
  ON public.bookings (property_id, check_in, check_out, status);

CREATE INDEX IF NOT EXISTS folio_lines_folio_status_idx
  ON public.folio_lines (folio_id, status);

CREATE INDEX IF NOT EXISTS folio_lines_booking_status_idx
  ON public.folio_lines (booking_id, status)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS room_units_property_type_hk_idx
  ON public.room_units (property_id, room_type_id, hk_status);

CREATE INDEX IF NOT EXISTS booking_guests_passport_idx
  ON public.booking_guests (passport_or_cid)
  WHERE passport_or_cid IS NOT NULL AND length(trim(passport_or_cid)) > 0;
