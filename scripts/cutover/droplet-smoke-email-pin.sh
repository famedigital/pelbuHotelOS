#!/usr/bin/env bash
# Smoke: public site + hotel email login + staff list auth + wrong password.
set -euo pipefail
PUBLIC="${PUBLIC:-https://innorahotel.com}"
DESK="${DESK:-https://desk-v2.165.22.211.20.sslip.io}"
EMAIL="${OWNER_EMAIL:-pelbusuites@gmail.com}"
PASS="${OWNER_PASSWORD:-}"

echo "=== public $PUBLIC ==="
CODE=$(curl -sk -o /tmp/pub.html -w "%{http_code}" "$PUBLIC/")
grep -qiE 'Innora|Hotel OS|operating system' /tmp/pub.html || { echo "public body unexpected"; head -c 200 /tmp/pub.html; exit 1; }
[[ "$CODE" == "200" ]] || { echo "public HTTP $CODE"; exit 1; }
if grep -qi 'Enter PIN\|staff PIN pad\|Unlock your hotel' /tmp/pub.html; then
  echo "FAIL: public still looks like desk PIN/login"
  exit 1
fi
echo "public OK $CODE"

echo "=== desk hotel login page ==="
CODE=$(curl -sk -o /tmp/desk-login.html -w "%{http_code}" "$DESK/login/hotel")
[[ "$CODE" == "200" ]] || { echo "desk login HTTP $CODE"; exit 1; }
echo "desk login OK"

echo "=== staff list without bearer → 401 ==="
CODE=$(curl -sk -o /tmp/staff.json -w "%{http_code}" "$DESK/v1/auth/staff?propertySlug=pelbu-suites")
[[ "$CODE" == "401" || "$CODE" == "403" ]] || { echo "expected 401 got $CODE"; cat /tmp/staff.json; exit 1; }
echo "staff unauth OK $CODE"

echo "=== wrong password → 401 ==="
CODE=$(curl -sk -o /tmp/bad-login.json -w "%{http_code}" -X POST "$DESK/v1/auth/hotel/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"definitely-wrong-password-xyz\"}")
[[ "$CODE" == "401" ]] || { echo "expected 401 got $CODE"; cat /tmp/bad-login.json; exit 1; }
echo "bad password OK"

if [[ -z "$PASS" ]]; then
  echo "SKIP good email login (set OWNER_PASSWORD)"
  echo "=== smoke partial OK ==="
  exit 0
fi

echo "=== good email login ==="
CODE=$(curl -sk -o /tmp/good-login.json -w "%{http_code}" -X POST "$DESK/v1/auth/hotel/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
[[ "$CODE" == "200" ]] || { echo "login HTTP $CODE"; cat /tmp/good-login.json; exit 1; }
TOKEN=$(python3 -c 'import json;print(json.load(open("/tmp/good-login.json"))["token"])' 2>/dev/null \
  || node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/good-login.json","utf8")).token)')
SLUG=$(python3 -c 'import json;print(json.load(open("/tmp/good-login.json"))["property"]["slug"])' 2>/dev/null \
  || node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/good-login.json","utf8")).property.slug)')
[[ -n "$TOKEN" ]] || exit 1
echo "login OK property=$SLUG"

echo "=== staff list with owner bearer ==="
CODE=$(curl -sk -o /tmp/staff2.json -w "%{http_code}" "$DESK/v1/auth/staff?propertySlug=$SLUG" \
  -H "Authorization: Bearer $TOKEN")
[[ "$CODE" == "200" ]] || { echo "staff HTTP $CODE"; cat /tmp/staff2.json; exit 1; }
echo "staff gated OK"
echo "=== smoke email+pin gate OK ==="
