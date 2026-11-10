#!/usr/bin/env bash
# Delete UAT dummy bookings created during DEMO FO testing (keep seed inventory).
set -euo pipefail
PID=$(docker exec supabase-db psql -U postgres -d postgres -Atc "SELECT id FROM v2.properties WHERE slug='pelbu-suites-olakha'")
echo "DEMO pid=$PID"
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
BEGIN;
-- UAT markers from browser Fast Book / OpsMtx / UAT-* guests
CREATE TEMP TABLE uat_bk ON COMMIT DROP AS
SELECT b.id
FROM v2.bookings b
LEFT JOIN v2.guests g ON g.id = b.guest_id
WHERE b.property_id = '$PID'
  AND (
    b.confirmation_no ILIKE 'UAT-%'
    OR b.confirmation_no ILIKE 'DEMO-2026-%'
    OR coalesce(g.full_name,'') ILIKE 'UAT %'
    OR coalesce(g.full_name,'') ILIKE 'OpsMtx %'
    OR coalesce(b.source,'') = 'uat_browser'
  );

DELETE FROM v2.room_assignments ra
USING v2.booking_lines bl, uat_bk u
WHERE bl.id = ra.booking_line_id AND bl.booking_id = u.id;

DELETE FROM v2.folio_lines fl
USING v2.folios f, uat_bk u
WHERE fl.folio_id = f.id AND f.booking_id = u.id;

DELETE FROM v2.payments p
USING v2.folios f, uat_bk u
WHERE p.folio_id = f.id AND f.booking_id = u.id;

DELETE FROM v2.folios f USING uat_bk u WHERE f.booking_id = u.id;
DELETE FROM v2.booking_lines bl USING uat_bk u WHERE bl.booking_id = u.id;
DELETE FROM v2.bookings b USING uat_bk u WHERE b.id = u.id;

-- orphan UAT guests with no bookings
DELETE FROM v2.guests g
WHERE g.property_id = '$PID'
  AND (g.full_name ILIKE 'UAT %' OR g.full_name ILIKE 'OpsMtx %')
  AND NOT EXISTS (SELECT 1 FROM v2.bookings b WHERE b.guest_id = g.id);

SELECT count(*) AS remaining_uat FROM v2.bookings b
LEFT JOIN v2.guests g ON g.id=b.guest_id
WHERE b.property_id='$PID'
  AND (b.confirmation_no ILIKE 'UAT-%' OR coalesce(g.full_name,'') ILIKE 'UAT %' OR coalesce(g.full_name,'') ILIKE 'OpsMtx %');
COMMIT;
SQL
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env restart hos-v2-api
sleep 5
curl -sf http://127.0.0.1:4200/health; echo
echo "DEMO UAT cleanup done"
