#!/usr/bin/env bash
set -euo pipefail
html=$(curl -skS https://desk.innorahotel.com/)
echo "$html" | head -c 600; echo
JS=$(echo "$html" | sed -n 's/.*src="\([^"]*index-[^"]*\.js\)".*/\1/p' | head -1)
echo "JS=$JS"
curl -skS "https://desk.innorahotel.com$JS" -o /tmp/desk-index.js
wc -c /tmp/desk-index.js
grep -oE '127\.0\.0\.1:4200|VITE_API_URL|/v1/auth/portal/email-login|/v1/auth/hotel/login|DATABASE_REQUIRED' /tmp/desk-index.js | sort | uniq -c
echo "=== org member + agent for pelnusuites ==="
cd /opt/hos-v2
# shellcheck disable=SC1091
set -a
# DATABASE_URL from env file for psql via docker
DBURL=$(grep '^DATABASE_URL=' /tmp/hos-v2-dburl.env | cut -d= -f2-)
docker run --rm --network coolify postgres:16-alpine psql "$DBURL" -c "SELECT email, role, organization_id::text FROM v2.org_members WHERE lower(email) LIKE '%pelnu%' OR lower(email) LIKE '%pelbu%' LIMIT 10;" || true
docker run --rm --network coolify postgres:16-alpine psql "$DBURL" -c "SELECT id::text, company_name, contact_email, can_login, login_code FROM public.agents WHERE lower(contact_email) LIKE '%pelnu%' OR lower(contact_email) LIKE '%pelbu%' OR lower(company_name) LIKE '%pelbu%' LIMIT 10;" || true
docker run --rm --network coolify postgres:16-alpine psql "$DBURL" -c "SELECT id::email, email FROM auth.users WHERE lower(email) LIKE '%pelnu%' OR lower(email) LIKE '%pelbu%' LIMIT 10;" 2>/dev/null || \
docker run --rm --network coolify postgres:16-alpine psql "$DBURL" -c "SELECT id::text, email FROM auth.users WHERE lower(email) LIKE '%pelnu%' OR lower(email) LIKE '%pelbu%' LIMIT 10;" || true
