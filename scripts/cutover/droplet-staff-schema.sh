#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_members' ORDER BY ordinal_position;"
echo "=== room_types sample ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT p.slug, count(rt.*) FROM public.room_types rt JOIN public.properties p ON p.id=rt.property_id GROUP BY p.slug;"
echo "=== room_units sample ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT p.slug, count(ru.*) FROM public.room_units ru JOIN public.properties p ON p.id=ru.property_id GROUP BY p.slug;"
echo "=== properties ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, slug, name FROM public.properties WHERE slug IN ('pelbu-olakha','pelbu-suites-olakha','demo-hotel') ORDER BY slug;"
