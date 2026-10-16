#!/bin/bash
set -euo pipefail
cd /opt/pelbu-hotel

echo "== sync to origin/main =="
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "HEAD=$(git rev-parse --short HEAD)"

echo "== extract build args =="
ENVF=/root/pelbu-hotel.env
get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENVF" | head -1 | cut -d= -f2- | sed 's/\r$//' | sed 's/^"//; s/"$//'
}
SUPABASE_URL=$(get_env NEXT_PUBLIC_SUPABASE_URL)
ANON_KEY=$(get_env NEXT_PUBLIC_SUPABASE_ANON_KEY)
SITE_URL=$(get_env NEXT_PUBLIC_SITE_URL)
echo "SUPABASE_URL set=$( [ -n "$SUPABASE_URL" ] && echo yes || echo no )"

echo "== docker build innora:local (BuildKit; keep layer cache) =="
export DOCKER_BUILDKIT=1
# Bare --cache-from TAG hits the registry and fails for local-only tags.
docker build \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}" \
  --build-arg "NEXT_PUBLIC_SITE_URL=${SITE_URL}" \
  -t innora:local \
  -f Dockerfile \
  .

FQDN_SSLIP=zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io
FQDN_APEX=innorahotel.com
FQDN_WWW=www.innorahotel.com
echo "== recreate container innora =="
docker rm -f innora pelbu-hotel 2>/dev/null || true
docker run -d --name innora --restart unless-stopped \
  --network coolify \
  --env-file /root/pelbu-hotel.env \
  -e HOSTNAME=0.0.0.0 -e PORT=3000 -e NODE_ENV=production \
  -l traefik.enable=true \
  -l "traefik.http.routers.innora.rule=Host(\`${FQDN_SSLIP}\`) || Host(\`${FQDN_APEX}\`) || Host(\`${FQDN_WWW}\`)" \
  -l traefik.http.routers.innora.entryPoints=http \
  -l traefik.http.routers.innora.priority=100 \
  -l traefik.http.services.innora.loadbalancer.server.port=3000 \
  -l "traefik.http.routers.innora-https.rule=Host(\`${FQDN_APEX}\`) || Host(\`${FQDN_WWW}\`)" \
  -l traefik.http.routers.innora-https.entryPoints=https \
  -l traefik.http.routers.innora-https.tls=true \
  -l traefik.http.routers.innora-https.service=innora \
  -l traefik.http.routers.innora-https.priority=100 \
  innora:local

echo "== point Traefik file route at innora IP =="
# coolify-proxy dynamic/pelbu-desk.yml uses priority 10000 + hard-coded IP.
# Without this, traffic stays on Coolify zkgg* even when innora is healthy.
INNORA_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' innora | awk '{print $1}')
HOST_TRAEFIK=$(docker inspect coolify-proxy --format '{{range .Mounts}}{{if eq .Destination "/traefik"}}{{.Source}}{{end}}{{end}}')
YML="${HOST_TRAEFIK}/dynamic/pelbu-desk.yml"
if [ -n "$INNORA_IP" ] && [ -n "$HOST_TRAEFIK" ] && [ -f "$YML" ]; then
  cat > "$YML" <<EOF
http:
  routers:
    pelbu-desk-live:
      rule: Host(\`${FQDN_SSLIP}\`) || Host(\`${FQDN_APEX}\`) || Host(\`${FQDN_WWW}\`)
      priority: 10000
      entryPoints:
        - http
      service: pelbu-desk-live
    pelbu-desk-live-https:
      rule: Host(\`${FQDN_SSLIP}\`) || Host(\`${FQDN_APEX}\`) || Host(\`${FQDN_WWW}\`)
      priority: 10000
      entryPoints:
        - https
      tls: {}
      service: pelbu-desk-live
  services:
    pelbu-desk-live:
      loadBalancer:
        servers:
          - url: http://${INNORA_IP}:3000
EOF
  echo "pelbu-desk.yml -> http://${INNORA_IP}:3000"
else
  echo "WARN: could not update pelbu-desk.yml (ip=$INNORA_IP yml=$YML)"
fi

echo "== stop RAM-waste Next duplicates (optional) =="
docker stop pelbu-desk-live 2>/dev/null || true
docker ps --format '{{.Names}}' | grep -E '^zkggxjoxur9j8hxcghclplhw-' \
  | while read -r name; do
      echo "Stopping Coolify duplicate $name"
      docker stop -t 10 "$name" 2>/dev/null || true
    done

echo "== wait for health =="
sleep 8
docker ps --filter name=innora --format '{{.Names}} {{.Status}} {{.Image}}'
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  code=$(curl -sS -o /tmp/innora_health_body.txt -w '%{http_code}' "http://${FQDN_SSLIP}/erp/login" || echo 000)
  echo "attempt $i http=$code"
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "302" ]; then
    echo DEPLOY_OK commit=$(git rev-parse --short HEAD)
    exit 0
  fi
  sleep 5
done
echo DEPLOY_FAIL
docker logs innora --tail 120
exit 1
