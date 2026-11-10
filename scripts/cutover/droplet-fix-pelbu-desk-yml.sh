#!/usr/bin/env bash
set -euo pipefail
# Stale Coolify file provider (priority 10000) pointed innorahotel.com → :3000 (Innora).
# Retarget to hos-v2-desk :80 on coolify network.
IP=$(docker inspect hos-v2-hos-v2-desk-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{if eq $k "coolify"}}{{$v.IPAddress}}{{end}}{{end}}')
[[ -n "$IP" ]] || { echo "no desk coolify IP"; exit 1; }

cp -a /data/coolify/proxy/dynamic/pelbu-desk.yml \
  "/data/coolify/proxy/dynamic/pelbu-desk.yml.bak.$(date +%s)"

cat > /data/coolify/proxy/dynamic/pelbu-desk.yml <<YAML
http:
  routers:
    pelbu-desk-live:
      rule: Host(\`zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io\`) || Host(\`innorahotel.com\`) || Host(\`www.innorahotel.com\`)
      priority: 10000
      entryPoints:
        - http
      middlewares:
        - pelbu-desk-https-redirect
      service: pelbu-desk-live
    pelbu-desk-live-https:
      rule: Host(\`zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io\`) || Host(\`innorahotel.com\`) || Host(\`www.innorahotel.com\`)
      priority: 10000
      entryPoints:
        - https
      tls: {}
      service: pelbu-desk-live
  middlewares:
    pelbu-desk-https-redirect:
      redirectScheme:
        scheme: https
  services:
    pelbu-desk-live:
      loadBalancer:
        servers:
          - url: http://${IP}:80
YAML

echo "pelbu-desk.yml → http://${IP}:80"
sleep 2
for H in innorahotel.com www.innorahotel.com desk-v2.165.22.211.20.sslip.io; do
  echo "-- $H"
  curl -skI -H "Host: $H" https://127.0.0.1/ | head -8
  curl -sk -H "Host: $H" https://127.0.0.1/health; echo
done
