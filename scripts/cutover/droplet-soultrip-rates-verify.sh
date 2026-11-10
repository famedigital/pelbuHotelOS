#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT rt.code, rr.label, rr.season_kind, rr.amount_single_btn AS single_btn, rr.amount_btn AS double_btn
   FROM public.room_rates rr
   JOIN public.room_types rt ON rt.id = rr.room_type_id
   JOIN public.agents a ON a.id = rr.agent_id
   JOIN public.properties p ON p.id = rr.property_id
   WHERE a.login_code = 'SOULTRIPS' AND p.slug = 'pelbu-olakha'
   ORDER BY rr.label, rt.code, rr.season_kind;"
docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT count(*) FROM public.room_rates rr
   JOIN public.agents a ON a.id = rr.agent_id
   WHERE a.login_code='SOULTRIPS' AND rr.label IN ('SOULTRIPS CP','SOULTRIPS MAP');"
