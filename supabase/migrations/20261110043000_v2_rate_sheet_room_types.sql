-- Align v2 room types with Pelbu rate sheet (docs/rate-agent.html / rate-public.html).
-- Sellable: deluxe_queen / deluxe_king / deluxe_twin / suite. Guide beds stay non-sellable.

BEGIN;

-- DEMO (Innora codes) → rate-sheet codes
UPDATE v2.room_types
SET code = 'deluxe_king', name = 'Deluxe King', version = version + 1
WHERE property_id = (SELECT id FROM v2.properties WHERE slug = 'pelbu-suites-olakha')
  AND code = 'dq';

UPDATE v2.room_types
SET code = 'deluxe_twin', name = 'Deluxe Twin', version = version + 1
WHERE property_id = (SELECT id FROM v2.properties WHERE slug = 'pelbu-suites-olakha')
  AND code = 'dt';

UPDATE v2.room_types
SET code = 'suite', name = 'Pelbu Suite', version = version + 1
WHERE property_id = (SELECT id FROM v2.properties WHERE slug = 'pelbu-suites-olakha')
  AND code = 'sr';

UPDATE v2.room_types
SET name = 'Driver & Guide', version = version + 1
WHERE property_id = (SELECT id FROM v2.properties WHERE slug = 'pelbu-suites-olakha')
  AND code = 'd&g';

-- Live Pelbu: Suite is room 502 (was mis-typed as deluxe_twin). Rate sheet = 26 deluxe + 1 suite.
DO $$
DECLARE
  pid uuid;
  suite_id uuid;
BEGIN
  SELECT id INTO pid FROM v2.properties WHERE slug = 'pelbu-olakha';
  IF pid IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO suite_id
  FROM v2.room_types
  WHERE property_id = pid AND code = 'suite'
  LIMIT 1;

  IF suite_id IS NULL THEN
    INSERT INTO v2.room_types (id, property_id, code, name, base_occupancy)
    VALUES (gen_random_uuid(), pid, 'suite', 'Pelbu Suite', 2)
    RETURNING id INTO suite_id;
  ELSE
    UPDATE v2.room_types
    SET name = 'Pelbu Suite', version = version + 1
    WHERE id = suite_id;
  END IF;

  UPDATE v2.rooms
  SET room_type_id = suite_id, version = version + 1
  WHERE property_id = pid AND number = '502';
END $$;

COMMIT;
