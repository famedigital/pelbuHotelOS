-- Fix wrong Pelbu desk identity: DEMO label + owner default property.
BEGIN;

UPDATE v2.properties
SET name = 'Pelbu Suites (seed archive)'
WHERE slug = 'pelbu-suites-olakha'
  AND (name = 'DEMO' OR name ILIKE 'demo%');

UPDATE v2.org_members
SET last_property_id = (
      SELECT p.id FROM v2.properties p WHERE p.slug = 'pelbu-olakha' LIMIT 1
    ),
    auth_user_id = COALESCE(
      auth_user_id,
      (SELECT u.id FROM auth.users u WHERE lower(u.email) = 'pelbusuites@gmail.com' LIMIT 1)
    )
WHERE lower(email) = 'pelbusuites@gmail.com';

SELECT m.email, m.role, m.last_property_id::text, p.slug AS last_slug, p.name AS last_name, m.auth_user_id::text
FROM v2.org_members m
LEFT JOIN v2.properties p ON p.id = m.last_property_id
WHERE lower(m.email) = 'pelbusuites@gmail.com';

SELECT slug, name FROM v2.properties WHERE slug LIKE '%pelbu%' ORDER BY slug;

COMMIT;
