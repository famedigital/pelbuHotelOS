#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' ORDER BY ordinal_position;"
echo "=== room_types ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='room_types' ORDER BY ordinal_position;"
echo "=== room_units ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='room_units' ORDER BY ordinal_position;"
