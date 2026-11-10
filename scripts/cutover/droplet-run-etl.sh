#!/usr/bin/env bash
set -euo pipefail
SQL="${1:-/tmp/01_etl.sql}"
echo "=== ETL dry-run counts (before) ==="
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT 'public_properties' AS k, count(*)::int AS n FROM public.properties WHERE slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'public_rooms', count(*)::int FROM public.room_units ru JOIN public.properties p ON p.id=ru.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'public_staff_login', count(*)::int FROM public.staff_members s JOIN public.properties p ON p.id=s.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha') AND (s.can_login OR s.can_access_desk)
UNION ALL SELECT 'v2_properties', count(*)::int FROM v2.properties WHERE slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'v2_rooms', count(*)::int FROM v2.rooms r JOIN v2.properties p ON p.id=r.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'v2_staff_login', count(*)::int FROM v2.staff s JOIN v2.properties p ON p.id=s.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha') AND s.can_login
ORDER BY 1;
"
echo "=== applying $SQL ==="
docker cp "$SQL" supabase-db:/tmp/01_etl.sql
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT set_config('hos.etl_mode', 'apply', false);" \
  -f /tmp/01_etl.sql
echo "=== ETL done ==="
