#!/usr/bin/env bash
set -euo pipefail
PID=d06e89f8-86e6-4201-bbd2-5e115d422357
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.room_rates'::regclass;"
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='room_rates';"
echo "=== agent standard deluxe amounts ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT rt.code, rr.season_kind, rr.amount_btn AS dbl, rr.amount_single_btn AS sgl
   FROM public.room_rates rr JOIN public.room_types rt ON rt.id=rr.room_type_id
   WHERE rr.property_id='$PID' AND rr.rate_tier='agents' AND rr.label='Standard'
     AND rt.code IN ('deluxe_twin','deluxe_king','deluxe_queen','suite')
   ORDER BY rt.code, rr.season_kind;"
echo "=== meal plans ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT code, name, amount_btn_per_adult_night FROM public.meal_plans WHERE property_id='$PID' ORDER BY code;"
