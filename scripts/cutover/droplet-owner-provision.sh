#!/usr/bin/env bash
# Provision org owner pelbusuites@gmail.com (password from env — never commit).
set -euo pipefail
EMAIL_LC="$(echo "${OWNER_EMAIL:-pelbusuites@gmail.com}" | tr '[:upper:]' '[:lower:]')"
: "${OWNER_PASSWORD:?OWNER_PASSWORD required}"
ORG_ID=a1000000-0000-4000-8000-000000000001
AUTH_BASE="${AUTH_BASE:-http://127.0.0.1:8001/auth/v1}"
SERVICE_ROLE_KEY="$(docker exec innora printenv SUPABASE_SERVICE_ROLE_KEY)"
ANON_KEY="$(docker exec innora printenv NEXT_PUBLIC_SUPABASE_ANON_KEY)"

mkdir -p /tmp/owner-prov
docker run --rm \
  -e "EMAIL_LC=${EMAIL_LC}" \
  -e "OWNER_PASSWORD=${OWNER_PASSWORD}" \
  -v /tmp/owner-prov:/out node:20-alpine \
  node -e 'const b={email:process.env.EMAIL_LC,password:process.env.OWNER_PASSWORD,email_confirm:true,user_metadata:{role:"owner",org:"Pelbu Suites"},app_metadata:{kind:"org_owner"}}; require("fs").writeFileSync("/out/body.json",JSON.stringify(b)); console.log("keys",Object.keys(b).join(","))'

EXISTING=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT id FROM auth.users WHERE lower(email)='${EMAIL_LC}' LIMIT 1;" | tr -d '[:space:]')

if [[ -n "$EXISTING" ]]; then
  echo "Updating existing owner ${EXISTING}"
  HTTP=$(curl -sS -o /tmp/owner-prov/out.json -w "%{http_code}" -X PUT \
    "${AUTH_BASE}/admin/users/${EXISTING}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    --data-binary @/tmp/owner-prov/body.json)
  USER_ID="$EXISTING"
else
  echo "Creating owner user…"
  HTTP=$(curl -sS -o /tmp/owner-prov/out.json -w "%{http_code}" -X POST \
    "${AUTH_BASE}/admin/users" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    --data-binary @/tmp/owner-prov/body.json)
  USER_ID=$(docker run --rm -v /tmp/owner-prov:/out node:20-alpine \
    node -e 'try{console.log(JSON.parse(require("fs").readFileSync("/out/out.json","utf8")).id||"")}catch{console.log("")}')
fi
echo "GoTrue HTTP ${HTTP} user=${USER_ID}"
[[ "$HTTP" == "200" || "$HTTP" == "201" ]] || { head -c 300 /tmp/owner-prov/out.json; echo; exit 1; }
[[ -n "$USER_ID" ]] || exit 1

docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
UPDATE auth.users
SET email = '${EMAIL_LC}',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = '${USER_ID}'::uuid;

UPDATE auth.identities
SET identity_data = coalesce(identity_data, '{}'::jsonb)
      || jsonb_build_object('email', '${EMAIL_LC}', 'email_verified', true),
    provider_id = '${EMAIL_LC}'
WHERE user_id = '${USER_ID}'::uuid AND provider = 'email';

INSERT INTO v2.org_members (organization_id, auth_user_id, email, role)
VALUES (
  '${ORG_ID}'::uuid,
  '${USER_ID}'::uuid,
  '${EMAIL_LC}',
  'owner'
)
ON CONFLICT (organization_id, email) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  role = 'owner';

-- Remove placeholder auth_user_id if present
DELETE FROM v2.org_members
WHERE organization_id = '${ORG_ID}'::uuid
  AND email = '${EMAIL_LC}'
  AND auth_user_id = '00000000-0000-4000-8000-0000000000e1'::uuid;
SQL

docker run --rm \
  -e "EMAIL_LC=${EMAIL_LC}" \
  -e "OWNER_PASSWORD=${OWNER_PASSWORD}" \
  -v /tmp/owner-prov:/out node:20-alpine \
  node -e 'require("fs").writeFileSync("/out/smoke.json",JSON.stringify({email:process.env.EMAIL_LC,password:process.env.OWNER_PASSWORD}))'

SMOKE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
  "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/owner-prov/smoke.json)
rm -rf /tmp/owner-prov
echo "password-grant HTTP ${SMOKE}"
[[ "$SMOKE" == "200" ]] || exit 1

docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT m.email, m.role, u.email AS auth_email
   FROM v2.org_members m
   JOIN auth.users u ON u.id = m.auth_user_id
   WHERE m.organization_id = '${ORG_ID}'::uuid;"
echo "DONE owner ${EMAIL_LC}"
