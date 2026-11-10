#!/usr/bin/env bash
set -euo pipefail
DB=(docker exec supabase-db psql -U postgres -d postgres)

echo "=== pelbusuites@gmail.com ==="
"${DB[@]}" -c "SELECT id::text, email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE email ILIKE 'pelbusuites@gmail.com';"

echo "=== tenants ==="
"${DB[@]}" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' ORDER BY ordinal_position LIMIT 25;"
"${DB[@]}" -c "SELECT * FROM public.tenants LIMIT 10;" 2>&1 | head -40

echo "=== tenant_members ==="
"${DB[@]}" -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_members' ORDER BY ordinal_position;"
"${DB[@]}" -c "SELECT * FROM public.tenant_members LIMIT 20;" 2>&1 | head -50

echo "=== staff_members sample ==="
"${DB[@]}" -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_members' ORDER BY ordinal_position LIMIT 30;"
"${DB[@]}" -c "SELECT id::text, property_id::text, full_name, role, pin_hash IS NOT NULL AS has_pin FROM public.staff_members WHERE property_id IN (SELECT id FROM public.properties) LIMIT 30;" 2>&1 | head -60
