#!/usr/bin/env bash
set -euo pipefail
# scrypt$salt$hash for PIN 1234 (Node crypto, matches auth-pin.ts)
HASH='scrypt$673aa0056a13d277421ae97a9eb710da$04386bcca3f8c92db5a2e3295bc5a6b8bc558fed9614e30fb90ad722a54c30cd'
PID=$(docker exec supabase-db psql -U postgres -d postgres -Atc "SELECT id FROM v2.properties WHERE slug='pelbu-suites-olakha'")
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "
UPDATE v2.staff
SET pin_hash = '$HASH',
    pin_reset_required = false,
    can_login = true,
    active = true,
    version = version + 1
WHERE property_id = '$PID'
  AND employee_code IN ('EMP-003','MGR-01','MGR-02','OWNER','GM-01')
RETURNING display_name, employee_code, pin_reset_required, (pin_hash LIKE 'scrypt\$%') AS scrypt_ok;
UPDATE v2.properties
SET current_business_date = '2026-11-10', version = version + 1
WHERE id = '$PID'
RETURNING slug, name, current_business_date;
"
