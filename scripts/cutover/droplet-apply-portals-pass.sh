#!/usr/bin/env bash
set -euo pipefail

echo "=== unpack ==="
mkdir -p /opt/hos-v2 /tmp/hos-v2-migrations
tar -xzf /tmp/hos-v2-cutover.tgz -C /opt/hos-v2
cp -f /tmp/0012_portal_auth.sql /tmp/hos-v2-migrations/0012_portal_auth.sql
# keep prior migrations if present
if [[ -d /tmp/hos-v2-migrations ]]; then
  true
fi

echo "=== apply 0012 only ==="
docker cp /tmp/0012_portal_auth.sql supabase-db:/tmp/0012_portal_auth.sql
applied=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT 1 FROM v2.schema_migrations WHERE id='0012_portal_auth'" || true)
if [[ "$applied" == "1" ]]; then
  echo "0012 already applied"
else
  docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/0012_portal_auth.sql
  sum=$(sha256sum /tmp/0012_portal_auth.sql | awk '{print substr($1,1,16)}')
  docker exec -i supabase-db psql -U postgres -d postgres -c \
    "INSERT INTO v2.schema_migrations (id, checksum) VALUES ('0012_portal_auth', '$sum') ON CONFLICT (id) DO NOTHING;"
  docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.portal_accounts TO v2_app;
SQL
fi

echo "=== seed portal auth ==="
docker cp /tmp/portal-seed.sql supabase-db:/tmp/portal-seed.sql
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/portal-seed.sql
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT role, count(*) FROM v2.portal_accounts GROUP BY role ORDER BY 1;"
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT slug, desk_access_code_hash IS NOT NULL AS gated FROM v2.properties WHERE slug LIKE 'pelbu%';"

echo "=== deploy stack (api+desk+web) ==="
cp -f /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2/droplet-deploy-v2-stack.sh
chmod +x /tmp/droplet-deploy-v2-stack.sh
# extend deploy to include web health later; for now compose up
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env up -d --build

sleep 10
curl -sf http://127.0.0.1:4200/health; echo
curl -sf http://127.0.0.1:4280/login/hotel | head -c 120; echo
curl -sf http://127.0.0.1:4200/v1/auth/hotels | head -c 300; echo

echo "=== Host probes ==="
curl -sk -H 'Host: desk-v2.165.22.211.20.sslip.io' https://127.0.0.1/health; echo
curl -skI -H 'Host: innorahotel.com' https://127.0.0.1/ | head -10

echo "=== DONE portals pass ==="
echo "Hotel desk: https://desk-v2.165.22.211.20.sslip.io/login/hotel  code PELBU2026"
echo "Public: https://innorahotel.com/"
