#!/bin/bash
# Post-deploy droplet tidy: free disk without wiping BuildKit cache
# (next innora deploy stays warm). More aggressive than residue-clean;
# less destructive than droplet-optimize.sh builder prune -af.
set -euo pipefail

echo "======== POST-DEPLOY DROPLET ========"
free -h | sed -n '1,3p'
df -h / | tail -1
docker system df

echo "======== 1) apt + journal (light) ========"
apt-get clean >/dev/null 2>&1 || true
journalctl --vacuum-time=7d --vacuum-size=200M >/dev/null 2>&1 || true

echo "======== 2) stopped containers / dangling images ========"
docker container prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
# Remove unused images not referenced by running containers (keeps innora:local)
docker image prune -af >/dev/null 2>&1 || true

echo "======== 3) unused networks ========"
docker network prune -f >/dev/null 2>&1 || true

echo "======== 4) tmp residue (not active deploy scripts mid-run) ========"
rm -f /tmp/probe-*.sh /tmp/probe-*.mjs /tmp/run-probe-*.sh \
  /tmp/droplet-*.sh /tmp/ih.html /tmp/pub-ih.html /tmp/out.html \
  /tmp/fdv.json /tmp/innora_health_body.txt /tmp/_db_probe.sql \
  /tmp/coolify_*.sh /tmp/deploy-innora.sh /tmp/deploy-innora-droplet.sh \
  /tmp/droplet-pre-deploy.sh /tmp/droplet-post-deploy.sh \
  /tmp/droplet-residue-clean.sh 2>/dev/null || true

echo "======== 5) page cache ========"
sync
echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true

echo "======== AFTER POST ========"
free -h | sed -n '1,3p'
df -h / | tail -1
docker system df
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -20
echo "POST_DEPLOY_OK"
