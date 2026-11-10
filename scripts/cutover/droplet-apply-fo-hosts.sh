#!/usr/bin/env bash
set -euo pipefail
# Remove broken file-provider FO route; recreate desk with expanded Host labels.
rm -f /data/coolify/proxy/dynamic/hos-v2-fo.yml
cp -f /tmp/docker-compose.cutover.yml /opt/hos-v2/docker-compose.cutover.yml
cd /opt/hos-v2
docker compose -f docker-compose.cutover.yml --env-file /tmp/hos-v2-dburl.env up -d hos-v2-desk
sleep 4
echo "=== labels ==="
docker inspect hos-v2-hos-v2-desk-1 --format '{{json .Config.Labels}}' | tr ',' '\n' | grep 'routers.hos-v2-desk' | head -20
echo "=== Host probes ==="
for H in desk-v2.165.22.211.20.sslip.io innorahotel.com www.innorahotel.com; do
  echo "-- $H"
  curl -skI -H "Host: $H" https://127.0.0.1/ | head -8
  curl -sk -H "Host: $H" https://127.0.0.1/health | head -c 120; echo
done
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'hos-v2|innora'
