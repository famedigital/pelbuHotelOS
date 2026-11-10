#!/usr/bin/env bash
# Build + start hos-v2-api + hos-v2-desk + hos-v2-web on droplet.
set -euo pipefail

ROOT="${1:-/opt/hos-v2}"
COMPOSE_FILE="$ROOT/docker-compose.cutover.yml"
DESK_PORT="${DESK_PORT:-4280}"
WEB_PORT="${WEB_PORT:-4282}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $COMPOSE_FILE — sync v2/ tree first"
  exit 1
fi

if [[ ! -f /tmp/hos-v2-dburl.env ]] || ! grep -q '://v2_app:' /tmp/hos-v2-dburl.env; then
  echo "Provisioning v2_app DATABASE_URL (ADR 001)..."
  bash /tmp/droplet-provision-v2-app-role.sh
fi

if ! grep -q '://v2_app:' /tmp/hos-v2-dburl.env; then
  echo "Refusing deploy: DATABASE_URL must use v2_app (got non-v2_app URL)"
  exit 1
fi

# Inject Supabase anon key for hotel email/password (GoTrue) if missing.
if ! grep -qE '^SUPABASE_ANON_KEY=.+' /tmp/hos-v2-dburl.env 2>/dev/null; then
  ANON=""
  for c in $(docker ps --format '{{.Names}}'); do
    case "$c" in
      *kong*|*auth*|innora*|supabase*)
        ANON="$(docker exec "$c" printenv ANON_KEY 2>/dev/null || true)"
        [[ -z "$ANON" ]] && ANON="$(docker exec "$c" printenv SUPABASE_ANON_KEY 2>/dev/null || true)"
        [[ -z "$ANON" ]] && ANON="$(docker exec "$c" printenv NEXT_PUBLIC_SUPABASE_ANON_KEY 2>/dev/null || true)"
        [[ -z "$ANON" ]] && ANON="$(docker exec "$c" printenv JWT_ANON_KEY 2>/dev/null || true)"
        [[ -n "$ANON" ]] && break
        ;;
    esac
  done
  if [[ -z "$ANON" ]]; then
    ANON="$(grep -RhoE 'eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' /opt/supabase /data/coolify 2>/dev/null | head -1 || true)"
  fi
  if [[ -n "$ANON" ]]; then
    printf '\nSUPABASE_ANON_KEY=%s\nSUPABASE_URL=%s\nSUPABASE_AUTH_URL=%s\n' \
      "$ANON" \
      "${SUPABASE_URL:-http://supabase-envoy:8000}" \
      "${SUPABASE_AUTH_URL:-http://supabase-envoy:8000/auth/v1}" \
      >> /tmp/hos-v2-dburl.env
    echo "Injected SUPABASE_ANON_KEY (len=${#ANON})"
  else
    echo "WARN: SUPABASE_ANON_KEY not found — hotel email login will 503 until set"
  fi
fi

cd "$ROOT"
# Drop stale Next leftovers so Vite web builds cleanly after tarball overlay.
rm -rf apps/web/src/app apps/web/src/middleware.ts apps/web/src/components \
  apps/web/next.config.mjs apps/web/next-env.d.ts apps/web/.next 2>/dev/null || true
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env up -d --build

sleep 8

echo "=== API /health (localhost:4200) ==="
if curl -sf "http://127.0.0.1:4200/health"; then
  echo
  echo "API health OK"
else
  echo "API health failed — recent logs ==="
  docker logs --tail 100 "$(docker compose -f docker-compose.cutover.yml ps -q hos-v2-api)" || true
  exit 1
fi

echo "=== Desk / via :${DESK_PORT} ==="
if curl -sf "http://127.0.0.1:${DESK_PORT}/" | head -c 200 | grep -qiE 'html|root|hotel|vite|script'; then
  echo "Desk SPA OK"
else
  CODE=$(curl -s -o /tmp/hos-v2-desk-home.html -w "%{http_code}" "http://127.0.0.1:${DESK_PORT}/" || true)
  if [[ "$CODE" == "200" ]]; then
    echo "Desk HTTP 200 OK"
  else
    echo "Desk failed HTTP $CODE"
    docker logs --tail 80 "$(docker compose -f docker-compose.cutover.yml ps -q hos-v2-desk)" || true
    exit 1
  fi
fi

echo "=== Public web / via :${WEB_PORT} ==="
CODE=$(curl -s -o /tmp/hos-v2-web-home.html -w "%{http_code}" "http://127.0.0.1:${WEB_PORT}/" || true)
if [[ "$CODE" == "200" ]] && grep -qiE 'Innora|Hotel OS|html' /tmp/hos-v2-web-home.html; then
  echo "Public web HTTP 200 OK"
else
  echo "Public web failed HTTP $CODE"
  docker logs --tail 80 "$(docker compose -f docker-compose.cutover.yml ps -q hos-v2-web)" || true
  exit 1
fi

echo "=== Desk→API /health proxy ==="
if curl -sf "http://127.0.0.1:${DESK_PORT}/health"; then
  echo
  echo "Desk→API /health proxy OK"
else
  echo "Desk→API proxy failed"
  docker logs --tail 80 "$(docker compose -f docker-compose.cutover.yml ps -q hos-v2-desk)" || true
  exit 1
fi

echo "=== deploy stack done ==="
echo "Desk: https://desk-v2.165.22.211.20.sslip.io/  Public: https://innorahotel.com/"
chmod 600 /tmp/hos-v2-dburl.env
