#!/usr/bin/env bash
set -euo pipefail
docker inspect hos-v2-hos-v2-desk-1 --format '{{json .NetworkSettings.Networks}}' > /tmp/desk-nets.json
python3 - <<'PY'
import json
nets=json.load(open("/tmp/desk-nets.json"))
for name, cfg in nets.items():
  print(name, "IP", cfg.get("IPAddress"), "aliases", cfg.get("Aliases"))
PY
echo "=== ping from proxy ==="
DESK_IP=$(python3 -c 'import json; d=json.load(open("/tmp/desk-nets.json")); print(d.get("coolify",{}).get("IPAddress") or "")')
echo "desk coolify IP=$DESK_IP"
docker exec coolify-proxy wget -qO- --timeout=3 "http://${DESK_IP}/health" || true
docker exec coolify-proxy wget -qO- --timeout=3 "http://hos-v2-hos-v2-desk-1/health" || true
# rewrite FO yml to use IP
if [[ -n "$DESK_IP" ]]; then
  cat > /data/coolify/proxy/dynamic/hos-v2-fo.yml <<YAML
http:
  routers:
    hos-v2-fo-http:
      entryPoints: [http]
      rule: "Host(\`innorahotel.com\`) || Host(\`www.innorahotel.com\`) || Host(\`zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io\`)"
      middlewares: [hos-v2-fo-https]
      service: hos-v2-fo-svc
    hos-v2-fo-https:
      entryPoints: [https]
      rule: "Host(\`innorahotel.com\`) || Host(\`www.innorahotel.com\`) || Host(\`zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io\`)"
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
          - url: "http://${DESK_IP}:80"
YAML
  echo "rewrote FO yml to $DESK_IP"
  sleep 2
  curl -skI -H 'Host: innorahotel.com' https://127.0.0.1/ | head -12
  curl -sk -H 'Host: innorahotel.com' https://127.0.0.1/health; echo
fi
