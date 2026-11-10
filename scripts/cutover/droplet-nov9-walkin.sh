#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
SELECT b.confirmation_code, b.check_in, b.check_out, b.agreed_nightly_rate_btn, b.meal_plan_code,
  (SELECT string_agg(bg.full_name, ' / ') FROM public.booking_guests bg WHERE bg.booking_id=b.id) AS guests,
  (SELECT string_agg(ru.label, ',') FROM public.room_assignments ra
   JOIN public.room_units ru ON ru.id=ra.room_unit_id WHERE ra.booking_id=b.id) AS rooms,
  (SELECT coalesce(sum(fl.amount_btn),0) FROM public.folio_lines fl
   JOIN public.folios f ON f.id=fl.folio_id WHERE f.booking_id=b.id AND fl.voided_at IS NULL) AS folio_sum
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.confirmation_code='PSBK-2026-00104';

-- YH booking guests
SELECT b.confirmation_code, bg.full_name, bg.sort_order
FROM public.bookings b
JOIN public.booking_guests bg ON bg.booking_id=b.id
WHERE b.confirmation_code='PS-2026-00244'
ORDER BY bg.sort_order;
SQL
