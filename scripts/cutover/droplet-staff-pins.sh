#!/usr/bin/env bash
set -euo pipefail
DB=(docker exec supabase-db psql -U postgres -d postgres)
echo "=== pin-ish columns ==="
"${DB[@]}" -tAc "SELECT table_name||'.'||column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ILIKE '%pin%' ORDER BY 1;"
echo "=== staff_private_profiles cols ==="
"${DB[@]}" -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_private_profiles' ORDER BY ordinal_position;"
echo "=== staff by property ==="
"${DB[@]}" -c "
SELECT p.slug, count(s.*) AS staff, count(*) FILTER (WHERE s.can_login) AS can_login, count(*) FILTER (WHERE s.pin_set_at IS NOT NULL) AS pin_set
FROM public.staff_members s
JOIN public.properties p ON p.id = s.property_id
GROUP BY p.slug ORDER BY 1;
"
echo "=== sample staff ==="
"${DB[@]}" -c "
SELECT p.slug, s.full_name, s.desk_role, s.access_level, s.employee_code, s.can_login, s.pin_set_at IS NOT NULL AS pin_set
FROM public.staff_members s
JOIN public.properties p ON p.id = s.property_id
ORDER BY p.slug, s.full_name
LIMIT 40;
"
