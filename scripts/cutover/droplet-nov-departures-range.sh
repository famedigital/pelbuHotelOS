#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === Olakha departures 7-10 Nov by day, agent ===
SELECT b.check_out::text AS out_day,
  COALESCE(NULLIF(a.company_name,''), 'WALK-IN') AS agent,
  count(*) AS bookings,
  coalesce(sum(sub.rooms),0) AS rooms,
  string_agg(b.confirmation_code || ' (' || b.status || ')', ', ' ORDER BY b.confirmation_code) AS refs
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
LEFT JOIN LATERAL (
  SELECT count(DISTINCT ra.room_unit_id)::int AS rooms
  FROM public.room_assignments ra WHERE ra.booking_id=b.id
) sub ON true
WHERE p.slug='pelbu-olakha'
  AND b.check_out BETWEEN DATE '2026-11-07' AND DATE '2026-11-10'
  AND b.status NOT IN ('cancelled','no_show','expired')
GROUP BY 1,2
ORDER BY 1,2;

\echo === count distinct agents per out day ===
SELECT b.check_out::text,
  count(DISTINCT coalesce(a.company_name, a.login_code, b.id::text)) AS groups,
  count(*) AS bookings,
  coalesce(sum(sub.rooms),0) AS rooms
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
LEFT JOIN LATERAL (
  SELECT count(DISTINCT ra.room_unit_id)::int AS rooms FROM public.room_assignments ra WHERE ra.booking_id=b.id
) sub ON true
WHERE p.slug='pelbu-olakha'
  AND b.check_out BETWEEN DATE '2026-11-07' AND DATE '2026-11-11'
  AND b.status NOT IN ('cancelled','no_show','expired')
GROUP BY 1 ORDER BY 1;

\echo === detail check_out = 8 Nov (largest day) ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(a.company_name,'WALK-IN') AS agent,
  b.meal_plan_code, b.agreed_nightly_rate_btn,
  (SELECT string_agg(ru.label, ',' ORDER BY ru.label)
   FROM public.room_assignments ra JOIN public.room_units ru ON ru.id=ra.room_unit_id
   WHERE ra.booking_id=b.id) AS rooms,
  (SELECT count(*) FROM public.booking_rooms br WHERE br.booking_id=b.id) AS booking_room_rows
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha' AND b.check_out = DATE '2026-11-08'
  AND b.status NOT IN ('cancelled','no_show')
ORDER BY agent, confirmation_code;
SQL
