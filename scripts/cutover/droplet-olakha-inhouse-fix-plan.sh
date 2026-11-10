#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\echo === server date ===
SELECT CURRENT_DATE, now();

\echo === currently overlapping assignments for orphan stay windows ===
WITH orphans AS (
  SELECT b.id, b.confirmation_code, b.check_in, b.check_out, br.room_type_id, rt.code AS room_type
  FROM public.bookings b
  JOIN public.properties p ON p.id=b.property_id
  LEFT JOIN public.booking_rooms br ON br.booking_id=b.id
  LEFT JOIN public.room_types rt ON rt.id=br.room_type_id
  WHERE p.slug='pelbu-olakha' AND b.status='checked_in'
)
SELECT o.confirmation_code, o.check_in, o.check_out, o.room_type,
  (SELECT count(*) FROM public.room_units ru
   JOIN public.room_types rt2 ON rt2.id=ru.room_type_id
   JOIN public.properties p2 ON p2.id=ru.property_id
   WHERE p2.slug='pelbu-olakha' AND rt2.code=o.room_type
     AND coalesce(ru.is_sellable,true)
     AND NOT EXISTS (
       SELECT 1 FROM public.room_assignments ra
       WHERE ra.room_unit_id=ru.id
         AND ra.from_date < o.check_out AND ra.to_date > o.check_in
     )) AS free_matching_units
FROM orphans o
ORDER BY o.check_in, o.confirmation_code;

\echo === true live in-house (check_out > today) ===
SELECT count(*) FILTER (WHERE check_out > CURRENT_DATE) AS future_or_today_out,
       count(*) FILTER (WHERE check_out <= CURRENT_DATE) AS overdue_checked_in,
       count(*) AS total_checked_in
FROM public.bookings b
JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in';

\echo === rooms free tonight (no overlap with CURRENT_DATE..+1) ===
SELECT ru.label, rt.code
FROM public.room_units ru
JOIN public.room_types rt ON rt.id=ru.room_type_id
JOIN public.properties p ON p.id=ru.property_id
WHERE p.slug='pelbu-olakha'
  AND coalesce(ru.is_sellable,true)
  AND NOT EXISTS (
    SELECT 1 FROM public.room_assignments ra
    WHERE ra.room_unit_id=ru.id
      AND ra.from_date <= CURRENT_DATE AND ra.to_date > CURRENT_DATE
  )
ORDER BY ru.label;

\echo === room_assignments columns ===
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='room_assignments'
ORDER BY ordinal_position;

\echo === folios columns key ===
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='folios'
AND column_name IN ('id','property_id','booking_id','status','folio_type','label','agent_id','created_at')
ORDER BY 1;
SQL
