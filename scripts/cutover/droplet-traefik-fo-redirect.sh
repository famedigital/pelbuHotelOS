#!/usr/bin/env bash
# Route former Innora hosts to hos-v2-desk (FO cutover). Uses Coolify Traefik file provider.
set -euo pipefail

DYNAMIC_HOST=/data/coolify/proxy/dynamic
DYNAMIC_CTR=/traefik/dynamic
mkdir -p "$DYNAMIC_HOST"

cat > "$DYNAMIC_HOST/hos-v2-fo.yml" <<'YAML'
http:
  routers:
    hos-v2-fo-http:
      entryPoints:
        - http
      rule: "Host(`innorahotel.com`) || Host(`www.innorahotel.com`) || Host(`zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io`)"
      middlewares:
        - hos-v2-fo-https
      service: hos-v2-fo-svc
    hos-v2-fo-https:
      entryPoints:
        - https
      rule: "Host(`innorahotel.com`) || Host(`www.innorahotel.com`) || Host(`zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io`)"
      tls: true
      service: hos-v2-fo-svc
  middlewares:
    hos-v2-fo-https:
      redirectScheme:
        scheme: https
  services:
    hos-v2-fo-svc:
      loadBalancer:
        servers:
          - url: "http://hos-v2-hos-v2-desk-1:80"
YAML

# Ensure coolify-proxy can resolve desk container (same coolify network)
docker network connect coolify hos-v2-hos-v2-desk-1 2>/dev/null || true

echo "Wrote $DYNAMIC_HOST/hos-v2-fo.yml"
sleep 2
echo "=== probe Host innorahotel.com via local :443 ==="
curl -skI -H 'Host: innorahotel.com' https://127.0.0.1/ | head -15
curl -sk -H 'Host: innorahotel.com' https://127.0.0.1/health | head -c 200; echo
echo "=== desk-v2 still OK ==="
curl -sf https://desk-v2.165.22.211.20.sslip.io/health; echo
