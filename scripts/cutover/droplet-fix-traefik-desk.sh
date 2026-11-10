#!/usr/bin/env bash
set -euo pipefail

echo "=== coolify-proxy providers / dynamic ==="
docker exec coolify-proxy sh -c 'ls /etc/traefik 2>/dev/null; ls /data/coolify/proxy 2>/dev/null; ls /traefik 2>/dev/null' || true
docker inspect coolify-proxy --format '{{json .Args}}' | head -c 2000; echo
docker inspect coolify-proxy --format '{{json .Config.Cmd}}' | head -c 2000; echo

echo "=== curl Host header via coolify-proxy :80 ==="
curl -sI -H 'Host: desk-v2.165.22.211.20.sslip.io' http://127.0.0.1/ | head -20
curl -s -H 'Host: desk-v2.165.22.211.20.sslip.io' http://127.0.0.1/health | head -c 200; echo

echo "=== staff endpoint raw ==="
OLAKHA=d06e89f8-86e6-4201-bbd2-5e115d422357
curl -sS "http://127.0.0.1:4280/v1/auth/staff?propertyId=$OLAKHA" | head -c 800; echo
curl -sS "http://127.0.0.1:4200/v1/auth/staff?propertyId=$OLAKHA" | head -c 800; echo

echo "=== stayview raw ==="
curl -sS "http://127.0.0.1:4280/v1/stayview?propertyId=$OLAKHA" | head -c 400; echo
