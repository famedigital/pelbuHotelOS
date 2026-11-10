#!/usr/bin/env bash
set -euo pipefail
: "${AGENT_PORTAL_PASSWORD:?required}"
EMAIL_LC="${AGENT_PORTAL_EMAIL:-soultrip@gmail.com}"
EMAIL_LC="$(echo "$EMAIL_LC" | tr '[:upper:]' '[:lower:]')"
AUTH_USER_ID=df1853d2-0fc1-42f9-a719-d2442efb65f6
AUTH_BASE=http://127.0.0.1:8001/auth/v1
SERVICE_ROLE_KEY="$(docker exec innora printenv SUPABASE_SERVICE_ROLE_KEY)"
ANON_KEY="$(docker exec innora printenv NEXT_PUBLIC_SUPABASE_ANON_KEY)"

mkdir -p /tmp/soultrip-prov
docker run --rm \
  -e "EMAIL_LC=${EMAIL_LC}" \
  -e "AGENT_PORTAL_PASSWORD=${AGENT_PORTAL_PASSWORD}" \
  -v /tmp/soultrip-prov:/out node:20-alpine \
  node -e 'const b={email:process.env.EMAIL_LC,password:process.env.AGENT_PORTAL_PASSWORD,email_confirm:true}; if(!b.email) throw new Error("missing email"); require("fs").writeFileSync("/out/body.json", JSON.stringify(b)); console.log("body keys", Object.keys(b).join(","))'

HTTP=$(curl -sS -o /tmp/soultrip-prov/out.json -w "%{http_code}" -X PUT \
  "${AUTH_BASE}/admin/users/${AUTH_USER_ID}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/soultrip-prov/body.json)
echo "GoTrue PUT HTTP ${HTTP}"

docker run --rm \
  -e "EMAIL_LC=${EMAIL_LC}" \
  -e "AGENT_PORTAL_PASSWORD=${AGENT_PORTAL_PASSWORD}" \
  -v /tmp/soultrip-prov:/out node:20-alpine \
  node -e 'require("fs").writeFileSync("/out/smoke.json", JSON.stringify({email:process.env.EMAIL_LC,password:process.env.AGENT_PORTAL_PASSWORD})); console.log(require("fs").readFileSync("/out/smoke.json","utf8").replace(/"password":"[^"]+"/, "\"password\":\"***\""))'

SMOKE=$(curl -sS -o /tmp/soultrip-prov/smoke-out.json -w "%{http_code}" -X POST \
  "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/soultrip-prov/smoke.json)
echo "password-grant HTTP ${SMOKE}"
docker run --rm -v /tmp/soultrip-prov:/out node:20-alpine \
  node -e 'const j=JSON.parse(require("fs").readFileSync("/out/smoke-out.json","utf8")); console.log(JSON.stringify({error:j.error||j.msg||j.error_code, hasToken:!!j.access_token}))'
rm -rf /tmp/soultrip-prov
[[ "$SMOKE" == "200" ]]
echo "OK — soultrip@gmail.com password works"
