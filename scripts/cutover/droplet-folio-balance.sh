#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
SELECT p.slug, count(DISTINCT f.id) AS open_folios,
  coalesce(sum(CASE WHEN fl.voided_at IS NULL THEN fl.total_btn ELSE 0 END),0) AS line_total
FROM public.folios f
JOIN public.bookings b ON b.id=f.booking_id
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.folio_lines fl ON fl.folio_id=f.id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
  AND b.status IN ('checked_in','confirmed')
  AND f.status='open'
GROUP BY 1;

SELECT f.folio_type, count(*) FROM public.folios f
JOIN public.bookings b ON b.id=f.booking_id
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in'
GROUP BY 1;

-- assignment sample
SELECT ra.booking_id, ru.label, ra.from_date, ra.to_date, ra.chargeable
FROM public.room_assignments ra
JOIN public.room_units ru ON ru.id=ra.room_unit_id
JOIN public.bookings b ON b.id=ra.booking_id
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in'
LIMIT 10;
SQL
