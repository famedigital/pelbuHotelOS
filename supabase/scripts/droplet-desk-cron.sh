#!/bin/bash
# Host timer for the droplet. vercel.json crons do not run here.
# Install once on the server (times are UTC; 18:00 UTC is midnight Thimphu):
#   5 2 * * *  /opt/pelbu-hotel/supabase/scripts/droplet-desk-cron.sh expire-holds
#   20 2 * * * /opt/pelbu-hotel/supabase/scripts/droplet-desk-cron.sh notifications
#   0 18 * * * /opt/pelbu-hotel/supabase/scripts/droplet-desk-cron.sh night-audit
set -euo pipefail

ENVF="${HOTEL_ENV_FILE:-/root/pelbu-hotel.env}"
BASE="${HOTEL_CRON_BASE:-http://127.0.0.1:3000}"

secret=""
if [ -f "$ENVF" ]; then
  secret="$(grep -E '^CRON_SECRET=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '\r"')"
fi

auth=()
if [ -n "$secret" ]; then
  auth=(-H "Authorization: Bearer ${secret}")
fi

job="${1:-}"
case "$job" in
  expire-holds) path="/api/cron/expire-holds" ;;
  notifications) path="/api/staff/notifications/drain" ;;
  night-audit) path="/api/cron/night-audit" ;;
  *)
    echo "usage: $0 expire-holds|notifications|night-audit" >&2
    exit 2
    ;;
esac

curl -fsS "${auth[@]}" "${BASE}${path}"
echo
