#!/usr/bin/env bash
set -euo pipefail
DB=(docker exec supabase-db psql -U postgres -d postgres)

echo "=== auth users matching pelbu ==="
"${DB[@]}" -c "SELECT id::text, email, created_at FROM auth.users WHERE email ILIKE '%pelbu%' OR email ILIKE '%pelbusuites%' ORDER BY email;"

echo "=== property link tables ==="
"${DB[@]}" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%staff%' OR table_name ILIKE '%member%' OR table_name ILIKE '%property_user%' OR table_name ILIKE '%profile%' OR table_name ILIKE '%tenant%') ORDER BY 1;"

echo "=== rooms by property ==="
"${DB[@]}" -c "
SELECT p.slug, p.name, count(u.*) AS rooms
FROM public.properties p
LEFT JOIN public.room_units u ON u.property_id = p.id
GROUP BY p.slug, p.name
ORDER BY p.slug;
"

echo "=== room types by property ==="
"${DB[@]}" -c "
SELECT p.slug, rt.code, rt.name, count(u.*) AS units
FROM public.room_types rt
JOIN public.properties p ON p.id = rt.property_id
LEFT JOIN public.room_units u ON u.room_type_id = rt.id
GROUP BY p.slug, rt.code, rt.name
ORDER BY p.slug, rt.code;
"

echo "=== pelbu-olakha rooms ==="
"${DB[@]}" -c "
SELECT u.label, rt.code, u.hk_status, coalesce(u.floor_label,'') AS floor
FROM public.room_units u
JOIN public.properties p ON p.id = u.property_id
LEFT JOIN public.room_types rt ON rt.id = u.room_type_id
WHERE p.slug = 'pelbu-olakha'
ORDER BY u.sort_order NULLS LAST, u.label;
"

echo "=== DEMO rooms (pelbu-suites-olakha) ==="
"${DB[@]}" -c "
SELECT u.label, rt.code, u.hk_status, coalesce(u.floor_label,'') AS floor
FROM public.room_units u
JOIN public.properties p ON p.id = u.property_id
LEFT JOIN public.room_types rt ON rt.id = u.room_type_id
WHERE p.slug = 'pelbu-suites-olakha'
ORDER BY u.sort_order NULLS LAST, u.label;
"
