#!/bin/bash
set -euo pipefail
# Light residue cleanup — keeps Docker build cache for faster next deploys.
rm -f /tmp/probe-*.sh /tmp/probe-*.mjs /tmp/run-probe-*.sh \
  /tmp/droplet-*.sh \
  /tmp/ih.html /tmp/pub-ih.html /tmp/out.html /tmp/fdv.json \
  /tmp/innora_health_body.txt /tmp/_db_probe.sql \
  /tmp/coolify_*.sh 2>/dev/null || true
# Do not delete /tmp/deploy-innora*.sh here — deploy may still be running.
docker container prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
echo "RESIDUE_CLEAN_OK"
