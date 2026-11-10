#!/usr/bin/env bash
# Provision AD-Atlas Discovery Gateways agent portal (email + password).
# Usage on droplet:
#   AGENT_PORTAL_PASSWORD='***' bash /tmp/droplet-atlas-provision.sh
set -euo pipefail

AGENT_ID="691e4a09-aa02-4fa1-b0a6-141362a95b5d"
LOGIN_CODE="${AGENT_LOGIN_CODE:-ATLAS}"
EMAIL="${AGENT_PORTAL_EMAIL:-atlas@discoverygateways.partner}"
PASSWORD="${AGENT_PORTAL_PASSWORD:?Set AGENT_PORTAL_PASSWORD}"
EMAIL_LC="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]')"
PROPERTY_ID="d06e89f8-86e6-4201-bbd2-5e115d422357"

echo "=== agent before ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, login_code, company_name, contact_email, can_login, auth_user_id
   FROM public.agents WHERE id='${AGENT_ID}';"

echo "=== MoU + login_code + email ==="
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE public.agent_property_links
   SET mou_signed_at = COALESCE(mou_signed_at, now()),
       status = 'approved'
   WHERE agent_id = '${AGENT_ID}'::uuid
     AND property_id = '${PROPERTY_ID}'::uuid;

   UPDATE public.agents
   SET login_code = '${LOGIN_CODE}',
       contact_email = '${EMAIL_LC}',
       can_login = true,
       company_name = 'AD-Atlas Discovery Gateways'
   WHERE id = '${AGENT_ID}'::uuid;"

# Align v2 agent code + portal login (was A-691e4a09; AD is taken by AD Tours)
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE v2.agents
   SET code = '${LOGIN_CODE}',
       name = 'AD-Atlas Discovery Gateways',
       version = version + 1
   WHERE id = '${AGENT_ID}'::uuid
      OR (property_id = '${PROPERTY_ID}'::uuid AND name ILIKE 'AD-Atlas Discovery Gateways%');

   UPDATE v2.portal_accounts
   SET login_code = '${LOGIN_CODE}',
       display_name = 'AD-Atlas Discovery Gateways',
       subject_id = '${AGENT_ID}'::uuid,
       active = true,
       version = version + 1
   WHERE subject_id = '${AGENT_ID}'::uuid
      OR upper(login_code) = 'A-691E4A09'
      OR (role = 'agent' AND display_name ILIKE 'AD-Atlas Discovery Gateways%');"

# Ensure portal row exists for Olakha
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "INSERT INTO v2.portal_accounts
     (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route, active)
   SELECT '${PROPERTY_ID}'::uuid, 'agent', '${AGENT_ID}'::uuid, '${LOGIN_CODE}',
          'AD-Atlas Discovery Gateways', NULL, true, '/partner', true
   WHERE NOT EXISTS (
     SELECT 1 FROM v2.portal_accounts
     WHERE property_id = '${PROPERTY_ID}'::uuid
       AND role = 'agent'
       AND (subject_id = '${AGENT_ID}'::uuid OR upper(login_code) = upper('${LOGIN_CODE}'))
   );"

SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  INNORA_ID="$(docker ps --format '{{.Names}}' | grep -E 'innora|hotel|hos' | head -1 || true)"
  if [[ -n "$INNORA_ID" ]]; then
    SERVICE_ROLE_KEY="$(docker exec "$INNORA_ID" printenv SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || \
      docker exec "$INNORA_ID" printenv SERVICE_ROLE_KEY 2>/dev/null || true)"
  fi
fi
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  for cand in /data/coolify/applications/*/.env /root/supabase/.env; do
    for f in $cand; do
      if [[ -f "$f" ]] && grep -qE 'SERVICE_ROLE' "$f" 2>/dev/null; then
        SERVICE_ROLE_KEY="$(grep -E '^(SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=' "$f" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
        break 2
      fi
    done
  done
fi
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  SERVICE_ROLE_KEY="$(docker exec supabase-kong printenv SUPABASE_SERVICE_KEY 2>/dev/null || true)"
fi
if [[ -z "$SERVICE_ROLE_KEY" ]]; then
  echo "SERVICE_ROLE_KEY missing"; exit 1
fi

AUTH_USER_ID="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT COALESCE(auth_user_id::text,'') FROM public.agents WHERE id='${AGENT_ID}';")"

PASS_JSON="$(PASSWORD="$PASSWORD" python3 -c 'import json,os; print(json.dumps(os.environ["PASSWORD"]))')"
NET="$(docker inspect supabase-kong -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -1)"

provision() {
  local method="$1" path="$2" body="$3"
  docker run --rm --network "$NET" curlimages/curl:8.5.0 -sS -X "$method" \
    "http://supabase-auth:9999${path}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

BODY_COMMON="\"email\":\"${EMAIL_LC}\",\"password\":${PASS_JSON},\"email_confirm\":true,\"user_metadata\":{\"company_name\":\"AD-Atlas Discovery Gateways\"},\"app_metadata\":{\"kind\":\"agent\",\"agent_id\":\"${AGENT_ID}\"}"

if [[ -n "$AUTH_USER_ID" ]]; then
  echo "=== update auth user ${AUTH_USER_ID} ==="
  RESP="$(provision PUT "/admin/users/${AUTH_USER_ID}" "{${BODY_COMMON}}")"
else
  echo "=== create auth user ==="
  RESP="$(provision POST "/admin/users" "{${BODY_COMMON}}")"
  AUTH_USER_ID="$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('user',{}).get('id') or '')" 2>/dev/null || true)"
fi
echo "$RESP" | head -c 500; echo

if [[ -z "$AUTH_USER_ID" ]]; then
  echo "Failed to resolve auth user id"; exit 1
fi

docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE public.agents
   SET auth_user_id = '${AUTH_USER_ID}'::uuid,
       can_login = true,
       pin_set_at = now(),
       updated_at = now()
   WHERE id = '${AGENT_ID}'::uuid;"

echo "=== verify ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT a.login_code, a.contact_email, a.can_login, u.email AS auth_email,
          apl.mou_signed_at IS NOT NULL AS mou_ok
   FROM public.agents a
   LEFT JOIN auth.users u ON u.id = a.auth_user_id
   LEFT JOIN public.agent_property_links apl
     ON apl.agent_id = a.id AND apl.property_id = '${PROPERTY_ID}'::uuid
   WHERE a.id = '${AGENT_ID}'::uuid;"

docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT code, name FROM v2.agents WHERE id='${AGENT_ID}'::uuid OR upper(code)=upper('${LOGIN_CODE}');
   SELECT login_code, display_name, active FROM v2.portal_accounts
   WHERE subject_id='${AGENT_ID}'::uuid OR upper(login_code)=upper('${LOGIN_CODE}');"

echo "DONE — sign in at https://innorahotel.com/agents/login"
echo "  email: ${EMAIL_LC}"
echo "  or agent code: ${LOGIN_CODE}"
