#!/usr/bin/env bash
set -euo pipefail
BODY='{"email":"pelnusuites@gmail.com","password":"testtest","role":"agent"}'
echo "=== direct API portal email-login ==="
curl -sS -o /tmp/portal-login.json -w "HTTP %{http_code}\n" -X POST http://127.0.0.1:4200/v1/auth/portal/email-login \
  -H 'content-type: application/json' \
  -d "$BODY"
cat /tmp/portal-login.json; echo
echo "=== hotel email-login routes ==="
for path in \
  /v1/auth/hotel/email-login \
  /v1/auth/hotel/login \
  /v1/auth/email-login \
  /v1/auth/desk/email-login
do
  code=$(curl -sS -o /tmp/h.json -w "%{http_code}" -X POST "http://127.0.0.1:4200$path" \
    -H 'content-type: application/json' \
    -d '{"email":"pelnusuites@gmail.com","password":"testtest"}' || true)
  echo "$code $path $(head -c 120 /tmp/h.json)"
done
echo "=== container env ==="
docker exec hos-v2-hos-v2-api-1 printenv | grep -E 'DATABASE_URL|SUPABASE' | sed 's/=.*/=SET/' || true
echo "=== registered? grep dist ==="
docker exec hos-v2-hos-v2-api-1 sh -c 'grep -R "hotel/email-login" /app/apps/api/dist 2>/dev/null | head -5' || true
echo "=== recent api log ==="
docker logs --tail 50 hos-v2-hos-v2-api-1 2>&1 | tail -50
