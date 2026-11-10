#!/usr/bin/env bash
# Option C batch: close orphan in-house → re-ETL ops → deploy hos-v2-api → smoke.
# Does NOT set V2_DESK_CUTOVER.
set -euo pipefail

echo "=== 1) checkout overdue orphans ==="
bash /tmp/olakha-checkout-orphans.sh

echo "=== 2) re-run ops ETL ==="
if [[ -f /tmp/02_etl.sql ]]; then
  bash /tmp/droplet-run-ops-etl.sh /tmp/02_etl.sql
else
  echo "WARN: /tmp/02_etl.sql missing — skip ETL re-run"
fi

echo "=== 3) unpack API tree if present ==="
if [[ -f /tmp/hos-v2-cutover.tgz ]]; then
  mkdir -p /opt/hos-v2
  tar -xzf /tmp/hos-v2-cutover.tgz -C /opt/hos-v2
  cp -f /tmp/droplet-deploy-v2-api.sh /opt/hos-v2/ 2>/dev/null || true
fi

echo "=== 4) deploy API + desk stack ==="
if [[ -f /tmp/droplet-deploy-v2-stack.sh ]]; then
  bash /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2
else
  bash /tmp/droplet-deploy-v2-api.sh /opt/hos-v2
fi

echo "=== 5) smoke ==="
bash /tmp/droplet-smoke-v2-api.sh http://127.0.0.1:4200
if [[ -f /tmp/droplet-smoke-v2-desk.sh ]]; then
  bash /tmp/droplet-smoke-v2-desk.sh http://127.0.0.1:4280 || true
fi

echo "=== OPTION C COMPLETE — use droplet-flip-fo-to-v2.sh on for production FO URL ==="
