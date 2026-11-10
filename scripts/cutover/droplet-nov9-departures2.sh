#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === assignments ending 9 Nov (to_date = 9) olakha ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(NULLIF(a.login_code,''), a.company_name, 'WALKIN') AS agent,
  ru.label AS room,
  ra.from_date, ra.to_date,
  b.agreed_nightly_rate_btn, b.meal_plan_code
FROM public.room_assignments ra
JOIN public.bookings b ON b.id=ra.booking_id
JOIN public.room_units ru ON ru.id=ra.room_unit_id
JOIN public.properties p ON p.id=ra.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND ra.to_date = DATE '2026-11-09'
ORDER BY ru.label;

\echo === assignments overlapping night of 8 Nov ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(NULLIF(a.login_code,''), a.company_name, 'WALKIN') AS agent,
  ru.label AS room, ra.from_date, ra.to_date,
  b.agreed_nightly_rate_btn
FROM public.room_assignments ra
JOIN public.bookings b ON b.id=ra.booking_id
JOIN public.room_units ru ON ru.id=ra.room_unit_id
JOIN public.properties p ON p.id=ra.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND ra.from_date <= DATE '2026-11-08'
  AND ra.to_date > DATE '2026-11-08'
  AND ru.label IN ('301','302','502','207','307','407','506')
ORDER BY ru.label;

\echo === bookings mentioning YH/ST/VIP or check around 7-9 Nov ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(NULLIF(a.login_code,''), a.company_name,'') AS agent,
  a.company_name,
  b.agreed_nightly_rate_btn, b.meal_plan_code,
  (SELECT string_agg(ru.label, ',') FROM public.room_assignments ra
   JOIN public.room_units ru ON ru.id=ra.room_unit_id WHERE ra.booking_id=b.id) AS rooms
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND b.status NOT IN ('cancelled')
  AND (
    b.check_out BETWEEN DATE '2026-11-08' AND DATE '2026-11-10'
    OR b.check_in BETWEEN DATE '2026-11-07' AND DATE '2026-11-09'
    OR upper(coalesce(a.company_name,'')) IN ('YH','ST','VIP')
    OR upper(coalesce(a.login_code,'')) IN ('YH','ST','VIP')
  )
ORDER BY b.check_out, b.confirmation_code;

\echo === agents company YH ST VIP exact ===
SELECT id, login_code, company_name FROM public.agents
WHERE upper(trim(company_name)) IN ('YH','ST','VIP')
   OR upper(trim(login_code)) IN ('YH','ST','VIP');
SQL
