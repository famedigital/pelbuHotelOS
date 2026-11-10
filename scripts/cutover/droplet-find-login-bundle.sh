#!/usr/bin/env bash
set -euo pipefail
docker exec innora sh -c 'ls -la /app | head -30; echo ---; find /app -iname "*agents*login*" 2>/dev/null | head -40; echo ---; find /app -name "route.js" 2>/dev/null | grep agents | head'
