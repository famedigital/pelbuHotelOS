#!/usr/bin/env bash
# Seed desk access codes + portal accounts inside hos-v2-api container (has node crypto).
set -euo pipefail
set -a
# shellcheck disable=SC1091
source /tmp/hos-v2-dburl.env
set +a

DESK_CODE="${SEED_DESK_CODE:-PELBU2026}"
PORTAL_PIN="${SEED_PORTAL_PIN:-2468}"

docker cp /tmp/seed-portal-auth-inline.mjs hos-v2-hos-v2-api-1:/tmp/seed-portal-auth-inline.mjs
docker exec -e DATABASE_URL="$DATABASE_URL" -e SEED_DESK_CODE="$DESK_CODE" -e SEED_PORTAL_PIN="$PORTAL_PIN" \
  hos-v2-hos-v2-api-1 node /tmp/seed-portal-auth-inline.mjs
