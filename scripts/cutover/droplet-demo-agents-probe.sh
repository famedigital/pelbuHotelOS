#!/usr/bin/env bash
set -euo pipefail
PID=$(docker exec supabase-db psql -U postgres -d postgres -Atc "SELECT id FROM v2.properties WHERE slug='pelbu-suites-olakha'")
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT code, name FROM v2.agents WHERE property_id='$PID' ORDER BY code LIMIT 30;
"
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT email, role FROM v2.org_members WHERE email ILIKE '%soul%' OR email ILIKE '%agent%' OR email ILIKE '%demo%' LIMIT 20;
" 2>/dev/null || true
# auth users for portals
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT id::text, email FROM auth.users WHERE email ILIKE '%soul%' OR email ILIKE '%agent%' OR email ILIKE '%demo%' LIMIT 20;
" 2>/dev/null || true
