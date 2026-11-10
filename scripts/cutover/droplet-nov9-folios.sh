#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === all olakha with check_out = 2026-11-09 OR assignment to_date = 9 ===
WITH dep AS (
  SELECT DISTINCT b.id
  FROM public.bookings b
  JOIN public.properties p ON p.id=b.property_id
  WHERE p.slug='pelbu-olakha' AND b.check_out = DATE '2026-11-09'
    AND b.status NOT IN ('cancelled','no_show')
  UNION
  SELECT DISTINCT ra.booking_id
  FROM public.room_assignments ra
  JOIN public.properties p ON p.id=ra.property_id
  WHERE p.slug='pelbu-olakha' AND ra.to_date = DATE '2026-11-09'
)
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(NULLIF(a.login_code,''), a.company_name, 'WALK-IN') AS agent,
  (SELECT string_agg(ru.label, ',' ORDER BY ru.label)
   FROM public.room_assignments ra JOIN public.room_units ru ON ru.id=ra.room_unit_id
   WHERE ra.booking_id=b.id) AS rooms,
  b.agreed_nightly_rate_btn, b.meal_plan_code,
  (SELECT count(*) FROM public.folios f WHERE f.booking_id=b.id) AS folios,
  (SELECT coalesce(sum(fl.total_btn),0) FROM public.folio_lines fl
   JOIN public.folios f ON f.id=fl.folio_id
   WHERE f.booking_id=b.id AND fl.voided_at IS NULL) AS lines_total,
  (SELECT string_agg(fd.doc_no,',') FROM public.fiscal_documents fd
   JOIN public.folios f ON f.id=fd.folio_id WHERE f.booking_id=b.id) AS docs
FROM dep d
JOIN public.bookings b ON b.id=d.id
LEFT JOIN public.agents a ON a.id=b.agent_id
ORDER BY 5,1;

\echo === folio_lines columns ===
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='folio_lines'
AND column_name ~ 'amount|total|net|gross|qty|void|kind|description'
ORDER BY 1;

\echo === rack codes ST/VIP/YH bookings near 8 Nov via guest or notes ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out, a.company_name,
  (SELECT string_agg(ru.label,',') FROM public.room_assignments ra
   JOIN public.room_units ru ON ru.id=ra.room_unit_id WHERE ra.booking_id=b.id) rooms
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND (
    a.id IN ('1ba50c66-ef0f-48c3-995d-5c450e57a3ba','6f4ffe49-d5b5-4bac-bf1e-30f6be55d201')
    OR a.company_name ILIKE '%yak%'
    OR a.company_name ILIKE '%vip%'
  )
  AND b.check_in >= DATE '2026-11-01' AND b.check_in <= DATE '2026-11-10'
ORDER BY b.check_in;
SQL
