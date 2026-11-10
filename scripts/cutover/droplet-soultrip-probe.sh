#!/usr/bin/env bash
set -euo pipefail
echo "=== agents columns ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='agents' ORDER BY ordinal_position;"
echo "=== soultrip agents ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, login_code, company_name, can_login, auth_user_id, status FROM public.agents WHERE login_code ILIKE '%soul%' OR company_name ILIKE '%soul%' ORDER BY login_code;"
echo "=== auth users soul ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE lower(email) LIKE '%soul%' ORDER BY email;"
echo "=== agent_property_links soul ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT apl.property_id, p.slug, apl.status, a.login_code, a.company_name FROM public.agent_property_links apl JOIN public.agents a ON a.id=apl.agent_id JOIN public.properties p ON p.id=apl.property_id WHERE a.login_code ILIKE '%soul%' OR a.company_name ILIKE '%soul%';"
