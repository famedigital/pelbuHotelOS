#!/bin/bash
set -euo pipefail
echo "======== BEFORE ========"
echo "--- host ---"
uptime
free -h
df -h / /var/lib/docker 2>/dev/null || df -h /
echo "--- top mem processes ---"
ps aux --sort=-%mem | head -15
echo "--- docker ---"
docker system df
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Size}}' 2>/dev/null | head -40
echo "--- largest docker dirs ---"
du -sh /var/lib/docker/* 2>/dev/null | sort -hr | head -15 || true
echo "--- journal size ---"
journalctl --disk-usage 2>/dev/null || true
echo "--- apt cache ---"
du -sh /var/cache/apt/archives 2>/dev/null || true
echo "--- tmp ---"
du -sh /tmp /var/tmp 2>/dev/null || true
echo "--- buildkit ---"
docker buildx du 2>/dev/null | head -20 || true
ls -la /opt/pelbu-hotel 2>/dev/null | head -5
du -sh /opt/pelbu-hotel 2>/dev/null || true
