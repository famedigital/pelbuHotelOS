#!/usr/bin/env bash
# Create/update GoTrue user for Atlas agent (run on Hotel OS droplet).
set -euo pipefail

AGENT_ID="691e4a09-aa02-4fa1-b0a6-141362a95b5d"
EMAIL_LC="${AGENT_PORTAL_EMAIL:-atlas@discoverygateways.partner}"
EMAIL_LC="$(echo "$EMAIL_LC" | tr '[:upper:]' '[:lower:]')"
PASSWORD="${AGENT_PORTAL_PASSWORD:?Set AGENT_PORTAL_PASSWORD}"

APP="$(docker ps --format '{{.Names}}' | grep -E '^zkggxjoxur9j8hxcghclplhw-' | head -1 || true)"
if [[ -z "$APP" ]]; then
  APP="$(docker ps --format '{{.Names}}' | grep -E 'innora|hotel' | head -1 || true)"
fi
SERVICE_ROLE_KEY="$(docker exec "$APP" printenv SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || true)"
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  echo "No SUPABASE_SERVICE_ROLE_KEY on $APP"; exit 1
fi

AUTH_USER_ID="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT COALESCE(auth_user_id::text,'') FROM public.agents WHERE id='${AGENT_ID}';")"

# Also try lookup by email in auth.users
if [[ -z "$AUTH_USER_ID" ]]; then
  AUTH_USER_ID="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
    "SELECT id::text FROM auth.users WHERE lower(email)='${EMAIL_LC}' LIMIT 1;")"
fi

PASS_JSON="$(PASSWORD="$PASSWORD" python3 -c 'import json,os; print(json.dumps(os.environ["PASSWORD"]))')"
BODY="{\"email\":\"${EMAIL_LC}\",\"password\":${PASS_JSON},\"email_confirm\":true,\"user_metadata\":{\"company_name\":\"AD-Atlas Discovery Gateways\"},\"app_metadata\":{\"kind\":\"agent\",\"agent_id\":\"${AGENT_ID}\"}}"

# supabase-auth listens on container network; use supabase_default
call_auth() {
  local method="$1" path="$2"
  docker run --rm --network supabase_default curlimages/curl:8.5.0 -sS -X "$method" \
    "http://supabase-auth:9999${path}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$BODY"
}

if [[ -n "$AUTH_USER_ID" ]]; then
  echo "Updating auth user $AUTH_USER_ID"
  RESP="$(call_auth PUT "/admin/users/${AUTH_USER_ID}" || true)"
else
  echo "Creating auth user"
  RESP="$(call_auth POST "/admin/users" || true)"
  AUTH_USER_ID="$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('user',{}).get('id') or '')" 2>/dev/null || true)"
fi

echo "$RESP" | head -c 600; echo

if [[ -z "$AUTH_USER_ID" || "$AUTH_USER_ID" == "None" ]]; then
  # Retry create on alternate port 9999 failed? try without port path via envoy
  echo "Retry via supabase-envoy:8000"
  RESP="$(docker run --rm --network supabase_default curlimages/curl:8.5.0 -sS -X POST \
    "http://supabase-envoy:8000/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$BODY" || true)"
  echo "$RESP" | head -c 600; echo
  AUTH_USER_ID="$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('user',{}).get('id') or '')" 2>/dev/null || true)"
fi

if [[ -z "$AUTH_USER_ID" ]]; then
  echo "FAIL: no auth user id"; exit 1
fi

docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE public.agents
   SET auth_user_id = '${AUTH_USER_ID}'::uuid,
       can_login = true,
       pin_set_at = now(),
       contact_email = '${EMAIL_LC}',
       login_code = COALESCE(NULLIF(login_code,''), 'ATLAS')
   WHERE id = '${AGENT_ID}'::uuid;"

docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT a.login_code, a.contact_email, a.can_login, u.email AS auth_email,
          (apl.mou_signed_at IS NOT NULL) AS mou_ok
   FROM public.agents a
   LEFT JOIN auth.users u ON u.id = a.auth_user_id
   LEFT JOIN public.agent_property_links apl ON apl.agent_id = a.id
   WHERE a.id = '${AGENT_ID}'::uuid;"

echo "OK auth_user_id=$AUTH_USER_ID"
