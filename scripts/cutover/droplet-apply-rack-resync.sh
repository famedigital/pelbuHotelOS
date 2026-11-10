#!/usr/bin/env bash
set -euo pipefail
docker cp /tmp/_pelbu-rack-resync.sql supabase-db:/tmp/_pelbu-rack-resync.sql
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/_pelbu-rack-resync.sql
echo "=== summary ==="
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT status, count(*) FROM v2.bookings
WHERE property_id=(SELECT id FROM v2.properties WHERE slug='pelbu-olakha')
GROUP BY 1 ORDER BY 1;
"
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT meal_plan, count(*) FROM v2.booking_lines
WHERE property_id=(SELECT id FROM v2.properties WHERE slug='pelbu-olakha')
GROUP BY 1 ORDER BY 1;
"
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT count(*) AS groups,
       count(*) FILTER (WHERE (SELECT count(*) FROM v2.bookings b WHERE b.group_id=g.id)>1) AS multi_room_groups
FROM v2.groups g
WHERE property_id=(SELECT id FROM v2.properties WHERE slug='pelbu-olakha');
"
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT left(g.name,50) AS grp, count(b.id) AS rooms, min(b.check_in), max(b.check_out)
FROM v2.groups g
JOIN v2.bookings b ON b.group_id=g.id
WHERE g.property_id=(SELECT id FROM v2.properties WHERE slug='pelbu-olakha')
GROUP BY g.id, g.name
HAVING count(b.id)>1
ORDER BY count(b.id) DESC
LIMIT 8;
"
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT left(gu.full_name,36) guest, bl.meal_plan, a.name agent, left(b.notes,70) notes
FROM v2.bookings b
JOIN v2.guests gu ON gu.id=b.guest_id
JOIN v2.booking_lines bl ON bl.booking_id=b.id
LEFT JOIN v2.agents a ON a.id=b.agent_id
WHERE b.property_id=(SELECT id FROM v2.properties WHERE slug='pelbu-olakha')
  AND b.status='checked_in'
ORDER BY b.check_in
LIMIT 10;
"
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env restart hos-v2-api
sleep 6
curl -sf http://127.0.0.1:4200/health; echo
echo "rack resync done"
