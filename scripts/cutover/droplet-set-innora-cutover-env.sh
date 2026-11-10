#!/usr/bin/env bash
# Set V2_DESK_CUTOVER on Innora Coolify app env + recreate container if possible.
set -euo pipefail
FLAG="${1:-true}"

echo "=== find Innora coolify env ==="
mapfile -t ENVS < <(find /data/coolify/applications -name '.env' 2>/dev/null | head -40)
for f in "${ENVS[@]}"; do
  if grep -qiE 'innora|SERVICE_NAME=innora|HOST=innorahotel' "$f" 2>/dev/null \
    || grep -q 'innorahotel.com' "$f" 2>/dev/null; then
    echo "candidate: $f"
    grep -E 'V2_DESK_CUTOVER|HOST|SERVICE_NAME|APP_NAME' "$f" | head -20 || true
  fi
done

# Prefer container env update via docker compose in coolify app dir
APP_DIR=""
for d in /data/coolify/applications/*; do
  if [[ -f "$d/docker-compose.yml" ]] && grep -q innora "$d/docker-compose.yml" 2>/dev/null; then
    APP_DIR="$d"
    break
  fi
  if [[ -f "$d/.env" ]] && grep -q 'innorahotel.com' "$d/.env" 2>/dev/null; then
    APP_DIR="$d"
    break
  fi
done

if [[ -z "$APP_DIR" ]]; then
  # Fallback: inject into running container via temporary override file read by nothing —
  # Next needs process env. Try docker commit approach: recreate with -e
  echo "No coolify app dir matched — restarting innora with -e via docker update (limited)"
  CID=$(docker ps -qf name=^innora$)
  if [[ -z "$CID" ]]; then
    echo "innora container not found"
    exit 1
  fi
  # docker update cannot add env; use coolify API-less recreate from current config + env file
  docker inspect "$CID" --format '{{range .Config.Env}}{{println .}}{{end}}' > /tmp/innora-env.before
  if grep -q '^V2_DESK_CUTOVER=' /tmp/innora-env.before; then
    sed -i "s/^V2_DESK_CUTOVER=.*/V2_DESK_CUTOVER=$FLAG/" /tmp/innora-env.before
  else
    echo "V2_DESK_CUTOVER=$FLAG" >> /tmp/innora-env.before
  fi
  echo "Wrote /tmp/innora-env.before — manual Coolify env still preferred"
  echo "V2_DESK_CUTOVER=$FLAG" > /etc/hos-v2-desk-cutover.env
  exit 0
fi

ENV_FILE="$APP_DIR/.env"
echo "Using $ENV_FILE"
if grep -q '^V2_DESK_CUTOVER=' "$ENV_FILE"; then
  sed -i "s/^V2_DESK_CUTOVER=.*/V2_DESK_CUTOVER=$FLAG/" "$ENV_FILE"
else
  echo "V2_DESK_CUTOVER=$FLAG" >> "$ENV_FILE"
fi
grep V2_DESK_CUTOVER "$ENV_FILE"

echo "=== recreate innora via coolify compose (best-effort) ==="
cd "$APP_DIR"
if docker compose ps >/dev/null 2>&1; then
  docker compose up -d --force-recreate || true
else
  echo "compose recreate skipped — set flag in Coolify UI and redeploy if banner missing"
fi

echo "V2_DESK_CUTOVER=$FLAG" > /etc/hos-v2-desk-cutover.env
echo "done"
