#!/usr/bin/env bash
set -euo pipefail
: "${AGENT_PORTAL_PASSWORD:?required}"
EMAIL_LC=soultrip@gmail.com
AUTH_BASE=http://127.0.0.1:8001/auth/v1
ANON_KEY="$(docker exec innora printenv NEXT_PUBLIC_SUPABASE_ANON_KEY)"

# Build JSON with node, print length only
mkdir -p /tmp/soultrip-prov
docker run --rm -e AGENT_PORTAL_PASSWORD -e EMAIL_LC -v /tmp/soultrip-prov:/out node:20-alpine \
  node -e 'const b=JSON.stringify({email:process.env.EMAIL_LC,password:process.env.AGENT_PORTAL_PASSWORD}); require("fs").writeFileSync("/out/smoke.json",b); console.log("bytes",b.length)'

echo "file:"; wc -c /tmp/soultrip-prov/smoke.json; cat /tmp/soultrip-prov/smoke.json | head -c 40; echo "..."

BODY=$(cat /tmp/soultrip-prov/smoke.json)
echo "=== curl -d @file ==="
curl -sS -X POST "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d @"/tmp/soultrip-prov/smoke.json"
echo

echo "=== curl -d inline via envsubst-safe node pipe ==="
docker run --rm -e AGENT_PORTAL_PASSWORD -e EMAIL_LC -e ANON_KEY -e AUTH_BASE \
  curlimages/curl:8.5.0 sh -c '
  # curl image has no node — use printf carefully
  true
'
# Use host curl with body from process substitution of node docker
JSON=$(docker run --rm -e AGENT_PORTAL_PASSWORD -e EMAIL_LC node:20-alpine \
  node -e 'process.stdout.write(JSON.stringify({email:process.env.EMAIL_LC,password:process.env.AGENT_PORTAL_PASSWORD}))')
curl -sS -X POST "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "$JSON"
echo

rm -rf /tmp/soultrip-prov
