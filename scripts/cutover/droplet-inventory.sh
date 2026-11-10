#!/usr/bin/env bash
# Read-only inventory for v2 cutover prep. Run on droplet as root.
set -euo pipefail

DB=(docker exec supabase-db psql -U postgres -d postgres)

echo "=== host ==="
hostname
date -u +"utc=%Y-%m-%dT%H:%M:%SZ"

echo "=== schemas ==="
"${DB[@]}" -tAc "SELECT nspname FROM pg_namespace WHERE nspname IN ('public','v2') ORDER BY 1;"

echo "=== v2 table count ==="
"${DB[@]}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='v2';" || echo 0

echo "=== v2.schema_migrations ==="
"${DB[@]}" -c "SELECT * FROM v2.schema_migrations ORDER BY applied_at;" 2>&1 || echo "(no ledger)"

echo "=== v2 tables (sample) ==="
"${DB[@]}" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='v2' ORDER BY 1 LIMIT 40;" 2>&1 || true

echo "=== public critical counts ==="
"${DB[@]}" -c "
SELECT 'properties' AS t, count(*)::text AS n FROM public.properties
UNION ALL SELECT 'rooms', count(*)::text FROM public.rooms
UNION ALL SELECT 'room_types', count(*)::text FROM public.room_types
UNION ALL SELECT 'bookings', count(*)::text FROM public.bookings
UNION ALL SELECT 'bookings_open', count(*)::text FROM public.bookings WHERE status IN ('confirmed','checked_in','pending','held')
UNION ALL SELECT 'bookings_in_house', count(*)::text FROM public.bookings WHERE status='checked_in'
UNION ALL SELECT 'guests', count(*)::text FROM public.guests
UNION ALL SELECT 'agents', count(*)::text FROM public.agents
UNION ALL SELECT 'folio_lines', count(*)::text FROM public.folio_lines
ORDER BY 1;
" 2>&1 || echo "(some public tables missing)"

echo "=== properties ==="
"${DB[@]}" -c "SELECT id::text, slug, name FROM public.properties ORDER BY slug LIMIT 20;" 2>&1 || true

echo "=== property_sequences sample ==="
"${DB[@]}" -c "SELECT property_id::text, kind, last_value FROM public.property_sequences ORDER BY kind LIMIT 30;" 2>&1 || true

echo "=== roles ==="
"${DB[@]}" -tAc "SELECT rolname FROM pg_roles WHERE rolname LIKE '%v2%' OR rolname IN ('authenticator','service_role','postgres') ORDER BY 1;"

echo "=== disk ==="
df -h / | tail -1

echo "DONE"
