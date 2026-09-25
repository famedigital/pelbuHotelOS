#!/bin/bash
# Safe droplet housekeeping for Innora + Coolify + Supabase stack.
# Does NOT remove named volumes (DB data) or running containers.
set -euo pipefail

echo "======== BEFORE ========"
free -h | sed -n '1,3p'
df -h / | tail -1
docker system df

echo "======== 1) apt package cache ========"
apt-get clean || true
rm -rf /var/cache/apt/archives/partial/* 2>/dev/null || true
du -sh /var/cache/apt/archives 2>/dev/null || true

echo "======== 2) journal trim (keep 7 days / 200M) ========"
journalctl --vacuum-time=7d --vacuum-size=200M 2>/dev/null || true

echo "======== 3) docker build cache (biggest win) ========"
# Aggressive: free all build cache. Next deploy rebuilds layers (slower once).
docker builder prune -af || true
docker buildx prune -af || true
docker buildx prune -af --builder coolify-railpack 2>/dev/null || true
docker exec buildx_buildkit_coolify-railpack0 buildctl prune --all 2>/dev/null || true

echo "======== 4) dangling images + stopped containers ========"
docker container prune -f || true
docker image prune -f || true
# Remove unused images not referenced by any container (keeps currently running tags)
docker image prune -af || true

echo "======== 5) unused networks ========"
docker network prune -f || true

echo "======== 6) tmp probe / deploy leftovers ========"
rm -f /tmp/probe-*.sh /tmp/probe-*.mjs /tmp/run-probe-*.sh /tmp/deploy-innora-droplet.sh \
  /tmp/droplet-*.sh /tmp/ih.html /tmp/pub-ih.html /tmp/out.html /tmp/fdv.json \
  /tmp/innora_health_body.txt /tmp/_db_probe.sql 2>/dev/null || true
# Keep /opt/pelbu-hotel — that's the deploy checkout, not cache.

echo "======== 7) drop page caches if memory tight (safe) ========"
# Sync then drop filesystem page cache only — does not kill processes or DB.
sync
echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true

echo "======== AFTER ========"
free -h | sed -n '1,3p'
df -h / | tail -1
docker system df
uptime
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -25
echo "OPTIMIZE_OK"
