#!/usr/bin/env bash
# Provision SOULTRIPS portal email+password via GoTrue on :8001.
set -euo pipefail

EMAIL_LC="$(echo "${AGENT_PORTAL_EMAIL:-soultrip@gmail.com}" | tr '[:upper:]' '[:lower:]')"
: "${AGENT_PORTAL_PASSWORD:?AGENT_PORTAL_PASSWORD required}"
LOGIN_CODE="${AGENT_LOGIN_CODE:-SOULTRIPS}"
AUTH_BASE="${AUTH_BASE:-http://127.0.0.1:8001/auth/v1}"

SERVICE_ROLE_KEY="$(docker exec innora printenv SUPABASE_SERVICE_ROLE_KEY)"
AGENT_ID="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT id FROM public.agents WHERE login_code='${LOGIN_CODE}' LIMIT 1;" | tr -d '[:space:]')"
AUTH_USER_ID="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT COALESCE(auth_user_id::text,'') FROM public.agents WHERE id='${AGENT_ID}';" | tr -d '[:space:]')"

[[ -n "$AGENT_ID" ]] || { echo "Agent ${LOGIN_CODE} not found"; exit 1; }
echo "agent=$AGENT_ID auth_user=${AUTH_USER_ID:-none} email=$EMAIL_LC"

docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE public.agents
   SET contact_email = '${EMAIL_LC}', can_login = true,
       pin_set_at = COALESCE(pin_set_at, now())
   WHERE id = '${AGENT_ID}'::uuid;"

mkdir -p /tmp/soultrip-prov
# JSON via alpine node (always available via docker pull if needed)
docker run --rm -e EMAIL_LC -e AGENT_PORTAL_PASSWORD -e AGENT_ID \
  -v /tmp/soultrip-prov:/out node:20-alpine \
  node -e 'require("fs").writeFileSync("/out/body.json", JSON.stringify({
    email: process.env.EMAIL_LC,
    password: process.env.AGENT_PORTAL_PASSWORD,
    email_confirm: true,
    app_metadata: { kind: "agent", agent_id: process.env.AGENT_ID },
    user_metadata: { company_name: "SOULTRIPS" },
  }))'

if [[ -n "$AUTH_USER_ID" ]]; then
  URL="${AUTH_BASE}/admin/users/${AUTH_USER_ID}"
  METHOD=PUT
else
  URL="${AUTH_BASE}/admin/users"
  METHOD=POST
fi

echo "GoTrue ${METHOD} ${URL}"
HTTP=$(curl -sS -o /tmp/soultrip-prov/out.json -w "%{http_code}" -X "$METHOD" "$URL" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/soultrip-prov/body.json)
echo "GoTrue HTTP ${HTTP}"
head -c 280 /tmp/soultrip-prov/out.json; echo
[[ "$HTTP" == "200" || "$HTTP" == "201" ]] || exit 1

if [[ -z "$AUTH_USER_ID" ]]; then
  NEW_ID=$(docker run --rm -v /tmp/soultrip-prov:/out node:20-alpine \
    node -e 'try{console.log(JSON.parse(require("fs").readFileSync("/out/out.json","utf8")).id||"")}catch{console.log("")}')
  [[ -n "$NEW_ID" ]] && docker exec supabase-db psql -U postgres -d postgres -c \
    "UPDATE public.agents SET auth_user_id='${NEW_ID}'::uuid WHERE id='${AGENT_ID}'::uuid;"
fi

docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
UPDATE auth.users
SET email = '${EMAIL_LC}',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = (SELECT auth_user_id FROM public.agents WHERE id = '${AGENT_ID}'::uuid);

UPDATE auth.identities
SET identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('email', '${EMAIL_LC}', 'email_verified', true),
    provider_id = '${EMAIL_LC}'
WHERE user_id = (SELECT auth_user_id FROM public.agents WHERE id = '${AGENT_ID}'::uuid)
  AND provider = 'email';
SQL

docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT a.login_code, a.contact_email, a.can_login, u.email AS auth_email
   FROM public.agents a LEFT JOIN auth.users u ON u.id=a.auth_user_id
   WHERE a.login_code='${LOGIN_CODE}';"

docker run --rm -e EMAIL_LC -e AGENT_PORTAL_PASSWORD -v /tmp/soultrip-prov:/out node:20-alpine \
  node -e 'require("fs").writeFileSync("/out/smoke.json", JSON.stringify({
    email: process.env.EMAIL_LC, password: process.env.AGENT_PORTAL_PASSWORD }))'

SMOKE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
  "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/soultrip-prov/smoke.json)
rm -rf /tmp/soultrip-prov
echo "password-grant HTTP ${SMOKE}"
[[ "$SMOKE" == "200" ]] || exit 1
echo "DONE — /agents/login → ${EMAIL_LC}"
