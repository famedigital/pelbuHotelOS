#!/usr/bin/env bash
set -euo pipefail
PID=$(docker exec supabase-db psql -U postgres -d postgres -Atc "SELECT id FROM v2.properties WHERE slug='pelbu-suites-olakha'")
echo "DEMO pid=$PID"
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT count(*) rooms FROM v2.rooms WHERE property_id='$PID';
SELECT count(*) bookings FROM v2.bookings WHERE property_id='$PID';
SELECT count(*) room_types FROM v2.room_types WHERE property_id='$PID';
SELECT display_name, employee_code, desk_role, can_login, pin_reset_required, (pin_hash IS NOT NULL) has_pin
FROM v2.staff WHERE property_id='$PID' AND can_login ORDER BY display_name;
"
# Ensure Choki DEMO PIN = 1234 (bcrypt via pgcrypto if available, else leave)
docker exec supabase-db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
  sid uuid;
  hash text;
BEGIN
  SELECT id INTO sid FROM v2.staff
  WHERE property_id='$PID' AND employee_code='EMP-003' LIMIT 1;
  IF sid IS NULL THEN RAISE NOTICE 'no EMP-003'; RETURN; END IF;
  -- Use crypt if extension present
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    hash := crypt('1234', gen_salt('bf'));
    UPDATE v2.staff SET pin_hash=hash, pin_reset_required=false, can_login=true, active=true, version=version+1 WHERE id=sid;
    RAISE NOTICE 'DEMO Choki PIN set to 1234';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pin hash failed: %', SQLERRM;
  END;
END \$\$;
"
# Also ensure Meg/Mohan on DEMO can login with 1234 for FO
docker exec supabase-db psql -U postgres -d postgres -c "
DO \$\$
DECLARE r record; hash text;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  hash := crypt('1234', gen_salt('bf'));
  FOR r IN
    SELECT id, display_name FROM v2.staff
    WHERE property_id='$PID' AND employee_code IN ('MGR-01','MGR-02','EMP-003','OWNER')
  LOOP
    UPDATE v2.staff SET pin_hash=hash, pin_reset_required=false, can_login=true, active=true, version=version+1 WHERE id=r.id;
    RAISE NOTICE 'PIN 1234 → %', r.display_name;
  END LOOP;
END \$\$;
"
docker exec supabase-db psql -U postgres -d postgres -c "
UPDATE v2.properties SET current_business_date=CURRENT_DATE, version=version+1
WHERE slug='pelbu-suites-olakha' RETURNING slug, name, current_business_date;
"
