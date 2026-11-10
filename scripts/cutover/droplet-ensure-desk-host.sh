#!/usr/bin/env bash
# Recreate desk Traefik labels including desk.innorahotel.com (DNS must exist in Cloudflare).
set -euo pipefail
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env up -d hos-v2-desk hos-v2-web
sleep 3
echo "=== Host desk.innorahotel.com ==="
curl -skI -H 'Host: desk.innorahotel.com' https://127.0.0.1/login/hotel | head -15
echo "=== public DNS hint ==="
echo "Cloudflare: add CNAME desk → innorahotel.com (proxied) OR A desk → droplet IP, then wait for cert."
