#!/bin/bash
set -euo pipefail
# Light residue cleanup — keeps Docker build cache for faster next deploys.
rm -f /tmp/probe-*.sh /tmp/probe-*.mjs /tmp/run-probe-*.sh \
  /tmp/deploy-innora-droplet.sh /tmp/droplet-*.sh \
  /tmp/ih.html /tmp/pub-ih.html /tmp/out.html /tmp/fdv.json \
  /tmp/innora_health_body.txt /tmp/_db_probe.sql \
  /tmp/coolify_*.sh /tmp/deploy_fast.sh 2>/dev/null || true
docker container prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
echo "RESIDUE_CLEAN_OK"
