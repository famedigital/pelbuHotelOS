-- Run as postgres/supabase_admin if needed
SELECT current_user, current_database();

SELECT id::text, email, email_confirmed_at IS NOT NULL AS confirmed, created_at
FROM auth.users
WHERE lower(email) LIKE '%pelbu%' OR lower(email) LIKE '%pelnu%' OR lower(email) LIKE '%suites%'
LIMIT 20;

SELECT p.id::text, p.slug, p.name, p.organization_id::text
FROM v2.properties p
WHERE lower(p.slug) LIKE '%pelbu%' OR lower(p.name) LIKE '%pelbu%' OR lower(p.name) = 'demo'
ORDER BY p.slug;

SELECT m.email, m.role, m.organization_id::text, o.name AS org_name
FROM v2.org_members m
LEFT JOIN v2.organizations o ON o.id = m.organization_id
WHERE lower(m.email) LIKE '%pelbu%' OR lower(m.email) LIKE '%pelnu%';
