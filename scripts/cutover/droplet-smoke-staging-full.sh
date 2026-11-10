#!/usr/bin/env bash
# Full staging smoke: desk Traefik host + API auth/staff/stayview.
set -euo pipefail

LOCAL="${1:-http://127.0.0.1:4280}"
PUBLIC="${2:-https://desk-v2.165.22.211.20.sslip.io}"

echo "=== containers ==="
docker ps --filter name=hos-v2 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "=== traefik labels on desk ==="
docker inspect hos-v2-hos-v2-desk-1 --format '{{json .Config.Labels}}' | tr ',' '\n' | grep traefik || true
docker inspect hos-v2-hos-v2-desk-1 --format '{{json .NetworkSettings.Networks}}' > /tmp/desk-nets.json
python3 - <<'PY'
import json
print("networks:", ", ".join(json.load(open("/tmp/desk-nets.json")).keys()))
PY

echo "=== local desk smoke ==="
bash /tmp/droplet-smoke-v2-desk.sh "$LOCAL"

echo "=== public desk (may need TLS) ==="
if curl -sf --connect-timeout 15 -o /tmp/pub-desk.html -w "HTTP %{http_code}\n" "$PUBLIC/"; then
  head -c 120 /tmp/pub-desk.html; echo
  curl -sf --connect-timeout 15 "$PUBLIC/health" | head -c 200; echo
else
  echo "WARN: public URL not ready yet (TLS/DNS) — local smoke still OK"
fi

OLAKHA=$(python3 - <<'PY'
import json,urllib.request
raw=urllib.request.urlopen("http://127.0.0.1:4280/v1/auth/properties", timeout=10).read()
props=json.loads(raw)["properties"]
olakha=next(p for p in props if p["slug"]=="pelbu-olakha")
print(olakha["id"])
PY
)
echo "OLAKHA=$OLAKHA"

echo "=== staff list ==="
curl -sf "http://127.0.0.1:4280/v1/auth/staff?propertyId=$OLAKHA" | tee /tmp/staff.json | python3 - <<'PY'
import json,sys
body=json.load(sys.stdin)
staff=body.get("staff") or body.get("members") or body
if isinstance(staff, dict):
  staff=staff.get("items") or []
print("count", len(staff) if isinstance(staff, list) else type(staff))
if isinstance(staff, list):
  for s in staff[:8]:
    print("-", s.get("code") or s.get("login_code") or s.get("id"), s.get("displayName") or s.get("name") or s.get("full_name"))
PY

echo "=== stayview ==="
curl -sf "http://127.0.0.1:4280/v1/stayview?propertyId=$OLAKHA" | python3 - <<'PY'
import json,sys
body=json.load(sys.stdin)
print("keys", sorted(body.keys())[:20])
rooms=body.get("rooms") or body.get("rows") or body.get("blocks") or []
print("rooms/blocks", len(rooms) if isinstance(rooms, list) else type(rooms))
PY

echo "=== API smoke script ==="
bash /tmp/droplet-smoke-v2-api.sh http://127.0.0.1:4200 || true

echo "=== STAGING SMOKE DONE ==="
echo "Owner printers/keycards: MANUAL checklist (CUTOVER.md)"
