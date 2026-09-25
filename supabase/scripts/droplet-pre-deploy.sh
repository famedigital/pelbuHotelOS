#!/bin/bash
# Pre-deploy: free RAM/tmp for a faster Coolify/BuildKit build.
# Keeps Docker BuildKit layer cache (do NOT prune builder here).
set -euo pipefail

echo "======== PRE-DEPLOY (keep build cache) ========"
free -h | sed -n '1,3p'
df -h / | tail -1

echo "======== tmp / probe leftovers ========"
rm -f /tmp/probe-*.sh /tmp/probe-*.mjs /tmp/run-probe-*.sh \
  /tmp/ih.html /tmp/pub-ih.html /tmp/out.html \
  /tmp/fdv.json /tmp/innora_health_body.txt /tmp/_db_probe.sql \
  /tmp/coolify_*.sh 2>/dev/null || true
# Keep /tmp/droplet-pre-deploy.sh, droplet-post-deploy.sh, deploy-innora*.sh

echo "======== stopped containers + dangling images only ========"
docker container prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true

echo "======== drop page cache if memory tight ========"
sync
echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true

echo "======== AFTER PRE ========"
free -h | sed -n '1,3p'
df -h / | tail -1
docker system df
echo "PRE_DEPLOY_OK"
