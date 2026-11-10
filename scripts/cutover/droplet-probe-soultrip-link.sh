#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
SELECT id::text, company_name, login_code, contact_email, auth_user_id::text, can_login
FROM public.agents
WHERE lower(contact_email)='soultrip@gmail.com' OR login_code ILIKE 'SOULTRIPS' OR auth_user_id='df1853d2-0fc1-42f9-a719-d2442efb65f6';

SELECT pa.id::text, pa.subject_id::text, pa.login_code, pa.property_id::text, p.slug, p.name
FROM v2.portal_accounts pa
JOIN v2.properties p ON p.id=pa.property_id
WHERE pa.login_code='SOULTRIPS';

-- MoU / property links in public if any
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name ILIKE '%agent%link%' OR table_name ILIKE '%mou%';
SQL
