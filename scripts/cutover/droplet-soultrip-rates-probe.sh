#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%rate%' OR table_name ILIKE '%mou%' OR table_name ILIKE '%tariff%') ORDER BY 1;"
echo "=== agent_property_links cols for soultrips ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_property_links' ORDER BY ordinal_position;"
echo "=== SOULTRIPS link ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT apl.*, p.slug FROM public.agent_property_links apl JOIN public.agents a ON a.id=apl.agent_id JOIN public.properties p ON p.id=apl.property_id WHERE a.login_code='SOULTRIPS';"
echo "=== room_rates sample cols ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='room_rates' ORDER BY ordinal_position;"
