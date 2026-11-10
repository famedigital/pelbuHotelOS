#!/usr/bin/env bash
set -euo pipefail
DEMO=c22c44c1-547c-4351-b1ec-608f6590e340
TOKEN=$(python3 -c 'import json; print(json.load(open("/tmp/pin.json"))["token"])')
echo "tok_len=${#TOKEN}"
for path in \
  "/v1/reservations?propertyId=$DEMO" \
  "/v1/desk/day?propertyId=$DEMO" \
  "/v1/stayview?propertyId=$DEMO"
do
  code=$(curl -sS -o /tmp/auth-body.json -w "%{http_code}" \
    "http://127.0.0.1:4280$path" \
    -H "Authorization: Bearer $TOKEN")
  echo "GET $path → $code"
  head -c 240 /tmp/auth-body.json; echo
done
