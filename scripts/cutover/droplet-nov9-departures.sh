#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === Olakha departures check_out = 2026-11-09 ===
SELECT b.confirmation_code, b.status, b.check_in, b.check_out,
  COALESCE(a.login_code, a.company_name, 'WALKIN') AS agent,
  COALESCE(a.company_name,'') AS agent_name,
  (SELECT string_agg(DISTINCT ru.label, ', ' ORDER BY ru.label)
   FROM public.room_assignments ra
   JOIN public.room_units ru ON ru.id=ra.room_unit_id
   WHERE ra.booking_id=b.id) AS rooms,
  (SELECT string_agg(DISTINCT bg.full_name, ' / ' ORDER BY bg.full_name)
   FROM public.booking_guests bg WHERE bg.booking_id=b.id) AS guests,
  b.agreed_nightly_rate_btn,
  b.meal_plan_code,
  (SELECT coalesce(sum(fl.amount_btn),0)
   FROM public.folio_lines fl
   JOIN public.folios f ON f.id=fl.folio_id
   WHERE f.booking_id=b.id AND coalesce(fl.voided,false)=false) AS folio_total,
  (SELECT string_agg(DISTINCT f.id::text, ',') FROM public.folios f WHERE f.booking_id=b.id) AS folio_ids,
  (SELECT string_agg(fd.doc_no, ', ')
   FROM public.fiscal_documents fd
   JOIN public.folios f ON f.id=fd.folio_id
   WHERE f.booking_id=b.id) AS invoices
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
LEFT JOIN public.agents a ON a.id=b.agent_id
WHERE p.slug='pelbu-olakha'
  AND b.check_out = DATE '2026-11-09'
  AND b.status NOT IN ('cancelled','no_show','expired')
ORDER BY agent, b.confirmation_code;

\echo === agent codes YH ST VIP ===
SELECT login_code, company_name, contact_email
FROM public.agents
WHERE upper(login_code) IN ('YH','ST','VIP','SOULTRIPS','SOULTRIP')
   OR company_name ILIKE '%yh%'
   OR company_name ILIKE '%vip%'
   OR company_name ILIKE '%soul%'
ORDER BY login_code;

\echo === room units 502 301 302 ===
SELECT ru.label, rt.code
FROM public.room_units ru
JOIN public.room_types rt ON rt.id=ru.room_type_id
JOIN public.properties p ON p.id=ru.property_id
WHERE p.slug='pelbu-olakha' AND ru.label IN ('502','301','302');
SQL
