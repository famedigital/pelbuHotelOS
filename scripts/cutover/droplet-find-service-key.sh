#!/usr/bin/env bash
set -euo pipefail
echo "=== containers ==="
docker ps --format '{{.Names}}' | head -40
echo "=== hunt SERVICE_ROLE ==="
for c in $(docker ps --format '{{.Names}}'); do
  hit=$(docker exec "$c" sh -c 'printenv 2>/dev/null | grep -E "SERVICE_ROLE|SERVICE_KEY" | sed "s/=.*/=***/"' 2>/dev/null || true)
  if [[ -n "$hit" ]]; then
    echo "--- $c ---"
    echo "$hit"
  fi
done
echo "=== coolify env files with SERVICE ==="
find /data/coolify -name '.env' 2>/dev/null | head -20 | while read -r f; do
  if grep -q SERVICE_ROLE "$f" 2>/dev/null; then
    echo "$f"
    grep -E 'SERVICE_ROLE|SUPABASE_URL' "$f" | sed 's/=.*/=***/'
  fi
done
