#!/usr/bin/env bash
set -euo pipefail
# Find a real agent code
CODE=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT login_code FROM v2.portal_accounts WHERE role='agent' AND property_id=(SELECT id FROM v2.properties WHERE slug='pelbu-olakha') ORDER BY login_code LIMIT 1;")
CODE=$(echo "$CODE" | tr -d '[:space:]')
echo "agent code=$CODE"
curl -sf -X POST http://127.0.0.1:4200/v1/auth/portal/login \
  -H 'content-type: application/json' \
  -d "{\"role\":\"agent\",\"propertySlug\":\"pelbu-olakha\",\"loginCode\":\"$CODE\",\"pin\":\"2468\",\"confirmPin\":\"2468\"}" | head -c 500
echo
# staff list without token should 401
code=$(curl -s -o /tmp/noauth.json -w "%{http_code}" "http://127.0.0.1:4200/v1/auth/staff?propertySlug=pelbu-olakha")
echo "staff noauth HTTP $code $(cat /tmp/noauth.json)"
