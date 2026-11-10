#!/usr/bin/env bash
set -euo pipefail
DB=(docker exec supabase-db psql -U postgres -d postgres)

echo "=== public FO-ish tables ==="
"${DB[@]}" -tAc "
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND (
    table_name ILIKE '%room%'
    OR table_name ILIKE '%book%'
    OR table_name ILIKE '%guest%'
    OR table_name ILIKE '%folio%'
    OR table_name ILIKE '%agent%'
    OR table_name ILIKE '%assign%'
    OR table_name ILIKE '%rate%'
  )
ORDER BY 1;
"

echo "=== bookings count by status ==="
"${DB[@]}" -c "SELECT status, count(*) FROM public.bookings GROUP BY 1 ORDER BY 2 DESC;" 2>&1 || true

echo "=== booking columns sample ==="
"${DB[@]}" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' ORDER BY ordinal_position LIMIT 40;" 2>&1 || true

echo "=== guests count ==="
"${DB[@]}" -c "SELECT count(*) AS guests FROM public.guests;" 2>&1 || true

echo "=== agents count ==="
"${DB[@]}" -c "SELECT count(*) AS agents FROM public.agents;" 2>&1 || true

echo "=== room_assignments / booking_rooms ==="
"${DB[@]}" -c "SELECT count(*) FROM public.room_assignments;" 2>&1 || true
"${DB[@]}" -c "SELECT count(*) FROM public.booking_rooms;" 2>&1 || true
"${DB[@]}" -c "SELECT count(*) FROM public.rooms;" 2>&1 || true
"${DB[@]}" -c "SELECT count(*) FROM public.property_rooms;" 2>&1 || true

echo "=== room type tables ==="
"${DB[@]}" -c "SELECT count(*) FROM public.room_types;" 2>&1 || true
"${DB[@]}" -c "SELECT count(*) FROM public.property_room_types;" 2>&1 || true

echo "=== folio tables ==="
"${DB[@]}" -c "SELECT count(*) FROM public.folios;" 2>&1 || true
"${DB[@]}" -c "SELECT count(*) FROM public.folio_lines;" 2>&1 || true
"${DB[@]}" -c "SELECT count(*) FROM public.folio_charges;" 2>&1 || true

echo "DONE"
