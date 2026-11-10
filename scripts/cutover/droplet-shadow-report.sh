#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === SHADOW: rooms sellable ===
SELECT 'public' AS src, count(*)::int AS n FROM public.room_units ru
JOIN public.room_types rt ON rt.id=ru.room_type_id
JOIN public.properties p ON p.id=ru.property_id
WHERE p.slug='pelbu-olakha' AND rt.code NOT IN ('guide','driver')
UNION ALL
SELECT 'v2', count(*)::int FROM v2.rooms r
JOIN v2.room_types rt ON rt.id=r.room_type_id
JOIN v2.properties p ON p.id=r.property_id
WHERE p.slug='pelbu-olakha' AND rt.code NOT IN ('guide','driver');

\echo === SHADOW: active bookings ===
SELECT 'public' AS src, p.slug, count(*)::int
FROM public.bookings b JOIN public.properties p ON p.id=b.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
  AND b.status IN ('confirmed','held','checked_in')
GROUP BY 2
UNION ALL
SELECT 'v2', p.slug, count(*)::int
FROM v2.bookings b JOIN v2.properties p ON p.id=b.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
GROUP BY 2
ORDER BY 2,1;

\echo === SHADOW: missing booking ids (public not in v2) ===
SELECT count(*) AS missing
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
  AND b.status IN ('confirmed','held','checked_in')
  AND NOT EXISTS (SELECT 1 FROM v2.bookings vb WHERE vb.id=b.id);

\echo === SHADOW: staff can_login ===
SELECT 'public' AS src, p.slug, count(*)::int
FROM public.staff_members s JOIN public.properties p ON p.id=s.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
  AND COALESCE(s.status,'active') IN ('active','on_leave')
GROUP BY 2
UNION ALL
SELECT 'v2', p.slug, count(*)::int
FROM v2.staff s JOIN v2.properties p ON p.id=s.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha') AND s.can_login
GROUP BY 2 ORDER BY 2,1;

\echo === owner ===
SELECT email, role FROM v2.org_members WHERE email='pelbusuites@gmail.com';

\echo === in-house without assignments (risk) ===
SELECT p.slug, count(*)::int AS in_house_no_assign
FROM v2.bookings b
JOIN v2.properties p ON p.id=b.property_id
WHERE b.status='checked_in'
  AND NOT EXISTS (
    SELECT 1 FROM v2.booking_lines bl
    JOIN v2.room_assignments ra ON ra.booking_line_id=bl.id AND ra.active
    WHERE bl.booking_id=b.id
  )
GROUP BY 1;
SQL
