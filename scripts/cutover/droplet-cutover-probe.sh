#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === booking status counts ===
SELECT p.slug, b.status, count(*)
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
GROUP BY 1,2 ORDER BY 1,2;

\echo === active window ===
SELECT p.slug,
  count(*) FILTER (WHERE b.status IN ('confirmed','held')) AS future_confirmed,
  count(*) FILTER (WHERE b.status = 'checked_in') AS in_house
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
GROUP BY 1;

\echo === booking key cols ===
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='bookings'
AND column_name ~ '^(id|status|check_|guest|agent|rate|meal|property|room|folio|agreed|party|confirmation|primary)'
ORDER BY ordinal_position;

\echo === room_assignments public? ===
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name ILIKE '%assign%' ORDER BY 1;

\echo === folio tables ===
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND (table_name ILIKE '%folio%' OR table_name ILIKE '%booking_guest%') ORDER BY 1;

\echo === owner auth ===
SELECT id, email FROM auth.users WHERE lower(email)='pelbusuites@gmail.com';

\echo === sequences sample ===
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='property_sequences' ORDER BY 1;
SQL
