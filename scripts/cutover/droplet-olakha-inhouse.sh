#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === in-house bookings olakha ===
SELECT b.id, b.confirmation_code, b.check_in, b.check_out, b.status
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in';

\echo === assignments for those ===
SELECT count(*) FROM public.room_assignments ra
WHERE ra.booking_id IN (
  SELECT b.id FROM public.bookings b
  JOIN public.properties p ON p.id=b.property_id
  WHERE p.slug='pelbu-olakha' AND b.status='checked_in'
);

\echo === any assignments recent ===
SELECT count(*) AS total_ra,
  count(*) FILTER (WHERE ra.to_date >= CURRENT_DATE) AS open_ra
FROM public.room_assignments ra
JOIN public.properties p ON p.id=ra.property_id
WHERE p.slug='pelbu-olakha';

\echo === folios for in-house ===
SELECT f.id, f.status, f.folio_type, f.label, b.confirmation_code
FROM public.folios f
JOIN public.bookings b ON b.id=f.booking_id
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in';

\echo === folio status distinct ===
SELECT f.status, count(*) FROM public.folios f
JOIN public.properties p ON p.id=f.property_id
WHERE p.slug='pelbu-olakha' GROUP BY 1;

\echo === booking_rooms for in-house ===
SELECT br.booking_id, rt.code, br.qty, br.meal_plan_code, br.agreed_nightly_rate_btn
FROM public.booking_rooms br
JOIN public.room_types rt ON rt.id=br.room_type_id
WHERE br.booking_id IN (
  SELECT b.id FROM public.bookings b
  JOIN public.properties p ON p.id=b.property_id
  WHERE p.slug='pelbu-olakha' AND b.status='checked_in'
);
SQL
