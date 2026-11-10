#!/usr/bin/env bash
# Copy patched agent login sources into innora and rebuild Next route.
set -euo pipefail
SRC_HOST="${1:?host path to Hotel OS web/src}"

docker cp "$SRC_HOST/app/api/agents/login/route.ts" innora:/app/src/app/api/agents/login/route.ts
docker cp "$SRC_HOST/app/actions/agent-auth.ts" innora:/app/src/app/actions/agent-auth.ts
docker cp "$SRC_HOST/components/erp/AgentAuthForms.tsx" innora:/app/src/components/erp/AgentAuthForms.tsx
docker cp "$SRC_HOST/app/agents/login/page.tsx" innora:/app/src/app/agents/login/page.tsx

echo "Rebuilding Next (this may take a few minutes)…"
docker exec innora sh -c 'cd /app && npm run build'
echo "Restarting innora…"
docker restart innora
sleep 8
docker exec innora sh -c 'wget -qO- http://127.0.0.1:3000/agents/login 2>/dev/null | head -c 200 || curl -sS http://127.0.0.1:3000/agents/login | head -c 200'
echo
echo "DONE"
