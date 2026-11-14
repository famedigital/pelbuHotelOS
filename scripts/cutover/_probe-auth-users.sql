SELECT 'org_members' AS src, email, role::text AS detail
FROM v2.org_members
WHERE lower(email) LIKE '%pelnu%' OR lower(email) LIKE '%suites%' OR lower(email) LIKE '%pelbu%'
LIMIT 20;

SELECT 'auth.users' AS src, email, id::text AS detail
FROM auth.users
WHERE lower(email) LIKE '%pelnu%' OR lower(email) LIKE '%suites%' OR lower(email) LIKE '%pelbu%'
LIMIT 20;

SELECT 'agents' AS src, coalesce(contact_email, '') AS email, company_name AS detail
FROM public.agents
WHERE lower(coalesce(contact_email, '')) LIKE '%pelnu%'
   OR lower(coalesce(contact_email, '')) LIKE '%suites%'
   OR lower(company_name) LIKE '%pelbu%'
LIMIT 20;

SELECT 'properties' AS src, slug AS email, name AS detail
FROM v2.properties
WHERE lower(name) LIKE '%pelbu%' OR lower(slug) LIKE '%pelbu%'
LIMIT 10;
