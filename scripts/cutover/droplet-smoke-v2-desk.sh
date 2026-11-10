#!/usr/bin/env bash
# Smoke parallel v2 desk (:4280) — health proxy, auth properties, SPA.
# Does NOT flip V2_DESK_CUTOVER.
set -euo pipefail

BASE="${1:-http://127.0.0.1:4280}"

echo "=== desk SPA $BASE/ ==="
CODE=$(curl -s -o /tmp/hos-v2-desk-smoke.html -w "%{http_code}" "$BASE/")
echo "HTTP $CODE"
grep -qiE 'html|script' /tmp/hos-v2-desk-smoke.html

echo "=== proxied /health ==="
curl -sf "$BASE/health" | tee /tmp/hos-v2-desk-health.json
grep -q '"ok"' /tmp/hos-v2-desk-health.json || grep -q 'ok' /tmp/hos-v2-desk-health.json

echo "=== /v1/auth/properties ==="
curl -sf "$BASE/v1/auth/properties" | tee /tmp/hos-v2-desk-props.json | head -c 400
echo

echo "=== SMOKE DESK OK ==="
