#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c \
  "UPDATE v2.properties SET current_business_date='2026-11-10', version=version+1 WHERE slug='pelbu-olakha' RETURNING slug, current_business_date;"
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env restart hos-v2-api
sleep 5
curl -sf http://127.0.0.1:4200/health; echo
