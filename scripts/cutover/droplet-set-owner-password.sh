#!/usr/bin/env bash
# Reset org owner GoTrue password (ops). Pass OWNER_PASSWORD via env.
set -euo pipefail
EMAIL="${OWNER_EMAIL:-pelbusuites@gmail.com}"
: "${OWNER_PASSWORD:?OWNER_PASSWORD required}"
SR=""
for c in $(docker ps --format '{{.Names}}'); do
  case "$c" in
    *edge*|*auth*|innora*|supabase*)
      SR="$(docker exec "$c" printenv SERVICE_ROLE_KEY 2>/dev/null || true)"
      [[ -z "$SR" ]] && SR="$(docker exec "$c" printenv SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || true)"
      [[ -n "$SR" ]] && break
      ;;
  esac
done
[[ -n "$SR" ]] || { echo "no service role"; exit 1; }
USER_ID=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT id FROM auth.users WHERE lower(email)='$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]')' LIMIT 1;" | tr -d '[:space:]')
[[ -n "$USER_ID" ]] || { echo "user missing"; exit 1; }
EMAIL="$EMAIL" OWNER_PASSWORD="$OWNER_PASSWORD" python3 - <<'PY'
import json, os
open("/tmp/owner-pw.json","w").write(json.dumps({
  "email": os.environ["EMAIL"].lower(),
  "password": os.environ["OWNER_PASSWORD"],
  "email_confirm": True,
}))
print("body ok")
PY
HTTP=$(curl -sS -o /tmp/owner-pw-out.json -w "%{http_code}" -X PUT \
  "http://127.0.0.1:8001/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $SR" \
  -H "Authorization: Bearer $SR" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/owner-pw.json)
echo "admin HTTP $HTTP"
[[ "$HTTP" == "200" ]] || { head -c 200 /tmp/owner-pw-out.json; echo; exit 1; }
# smoke login
HTTP=$(curl -sk -o /tmp/owner-login.json -w "%{http_code}" -X POST \
  https://desk-v2.165.22.211.20.sslip.io/v1/auth/hotel/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$OWNER_PASSWORD\"}")
echo "login HTTP $HTTP"
node -e 'const j=require("/tmp/owner-login.json"); console.log({ok:j.ok,slug:j.property&&j.property.slug,props:(j.properties||[]).length})'
[[ "$HTTP" == "200" ]]
