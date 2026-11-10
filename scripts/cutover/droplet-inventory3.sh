#!/usr/bin/env bash
set -euo pipefail
DB=(docker exec supabase-db psql -U postgres -d postgres)
"${DB[@]}" -c "SELECT count(*) AS room_units FROM public.room_units;"
"${DB[@]}" -c "SELECT count(*) AS booking_guests FROM public.booking_guests;"
"${DB[@]}" -c "SELECT status, count(*) FROM public.folios GROUP BY 1 ORDER BY 2 DESC;"
"${DB[@]}" -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='room_units' ORDER BY ordinal_position;"
"${DB[@]}" -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='booking_guests' ORDER BY ordinal_position LIMIT 30;"
