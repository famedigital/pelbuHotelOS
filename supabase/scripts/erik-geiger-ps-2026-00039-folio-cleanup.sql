-- Erik Geiger PS-2026-00039 · room 203 — folio cleanup (ops)
-- Run only after desk confirms: void wrong posted nights, then repost 2× Nu 5165 EP.
-- Prefer StayHub UI (void + Set agreed rate EP + Preview/Post missing nights) once
-- Phase 0 balance trust is live. This script is a last-resort service-role ops aid.
--
-- Steps (manual review required):
-- 1) Find booking by confirmation_code
-- 2) List open folio lines (guest-visible vs void/reversal)
-- 3) Desk voids wrong room/meal lines via app (period PIN if locked)
-- 4) Set agreed_nightly_rate_btn = 5165, meal_plan_code = EP
-- 5) Post room nights for each stay night via night-audit poster
--
-- Do NOT invent a second INV without a credit note.

-- SELECT booking + open folio
-- SELECT b.id, b.confirmation_code, b.contact_name, b.status, b.agreed_nightly_rate_btn,
--        b.meal_plan_code, b.payment_mode, f.id AS folio_id
-- FROM bookings b
-- LEFT JOIN folios f ON f.booking_id = b.id AND f.status = 'open'
-- WHERE b.confirmation_code = 'PS-2026-00039';

-- SELECT guest-visible style check (posted non-reversal of voided)
-- SELECT fl.id, fl.status, fl.source_type, fl.total_btn, fl.reverses_line_id, fl.business_date, fl.description
-- FROM folio_lines fl
-- JOIN folios f ON f.id = fl.folio_id
-- JOIN bookings b ON b.id = f.booking_id
-- WHERE b.confirmation_code = 'PS-2026-00039'
-- ORDER BY fl.business_date, fl.created_at;

SELECT 'Use StayHub Folio on PS-2026-00039 after deploy — void → agreed 5165 EP → preview/post nights → reopen INV' AS next_step;
