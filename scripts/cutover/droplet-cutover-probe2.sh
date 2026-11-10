#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === room_assignments cols ===
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='room_assignments' ORDER BY ordinal_position;

\echo === booking_rooms cols ===
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='booking_rooms' ORDER BY ordinal_position;

\echo === booking_guests cols ===
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='booking_guests' ORDER BY ordinal_position;

\echo === folios cols ===
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='folios' ORDER BY ordinal_position;

\echo === folio_lines cols ===
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='folio_lines' ORDER BY ordinal_position;

\echo === open folio balances (olakha in-house) ===
SELECT p.slug, count(DISTINCT f.id) AS open_folios,
  coalesce(sum(fl.total_amount_btn),0) AS line_total
FROM public.folios f
JOIN public.bookings b ON b.id=f.booking_id
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.folio_lines fl ON fl.folio_id=f.id AND coalesce(fl.voided,false)=false
WHERE p.slug='pelbu-olakha' AND b.status='checked_in' AND f.status='open'
GROUP BY 1;

\echo === sequences ===
SELECT p.slug, ps.kind, ps.last_value
FROM public.property_sequences ps
JOIN public.properties p ON p.id=ps.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
ORDER BY 1,2;

\echo === sample in-house booking ===
SELECT b.id, b.confirmation_code, b.status, b.check_in, b.check_out, b.meal_plan_code,
       b.agreed_nightly_rate_btn, b.agent_id IS NOT NULL AS has_agent
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in'
LIMIT 5;
SQL
