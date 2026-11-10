#!/usr/bin/env bash
# Provision Soultrip agent portal: soultrip@gmail.com + password from env (never commit).
# Usage: AGENT_PORTAL_EMAIL=soultrip@gmail.com AGENT_PORTAL_PASSWORD='***' bash /tmp/soultrip-provision.sh
set -euo pipefail

EMAIL="${AGENT_PORTAL_EMAIL:-soultrip@gmail.com}"
PASSWORD="${AGENT_PORTAL_PASSWORD:?Set AGENT_PORTAL_PASSWORD}"
LOGIN_CODE="${AGENT_LOGIN_CODE:-SOULTRIPS}"
EMAIL_LC="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]')"

# Coolify / self-hosted Supabase service role
ENV_FILE=""
for cand in \
  /data/coolify/applications/*/ .env \
  /root/supabase/.env \
  /opt/supabase/.env; do
  # shellcheck disable=SC2086
  for f in $cand; do
    if [[ -f "$f" ]] && grep -q SERVICE_ROLE "$f" 2>/dev/null; then
      ENV_FILE="$f"
      break 2
    fi
  done
done

# Kong / auth container often has the key
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
if [[ -z "$SERVICE_ROLE_KEY" && -n "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  SERVICE_ROLE_KEY="$(grep -E '^(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  SERVICE_ROLE_KEY="$(docker exec supabase-kong printenv SUPABASE_SERVICE_KEY 2>/dev/null || true)"
fi
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  SERVICE_ROLE_KEY="$(docker exec supabase-rest printenv PGRST_JWT_SECRET 2>/dev/null || true)"
fi

# Prefer GoTrue admin via kong on docker network
AUTH_URL="${AUTH_URL:-http://supabase-kong:8000/auth/v1}"
# From host: use published kong port if present
if ! docker exec supabase-kong true 2>/dev/null; then
  echo "supabase-kong not running"
  exit 1
fi

echo "=== agent row ==="
AGENT_JSON="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT row_to_json(t) FROM (
     SELECT id, login_code, company_name, auth_user_id, can_login, contact_email
     FROM public.agents WHERE login_code='${LOGIN_CODE}' LIMIT 1
   ) t;")"
echo "$AGENT_JSON"
AGENT_ID="$(echo "$AGENT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
AUTH_USER_ID="$(echo "$AGENT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('auth_user_id') or '')")"

echo "=== set contact_email + can_login ==="
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE public.agents
   SET contact_email = '${EMAIL_LC}',
       can_login = true,
       company_name = COALESCE(NULLIF(company_name,''), 'SOULTRIPS')
   WHERE id = '${AGENT_ID}';"

# Resolve service role from vault / jwt if needed — read from innora app env
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  INNORA_ID="$(docker ps --format '{{.Names}}' | grep -E 'innora|hotel' | head -1 || true)"
  if [[ -n "$INNORA_ID" ]]; then
    SERVICE_ROLE_KEY="$(docker exec "$INNORA_ID" printenv SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || \
      docker exec "$INNORA_ID" printenv SERVICE_ROLE_KEY 2>/dev/null || true)"
  fi
fi

if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  echo "SERVICE_ROLE_KEY not found — will update auth.users email link only via SQL + ask app to set password"
  # Link email alias: update existing auth user email so GoTrue accepts soultrip@gmail.com
  if [[ -n "$AUTH_USER_ID" ]]; then
    docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
UPDATE auth.users
SET email = '${EMAIL_LC}',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('company_name','SOULTRIPS'),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('kind','agent','agent_id','${AGENT_ID}'),
    updated_at = now()
WHERE id = '${AUTH_USER_ID}'::uuid;
UPDATE auth.identities
SET identity_data = identity_data || jsonb_build_object('email','${EMAIL_LC}','email_verified',true),
    provider_id = '${EMAIL_LC}'
WHERE user_id = '${AUTH_USER_ID}'::uuid AND provider = 'email';
SQL
  fi
  echo "Email updated on auth user ${AUTH_USER_ID}. Password must be set via GoTrue admin (SERVICE_ROLE_KEY)."
  exit 2
fi

ANON_OR_SERVICE="$SERVICE_ROLE_KEY"
HDR=(-H "apikey: ${ANON_OR_SERVICE}" -H "Authorization: Bearer ${ANON_OR_SERVICE}" -H "Content-Type: application/json")

# Call GoTrue from inside kong network
provision_via_docker() {
  local body="$1"
  local method="$2"
  local path="$3"
  docker run --rm --network "$(docker inspect supabase-kong -f '{{range \$k, \$v := .NetworkSettings.Networks}}{{println \$k}}{{end}}' | head -1)" \
    curlimages/curl:8.5.0 -sS -X "$method" \
    "http://supabase-auth:9999${path}" \
    -H "apikey: ${ANON_OR_SERVICE}" \
    -H "Authorization: Bearer ${ANON_OR_SERVICE}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

if [[ -n "$AUTH_USER_ID" ]]; then
  echo "=== update existing auth user email+password ==="
  RESP="$(provision_via_docker \
    "{\"email\":\"${EMAIL_LC}\",\"password\":$(python3 -c "import json,os; print(json.dumps(os.environ['AGENT_PORTAL_PASSWORD']))"),\"email_confirm\":true,\"app_metadata\":{\"kind\":\"agent\",\"agent_id\":\"${AGENT_ID}\"}}" \
    PUT "/admin/users/${AUTH_USER_ID}" || true)"
  echo "$RESP" | head -c 400
  echo
else
  echo "=== create auth user ==="
  RESP="$(provision_via_docker \
    "{\"email\":\"${EMAIL_LC}\",\"password\":$(python3 -c "import json,os; print(json.dumps(os.environ['AGENT_PORTAL_PASSWORD']))"),\"email_confirm\":true,\"user_metadata\":{\"company_name\":\"SOULTRIPS\"},\"app_metadata\":{\"kind\":\"agent\",\"agent_id\":\"${AGENT_ID}\"}}" \
    POST "/admin/users" || true)"
  echo "$RESP" | head -c 400
  echo
  NEW_ID="$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('user',{}).get('id') or '')" 2>/dev/null || true)"
  if [[ -n "$NEW_ID" ]]; then
    docker exec supabase-db psql -U postgres -d postgres -c \
      "UPDATE public.agents SET auth_user_id='${NEW_ID}'::uuid, pin_set_at=now() WHERE id='${AGENT_ID}'::uuid;"
  fi
fi

echo "=== verify ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT a.login_code, a.contact_email, a.can_login, u.email AS auth_email
   FROM public.agents a
   LEFT JOIN auth.users u ON u.id = a.auth_user_id
   WHERE a.login_code='${LOGIN_CODE}';"
echo "DONE — sign in at /agents/login with email ${EMAIL_LC}"
