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

echo "== docker build innora:local (BuildKit + cache-from) =="
export DOCKER_BUILDKIT=1
docker build \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}" \
  --build-arg "NEXT_PUBLIC_SITE_URL=${SITE_URL}" \
  --cache-from innora:local \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
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
  -l traefik.http.services.innora.loadbalancer.server.port=3000 \
  -l "traefik.http.routers.innora-https.rule=Host(\`${FQDN_APEX}\`) || Host(\`${FQDN_WWW}\`)" \
  -l traefik.http.routers.innora-https.entryPoints=https \
  -l traefik.http.routers.innora-https.tls=true \
  -l traefik.http.routers.innora-https.service=innora \
  innora:local

echo "== wait for health =="
sleep 12
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
