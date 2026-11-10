#!/usr/bin/env bash
set -euo pipefail
docker cp /tmp/_xlsx-notes-enrich.sql supabase-db:/tmp/_xlsx-notes-enrich.sql
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/_xlsx-notes-enrich.sql
echo "=== sample notes ==="
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT left(g.full_name,40) AS guest, b.status, b.check_in, left(b.notes,90) AS notes
FROM v2.bookings b
JOIN v2.guests g ON g.id = b.guest_id
JOIN v2.properties p ON p.id = b.property_id
WHERE p.slug = 'pelbu-olakha' AND b.source = 'xlsx_grid'
ORDER BY length(coalesce(b.notes,'')) DESC
LIMIT 8;
"
echo "=== counts ==="
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT
  count(*) AS bookings,
  count(*) FILTER (WHERE length(coalesce(notes,'')) > 80) AS rich_notes,
  count(*) FILTER (WHERE status = 'checked_in') AS in_house
FROM v2.bookings
WHERE property_id = (SELECT id FROM v2.properties WHERE slug = 'pelbu-olakha')
  AND source = 'xlsx_grid';
"
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env restart hos-v2-api
sleep 5
curl -sf http://127.0.0.1:4200/health
echo
echo "notes enrich + API restart done"
