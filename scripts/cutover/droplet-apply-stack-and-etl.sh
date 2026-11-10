#!/usr/bin/env bash
# Unpack hos-v2-cutover.tgz, deploy API+desk, re-run ETL 01+02, shadow report.
# Does NOT set V2_DESK_CUTOVER (use droplet-flip-fo-to-v2.sh on).
set -euo pipefail

echo "=== unpack /opt/hos-v2 ==="
mkdir -p /opt/hos-v2
tar -xzf /tmp/hos-v2-cutover.tgz -C /opt/hos-v2
cp -f /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2/droplet-deploy-v2-stack.sh
cp -f /tmp/droplet-deploy-v2-api.sh /opt/hos-v2/droplet-deploy-v2-api.sh 2>/dev/null || true
chmod +x /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2/droplet-deploy-v2-stack.sh
chmod +x /tmp/droplet-provision-v2-app-role.sh 2>/dev/null || true
chmod +x /tmp/droplet-run-etl.sh /tmp/droplet-run-ops-etl.sh /tmp/droplet-shadow-report.sh /tmp/droplet-smoke-v2-desk.sh /tmp/droplet-flip-fo-to-v2.sh

# Normalize ETL SQL names if scp dumped basename-only
if [[ -f /tmp/01_org_properties_rooms_staff.sql ]]; then
  cp -f /tmp/01_org_properties_rooms_staff.sql /tmp/01_etl.sql
fi
if [[ -f /tmp/02_agents_bookings_folios.sql ]]; then
  cp -f /tmp/02_agents_bookings_folios.sql /tmp/02_etl.sql
fi

echo "=== ETL 01 inventory ==="
bash /tmp/droplet-run-etl.sh /tmp/01_etl.sql

echo "=== ETL 02 ops (upsert agents, no DELETE) ==="
bash /tmp/droplet-run-ops-etl.sh /tmp/02_etl.sql

echo "=== deploy stack ==="
bash /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2

echo "=== shadow ==="
bash /tmp/droplet-shadow-report.sh || true

echo "=== smoke desk ==="
bash /tmp/droplet-smoke-v2-desk.sh http://127.0.0.1:4280

echo "=== STACK+ETL DONE (flag still false) ==="
echo "Parallel URL: https://desk-v2.165.22.211.20.sslip.io/"
