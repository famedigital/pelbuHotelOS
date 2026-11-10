#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
SELECT 'v2.agents' AS t, column_name FROM information_schema.columns
WHERE table_schema='v2' AND table_name='agents' ORDER BY ordinal_position;
SELECT 'public.agents' AS t, column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='agents' ORDER BY ordinal_position;
SELECT id::text, email FROM auth.users
WHERE lower(email) LIKE '%soul%' OR lower(email)='pelbusuites@gmail.com' LIMIT 20;
SELECT login_code, display_name, role FROM v2.portal_accounts
WHERE login_code ILIKE '%soul%' LIMIT 10;
SELECT code, name, property_id::text FROM v2.agents
WHERE code ILIKE '%soul%' OR name ILIKE '%soul%' LIMIT 10;
SQL
