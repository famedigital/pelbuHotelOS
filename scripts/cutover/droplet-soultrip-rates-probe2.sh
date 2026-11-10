#!/usr/bin/env bash
set -euo pipefail
PID=d06e89f8-86e6-4201-bbd2-5e115d422357
AID=4a072010-577e-4fe4-8974-d09bc4fe0cc5

echo "=== distinct rate_tier / label for pelbu-olakha ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT rate_tier, label, season_kind, count(*), min(amount_btn) AS min_d, max(amount_btn) AS max_d
   FROM public.room_rates WHERE property_id='$PID' AND active
   GROUP BY 1,2,3 ORDER BY 1,2,3;"

echo "=== agent-specific rows (any agent) ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT rr.label, rr.rate_tier, rr.season_kind, rt.code, rr.amount_btn, rr.amount_single_btn, a.login_code
   FROM public.room_rates rr
   JOIN public.room_types rt ON rt.id=rr.room_type_id
   LEFT JOIN public.agents a ON a.id=rr.agent_id
   WHERE rr.property_id='$PID' AND rr.agent_id IS NOT NULL
   ORDER BY a.login_code, rr.label, rt.code;"

echo "=== SOULTRIPS existing ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT rr.id, rt.code, rr.season_kind, rr.rate_tier, rr.label, rr.amount_btn, rr.amount_single_btn, rr.active
   FROM public.room_rates rr
   JOIN public.room_types rt ON rt.id=rr.room_type_id
   WHERE rr.agent_id='$AID' ORDER BY rr.label, rt.code, rr.season_kind;"

echo "=== meal_plans ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='meal_plans' ORDER BY 1;"
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT code, name, amount_btn FROM public.meal_plans WHERE property_id='$PID' ORDER BY code LIMIT 20;"

echo "=== unique constraint ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='room_rates';"
