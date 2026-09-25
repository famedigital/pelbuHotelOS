#!/bin/bash
set -euo pipefail

echo "== current innora =="
docker ps --filter name=innora --format '{{.Names}} {{.Status}} {{.Image}}'
docker inspect innora --format '{{range $k, $v := .Config.Labels}}{{println $k "=" $v}}{{end}}' | grep -iE 'traefik|caddy' || true

echo "== recreate with innorahotel.com + sslip =="
FQDN_SSLIP=zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io
FQDN_APEX=innorahotel.com
FQDN_WWW=www.innorahotel.com

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

sleep 5
docker ps --filter name=innora --format '{{.Names}} {{.Status}}'
docker inspect innora --format '{{range $k, $v := .Config.Labels}}{{println $k "=" $v}}{{end}}' | grep -iE 'traefik.http.routers' || true

echo "== local curls =="
curl -sS -o /dev/null -w "sslip=%{http_code}\n" -H "Host: ${FQDN_SSLIP}" http://127.0.0.1/erp/login || true
# Hit via coolify-proxy published ports if any
curl -sS -o /dev/null -w "proxy80_host_apex=%{http_code}\n" -H "Host: ${FQDN_APEX}" http://127.0.0.1/ || true
curl -sS -o /dev/null -w "proxy80_host_www=%{http_code}\n" -H "Host: ${FQDN_WWW}" http://127.0.0.1/ || true

# Traefik may listen on other ports via coolify-proxy
docker port coolify-proxy 2>/dev/null || true
PROXY_IP=$(docker inspect coolify-proxy --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' | head -1)
echo "proxy_ip=${PROXY_IP}"
if [ -n "$PROXY_IP" ]; then
  curl -sS -o /dev/null -w "via_proxy_apex=%{http_code}\n" -H "Host: ${FQDN_APEX}" "http://${PROXY_IP}/" || true
  curl -sS -o /dev/null -w "via_proxy_sslip=%{http_code}\n" -H "Host: ${FQDN_SSLIP}" "http://${PROXY_IP}/erp/login" || true
fi

echo DONE
