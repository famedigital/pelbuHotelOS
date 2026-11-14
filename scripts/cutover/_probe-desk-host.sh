#!/usr/bin/env bash
set -euo pipefail
echo "=== public desk.innorahotel.com health ==="
curl -skS -o /tmp/desk-pub.json -w "HTTP %{http_code}\n" https://desk.innorahotel.com/health || true
head -c 300 /tmp/desk-pub.json; echo
echo "=== public portal email-login ==="
curl -skS -o /tmp/desk-pub-login.json -w "HTTP %{http_code}\n" -X POST https://desk.innorahotel.com/v1/auth/portal/email-login \
  -H 'content-type: application/json' \
  -d '{"email":"pelnusuites@gmail.com","password":"testtest","role":"agent"}' || true
cat /tmp/desk-pub-login.json; echo
echo "=== hotel login public ==="
curl -skS -o /tmp/desk-pub-hotel.json -w "HTTP %{http_code}\n" -X POST https://desk.innorahotel.com/v1/auth/hotel/login \
  -H 'content-type: application/json' \
  -d '{"email":"pelnusuites@gmail.com","password":"testtest"}' || true
cat /tmp/desk-pub-hotel.json; echo
echo "=== desk-v2 sslip ==="
curl -skS -o /tmp/desk-v2-login.json -w "HTTP %{http_code}\n" -X POST https://desk-v2.165.22.211.20.sslip.io/v1/auth/portal/email-login \
  -H 'content-type: application/json' \
  -d '{"email":"pelnusuites@gmail.com","password":"testtest","role":"agent"}' || true
cat /tmp/desk-v2-login.json; echo
echo "=== traefik / who serves desk.innorahotel.com ==="
docker inspect hos-v2-hos-v2-desk-1 --format '{{json .Config.Labels}}' | tr ',' '\n' | grep -i 'desk\|innora\|Host' | head -40
