#!/usr/bin/env bash
set -euo pipefail
: "${AGENT_PORTAL_PASSWORD:?required}"
EMAIL_LC=soultrip@gmail.com
AUTH_BASE=http://127.0.0.1:8001/auth/v1
SERVICE_ROLE_KEY="$(docker exec innora printenv SUPABASE_SERVICE_ROLE_KEY)"
ANON_KEY="$(docker exec innora printenv NEXT_PUBLIC_SUPABASE_ANON_KEY)"

mkdir -p /tmp/soultrip-prov
docker run --rm -e AGENT_PORTAL_PASSWORD -e EMAIL_LC -v /tmp/soultrip-prov:/out node:20-alpine \
  node -e 'require("fs").writeFileSync("/out/smoke.json", JSON.stringify({
    email: process.env.EMAIL_LC, password: process.env.AGENT_PORTAL_PASSWORD }))'

echo "=== with service role apikey ==="
curl -sS -X POST "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/soultrip-prov/smoke.json | head -c 400
echo

echo "=== with anon apikey ==="
curl -sS -X POST "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/soultrip-prov/smoke.json | head -c 400
echo

echo "=== form-urlencoded anon ==="
curl -sS -X POST "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=${EMAIL_LC}" \
  --data-urlencode "password=${AGENT_PORTAL_PASSWORD}" | head -c 400
echo

echo "=== user row flags ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT email, banned_until, deleted_at, is_sso_user, email_confirmed_at IS NOT NULL AS confirmed,
          length(encrypted_password) AS pw_len
   FROM auth.users WHERE email='${EMAIL_LC}';"

rm -rf /tmp/soultrip-prov
