#!/usr/bin/env bash
# Close overdue Olakha checked_in stays that never got room assignments/folios.
# Safe for cutover: check_out <= CURRENT_DATE, zero assignments, zero folios.
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
BEGIN;

CREATE TEMP TABLE orphan_olakha_inhouse ON COMMIT DROP AS
SELECT b.id, b.confirmation_code, b.check_in, b.check_out
FROM public.bookings b
JOIN public.properties p ON p.id = b.property_id
WHERE p.slug = 'pelbu-olakha'
  AND b.status = 'checked_in'
  AND b.check_out <= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM public.room_assignments ra WHERE ra.booking_id = b.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.folios f WHERE f.booking_id = b.id
  );

\echo === orphans to check out ===
SELECT * FROM orphan_olakha_inhouse ORDER BY check_in, confirmation_code;

UPDATE public.bookings b
SET status = 'checked_out'
FROM orphan_olakha_inhouse o
WHERE b.id = o.id;

-- Mirror into v2 (ETL only upserts active statuses)
UPDATE v2.bookings vb
SET status = 'checked_out',
    version = vb.version + 1
FROM orphan_olakha_inhouse o
WHERE vb.id = o.id;

DELETE FROM v2.room_assignments ra
USING v2.booking_lines bl, orphan_olakha_inhouse o
WHERE ra.booking_line_id = bl.id
  AND bl.booking_id = o.id;

\echo === remaining olakha checked_in ===
SELECT count(*) AS remaining_checked_in
FROM public.bookings b
JOIN public.properties p ON p.id = b.property_id
WHERE p.slug = 'pelbu-olakha' AND b.status = 'checked_in';

\echo === v2 mirror ===
SELECT count(*) FILTER (WHERE status = 'checked_in') AS v2_checked_in,
       count(*) FILTER (WHERE status = 'checked_out' AND id IN (SELECT id FROM orphan_olakha_inhouse)) AS v2_closed_orphans
FROM v2.bookings vb
JOIN v2.properties p ON p.id = vb.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha');

COMMIT;
SQL
