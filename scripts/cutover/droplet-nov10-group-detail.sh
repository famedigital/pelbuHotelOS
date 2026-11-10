#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === FULL group departures check_out = 2026-11-10 ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(a.company_name, a.login_code, 'WALK-IN') AS agent,
  a.login_code,
  b.meal_plan_code,
  b.agreed_nightly_rate_btn,
  (SELECT string_agg(ru.label, ',' ORDER BY ru.label)
   FROM public.room_assignments ra JOIN public.room_units ru ON ru.id=ra.room_unit_id
   WHERE ra.booking_id=b.id) AS rooms,
  (SELECT count(DISTINCT ra.room_unit_id)
   FROM public.room_assignments ra WHERE ra.booking_id=b.id) AS n_rooms,
  (SELECT string_agg(DISTINCT bg.full_name, ' / ' ORDER BY bg.full_name)
   FROM public.booking_guests bg WHERE bg.booking_id=b.id) AS guests,
  (SELECT string_agg(rt.code || '×' || br.qty::text || coalesce(' @'||br.agreed_nightly_rate_btn::text,''), ', ')
   FROM public.booking_rooms br JOIN public.room_types rt ON rt.id=br.room_type_id
   WHERE br.booking_id=b.id) AS booking_rooms,
  (SELECT coalesce(sum(fl.amount_btn),0) FROM public.folio_lines fl
   JOIN public.folios f ON f.id=fl.folio_id WHERE f.booking_id=b.id AND fl.voided_at IS NULL) AS folio_sum,
  (SELECT string_agg(fd.doc_no, ',') FROM public.fiscal_documents fd
   JOIN public.folios f ON f.id=fd.folio_id WHERE f.booking_id=b.id) AS invoices
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND b.check_out = DATE '2026-11-10'
  AND b.status NOT IN ('cancelled','no_show','expired')
ORDER BY agent, confirmation_code;

\echo === also morning-9 leftovers (YH/ST/VIP) if still open ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(a.company_name,'WALK-IN') agent,
  (SELECT string_agg(ru.label,',') FROM public.room_assignments ra
   JOIN public.room_units ru ON ru.id=ra.room_unit_id WHERE ra.booking_id=b.id) rooms
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND b.confirmation_code IN ('PS-2026-00244','PSBK-2026-00104')
     OR (a.company_name ILIKE '%soul%' AND b.check_out = DATE '2026-11-09')
ORDER BY 1;
SQL
