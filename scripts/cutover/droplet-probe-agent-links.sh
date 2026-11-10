#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
\d public.agent_property_links
SELECT * FROM public.agent_property_links WHERE agent_id='4a072010-577e-4fe4-8974-d09bc4fe0cc5' LIMIT 20;
SELECT * FROM public.agent_mou_links WHERE agent_id='4a072010-577e-4fe4-8974-d09bc4fe0cc5' LIMIT 10;
-- guides/drivers auth?
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND (table_name ILIKE '%guide%' OR table_name ILIKE '%driver%' OR table_name ILIKE '%fleet%')
ORDER BY 1;
SQL
