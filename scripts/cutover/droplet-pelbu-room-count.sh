#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT rt.code, rt.name, count(ru.*) AS units,
       count(*) FILTER (WHERE coalesce(ru.hk_status,'') <> 'ooo') AS not_ooo
FROM public.room_units ru
JOIN public.room_types rt ON rt.id = ru.room_type_id
JOIN public.properties p ON p.id = ru.property_id
WHERE p.slug = 'pelbu-olakha'
GROUP BY rt.code, rt.name
ORDER BY 1;
"
echo "=== sellable (exclude guide/driver) ==="
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT count(*) AS sellable
FROM public.room_units ru
JOIN public.room_types rt ON rt.id = ru.room_type_id
JOIN public.properties p ON p.id = ru.property_id
WHERE p.slug = 'pelbu-olakha'
  AND lower(rt.code) NOT IN ('guide','driver','d&g')
  AND lower(rt.name) NOT LIKE '%guide%'
  AND lower(rt.name) NOT LIKE '%driver%';
"
echo "=== v2 rooms same ==="
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT rt.code, count(r.*)
FROM v2.rooms r
JOIN v2.room_types rt ON rt.id = r.room_type_id
JOIN v2.properties p ON p.id = r.property_id
WHERE p.slug = 'pelbu-olakha'
GROUP BY rt.code ORDER BY 1;
"
