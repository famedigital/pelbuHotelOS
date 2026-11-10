#!/usr/bin/env bash
set -euo pipefail
OLAKHA=d06e89f8-86e6-4201-bbd2-5e115d422357
curl -sf "http://127.0.0.1:4280/v1/stayview?propertyId=$OLAKHA" > /tmp/sv.json
python3 - <<'PY'
import json
b=json.load(open("/tmp/sv.json"))
rts=b.get("roomTypes") or []
print("ok", b.get("ok"), "from", b.get("from"), "dates", len(b.get("dates") or []), "roomTypes", len(rts))
rooms=b.get("rooms") or []
print("rooms", len(rooms))
for k in ("blocks","assignments","stays","reservations"):
  v=b.get(k)
  if v is not None:
    print(k, len(v) if isinstance(v, list) else type(v).__name__)
PY
echo "=== public https ==="
curl -sf --connect-timeout 20 https://desk-v2.165.22.211.20.sslip.io/health
echo
curl -sf --connect-timeout 20 https://desk-v2.165.22.211.20.sslip.io/v1/auth/properties | head -c 300
echo
