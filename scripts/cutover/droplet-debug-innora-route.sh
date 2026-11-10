#!/usr/bin/env bash
set -euo pipefail
echo "=== dynamic files ==="
ls -la /data/coolify/proxy/dynamic/ || true
grep -Rni 'innorahotel\|innora' /data/coolify/proxy/dynamic/ 2>/dev/null | head -40 || true

echo "=== innora-rollback labels / state ==="
docker ps -a --filter name=innora --format '{{.Names}} {{.Status}}'
docker inspect innora-rollback --format '{{json .Config.Labels}}' 2>/dev/null | tr ',' '\n' | grep traefik | head -30 || true

echo "=== all containers with innorahotel label ==="
for c in $(docker ps -aq); do
  if docker inspect "$c" --format '{{json .Config.Labels}}' | grep -q innorahotel; then
    docker inspect "$c" --format '{{.Name}} {{.State.Status}}'
    docker inspect "$c" --format '{{json .Config.Labels}}' | tr ',' '\n' | grep -E 'traefik.http.routers|traefik.enable|loadbalancer' | head -20
    echo '---'
  fi
done

echo "=== desk coolify IP + wget from proxy ==="
IP=$(docker inspect hos-v2-hos-v2-desk-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{if eq $k "coolify"}}{{$v.IPAddress}}{{end}}{{end}}')
echo "IP=$IP"
docker exec coolify-proxy wget -qO- --timeout=3 "http://$IP/health" || echo wget-fail

# Force disable traefik on retired innora
if docker ps -aq --filter name=innora-rollback | grep -q .; then
  docker update --label-add "traefik.enable=false" innora-rollback || true
  # Also strip by recreating labels is hard; disconnect from coolify network
  docker network disconnect coolify innora-rollback 2>/dev/null || true
  echo "disconnected innora-rollback from coolify"
fi
sleep 3
curl -skI -H 'Host: innorahotel.com' https://127.0.0.1/ | head -15
curl -sk -H 'Host: innorahotel.com' https://127.0.0.1/health | head -c 200; echo
