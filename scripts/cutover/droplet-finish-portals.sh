#!/usr/bin/env bash
set -euo pipefail
cp -f /tmp/docker-compose.cutover.yml /opt/hos-v2/docker-compose.cutover.yml
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env up -d --build hos-v2-api hos-v2-desk
sleep 10
echo "=== health ==="
curl -sf http://127.0.0.1:4200/health; echo
echo "=== hotels ==="
curl -sf http://127.0.0.1:4200/v1/auth/hotels; echo
echo "=== hotel unlock ==="
curl -sf -X POST http://127.0.0.1:4200/v1/auth/hotel/unlock \
  -H 'content-type: application/json' \
  -d '{"propertySlug":"pelbu-olakha","deskCode":"PELBU2026"}' | tee /tmp/unlock.json
echo
TOKEN=$(python3 -c 'import json; print(json.load(open("/tmp/unlock.json"))["token"])')
echo "=== staff with gate ==="
curl -sf "http://127.0.0.1:4200/v1/auth/staff?propertySlug=pelbu-olakha" \
  -H "Authorization: Bearer $TOKEN" | head -c 400; echo
echo "=== soultrip agent login (reset path) ==="
curl -sS -X POST http://127.0.0.1:4200/v1/auth/portal/login \
  -H 'content-type: application/json' \
  -d '{"role":"agent","propertySlug":"pelbu-olakha","loginCode":"SOULTRIPS","pin":"2468"}' | head -c 400; echo
echo "=== desk login page ==="
curl -sk -o /dev/null -w "%{http_code}" -H 'Host: desk-v2.165.22.211.20.sslip.io' https://127.0.0.1/login/hotel; echo
curl -sk -o /dev/null -w "%{http_code}" -H 'Host: innorahotel.com' https://127.0.0.1/; echo
docker ps --format '{{.Names}} {{.Status}}' | grep hos-v2
