#!/usr/bin/env bash
# PIN unlock + stayview/reservations smoke on DEMO (non-destructive read + PIN set).
set -euo pipefail
BASE="${1:-http://127.0.0.1:4280}"
DEMO=c22c44c1-547c-4351-b1ec-608f6590e340
PIN="${SMOKE_PIN:-4242}"

echo "=== DEMO staff ==="
curl -sf "$BASE/v1/auth/staff?propertyId=$DEMO" > /tmp/demo-staff.json
STAFF_ID=$(python3 - <<'PY'
import json
b=json.load(open("/tmp/demo-staff.json"))
staff=b["staff"]
# Prefer a front-desk-ish role if present
pick=next((s for s in staff if s.get("employeeCode")), staff[0])
print(pick["id"])
print(pick.get("employeeCode"), pick.get("fullName"), "pinSet", pick.get("pinSet"), file=__import__("sys").stderr)
PY
)

echo "STAFF_ID=$STAFF_ID"
echo "=== PIN unlock/set ==="
curl -sf -X POST "$BASE/v1/auth/pin" \
  -H 'content-type: application/json' \
  -d "{\"propertyId\":\"$DEMO\",\"staffId\":\"$STAFF_ID\",\"pin\":\"$PIN\",\"confirmPin\":\"$PIN\"}" \
  | tee /tmp/pin.json | head -c 500
echo

python3 - <<'PY'
import json
b=json.load(open("/tmp/pin.json"))
assert b.get("ok") is True, b
tok=b.get("token") or (b.get("session") or {}).get("token")
print("token_len", len(tok or ""))
open("/tmp/desk-jwt.txt","w").write(tok or "")
PY

TOKEN=$(cat /tmp/desk-jwt.txt)
echo "=== authenticated reservations ==="
curl -sf "$BASE/v1/reservations?propertyId=$DEMO" \
  -H "Authorization: Bearer $TOKEN" | python3 - <<'PY'
import json,sys
b=json.load(sys.stdin)
print("ok", b.get("ok"), "keys", list(b.keys())[:12])
items=b.get("reservations") or b.get("items") or b.get("bookings") or []
print("count", len(items) if isinstance(items, list) else type(items).__name__)
PY

echo "=== PIN/FIT smoke OK (read-path; money post left to desk UI) ==="
echo "Printers/keycards: OWNER MANUAL on-site checklist"
