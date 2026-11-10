#!/usr/bin/env bash
set -euo pipefail
SQL="${1:-/tmp/02_etl.sql}"
docker cp "$SQL" supabase-db:/tmp/02_etl.sql
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT set_config('hos.etl_mode','apply',false);" \
  -f /tmp/02_etl.sql
