#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === departures check_out = 2026-11-09 by agent ===
SELECT COALESCE(NULLIF(a.login_code,''), NULLIF(a.company_name,''), 'WALK-IN') AS agent,
  count(*) AS bookings,
  sum((SELECT count(DISTINCT ra.room_unit_id) FROM public.room_assignments ra WHERE ra.booking_id=b.id)) AS rooms,
  string_agg(b.confirmation_code, ', ' ORDER BY b.confirmation_code) AS refs
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND b.check_out = DATE '2026-11-09'
  AND b.status NOT IN ('cancelled','no_show','expired')
GROUP BY 1
ORDER BY 1;

\echo === assignment end = 9 Nov by agent ===
SELECT COALESCE(NULLIF(a.login_code,''), NULLIF(a.company_name,''), 'WALK-IN') AS agent,
  count(DISTINCT b.id) AS bookings,
  count(DISTINCT ra.room_unit_id) AS rooms,
  string_agg(DISTINCT ru.label, ',' ORDER BY ru.label) AS room_list
FROM public.room_assignments ra
JOIN public.bookings b ON b.id=ra.booking_id
JOIN public.room_units ru ON ru.id=ra.room_unit_id
JOIN public.properties p ON p.id=ra.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha' AND ra.to_date = DATE '2026-11-09'
GROUP BY 1 ORDER BY 1;

\echo === check_out = 2026-11-08 (left morning 8th) groups — maybe user meant these? ===
SELECT COALESCE(NULLIF(a.company_name,''), 'WALK-IN') AS agent,
  count(*) AS bookings,
  string_agg(DISTINCT
    (SELECT string_agg(ru.label, ',') FROM public.room_assignments ra
     JOIN public.room_units ru ON ru.id=ra.room_unit_id WHERE ra.booking_id=b.id),
    ' | ') AS rooms
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND b.check_out = DATE '2026-11-08'
  AND b.status NOT IN ('cancelled','no_show')
GROUP BY 1 ORDER BY 1;
SQL
