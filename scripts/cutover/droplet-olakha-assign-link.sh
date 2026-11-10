#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === open assignments sample ===
SELECT ra.id, ra.booking_id, b.confirmation_code, b.status, ru.label, ra.from_date, ra.to_date
FROM public.room_assignments ra
JOIN public.room_units ru ON ru.id=ra.room_unit_id
JOIN public.bookings b ON b.id=ra.booking_id
JOIN public.properties p ON p.id=ra.property_id
WHERE p.slug='pelbu-olakha' AND ra.to_date >= CURRENT_DATE
ORDER BY ra.from_date DESC
LIMIT 15;

\echo === folios open with booking status ===
SELECT b.status, count(DISTINCT f.id)
FROM public.folios f
JOIN public.bookings b ON b.id=f.booking_id
JOIN public.properties p ON p.id=f.property_id
WHERE p.slug='pelbu-olakha' AND f.status='open'
GROUP BY 1;

\echo === guests for in-house ===
SELECT bg.booking_id, bg.full_name, bg.sort_order
FROM public.booking_guests bg
WHERE bg.booking_id IN (
  SELECT b.id FROM public.bookings b
  JOIN public.properties p ON p.id=b.property_id
  WHERE p.slug='pelbu-olakha' AND b.status='checked_in'
)
ORDER BY 1,3;
SQL
