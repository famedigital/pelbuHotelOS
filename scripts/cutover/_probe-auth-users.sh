#!/usr/bin/env bash
set -euo pipefail
DBURL=$(grep '^DATABASE_URL=' /tmp/hos-v2-dburl.env | cut -d= -f2-)
docker run --rm --network supabase_default \
  -v /tmp/_probe-auth-users.sql:/tmp/q.sql:ro \
  postgres:16-alpine \
  psql "$DBURL" -f /tmp/q.sql
