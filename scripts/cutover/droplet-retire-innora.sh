#!/usr/bin/env bash
# Retire Coolify Innora container (FO already on hos-v2-desk). Keeps image + compose for 7-day rollback.
# Does NOT touch supabase-db or other Coolify apps.
set -euo pipefail

echo "=== preflight: v2 desk must be healthy ==="
curl -sf https://desk-v2.165.22.211.20.sslip.io/health >/tmp/v2-health.json
cat /tmp/v2-health.json; echo
grep -q '"ok":true' /tmp/v2-health.json

echo "=== find innora ==="
CID=$(docker ps -aqf name=^innora$ | head -1)
if [[ -z "$CID" ]]; then
  echo "No innora container — already gone"
  exit 0
fi
docker inspect "$CID" --format 'name={{.Name}} status={{.State.Status}} started={{.State.StartedAt}}'
docker inspect "$CID" --format '{{json .Config.Labels}}' | tr ',' '\n' | grep -E 'traefik|coolify' | head -30 || true

echo "=== coolify app dirs (names only) ==="
ls /data/coolify/applications || true
for d in /data/coolify/applications/*; do
  [[ -d "$d" ]] || continue
  if [[ -f "$d/docker-compose.yaml" ]] || [[ -f "$d/docker-compose.yml" ]]; then
    if grep -qi innora "$d/docker-compose.yaml" "$d/docker-compose.yml" 2>/dev/null \
      || grep -qi innora "$d/.env" 2>/dev/null; then
      echo "MATCH $d"
      ls "$d" | head -20
    fi
  fi
done

echo "=== stop + rename off Traefik (keep container for rollback) ==="
docker stop innora
# Disable Traefik discovery so innorahotel.com stops routing to dead container
docker update --label-add traefik.enable=false innora 2>/dev/null || true
# Rename so Coolify/Traefik stop matching Host rules on a running container
docker rename innora innora-rollback 2>/dev/null || true

echo "=== marker ==="
cat > /etc/hos-v2-desk-cutover.env <<EOF
V2_DESK_CUTOVER=true
HOS_V2_DESK_URL=https://desk-v2.165.22.211.20.sslip.io/
INNORA_RETIRED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
INNORA_ROLLBACK_CONTAINER=innora-rollback
EOF
cat /etc/hos-v2-desk-cutover.env

echo "=== post: v2 still healthy ==="
curl -sf https://desk-v2.165.22.211.20.sslip.io/health; echo
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'hos-v2|innora' || true
echo "=== INNORA RETIRED (stopped). Rollback: docker start innora-rollback && docker update --label-add traefik.enable=true innora-rollback ==="
