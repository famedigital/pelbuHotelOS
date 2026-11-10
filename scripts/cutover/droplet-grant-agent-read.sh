#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
GRANT SELECT ON TABLE public.agents TO v2_app;
GRANT SELECT ON TABLE public.agent_property_links TO v2_app;
GRANT SELECT ON TABLE public.agent_mou_links TO v2_app;
SQL
CODE=$(curl -sk -o /tmp/agent-login.json -w "%{http_code}" -X POST \
  https://desk-v2.165.22.211.20.sslip.io/v1/auth/portal/email-login \
  -H 'Content-Type: application/json' \
  -d '{"role":"agent","email":"soultrip@gmail.com","password":"Bhutan@123"}')
echo "agent HTTP $CODE"
node -e 'const j=require("/tmp/agent-login.json"); console.log(j)'
