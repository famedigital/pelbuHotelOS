#!/usr/bin/env bash
set -euo pipefail
TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  TOKEN="$(docker exec supabase-rest printenv CF_API_TOKEN 2>/dev/null \
    || docker exec supabase-rest printenv CLOUDFLARE_API_TOKEN 2>/dev/null \
    || true)"
fi
[[ -n "$TOKEN" ]] || { echo "CF_API_TOKEN missing"; exit 1; }
echo "token_len=${#TOKEN}"

ZONE_NAME="${CF_ZONE:-innorahotel.com}"
RESP=$(curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME")
ZONE_ID=$(RESP="$RESP" python3 - <<'PY'
import json, os
d = json.loads(os.environ["RESP"])
print(d["result"][0]["id"] if d.get("success") and d.get("result") else "")
PY
)
[[ -n "$ZONE_ID" ]] || { echo "zone not found"; echo "$RESP" | head -c 400; exit 1; }
echo "zone=$ZONE_ID"

EXIST=$(curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=desk.$ZONE_NAME" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d.get("result") or []; print(r[0]["id"] if r else "")')
BODY='{"type":"CNAME","name":"desk","content":"innorahotel.com","ttl":1,"proxied":true}'
if [[ -n "$EXIST" ]]; then
  curl -sS -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$EXIST" \
    --data "$BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("update", d.get("success"), d.get("errors"))'
else
  curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    --data "$BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("create", d.get("success"), d.get("errors"))'
fi

echo "=== local Host desk.innorahotel.com ==="
curl -skI -H 'Host: desk.innorahotel.com' https://127.0.0.1/login/hotel | head -12
echo "=== public ==="
curl -skI --connect-timeout 20 https://desk.innorahotel.com/login/hotel | head -15 || true
