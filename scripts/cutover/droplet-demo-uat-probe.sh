#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, slug, name, current_business_date FROM v2.properties ORDER BY slug;"
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT p.slug, s.display_name, s.employee_code, s.desk_role, s.can_login, s.active, (s.pin_hash IS NOT NULL) AS has_pin
   FROM v2.staff s JOIN v2.properties p ON p.id=s.property_id
   WHERE p.slug IN ('demo-hotel','pelbu-olakha','pelbu-suites-olakha')
   ORDER BY p.slug, s.display_name LIMIT 40;"
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT p.slug, count(r.*) rooms FROM v2.rooms r JOIN v2.properties p ON p.id=r.property_id GROUP BY 1 ORDER BY 1;"
