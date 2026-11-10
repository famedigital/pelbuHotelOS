#!/usr/bin/env bash
set -euo pipefail
EMAIL_LC=soultrip@gmail.com
AGENT_ID=4a072010-577e-4fe4-8974-d09bc4fe0cc5
AUTH_USER_ID=df1853d2-0fc1-42f9-a719-d2442efb65f6

echo "=== before ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, email FROM auth.users WHERE id='${AUTH_USER_ID}'::uuid;"
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, provider, provider_id, identity_data->>'email' AS id_email FROM auth.identities WHERE user_id='${AUTH_USER_ID}'::uuid;"

echo "=== update email ==="
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE auth.users SET email='${EMAIL_LC}', email_confirmed_at=now(), updated_at=now() WHERE id='${AUTH_USER_ID}'::uuid RETURNING id, email;"

echo "=== update identity ==="
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "UPDATE auth.identities
   SET provider_id='${EMAIL_LC}',
       identity_data = coalesce(identity_data,'{}'::jsonb) || jsonb_build_object('email','${EMAIL_LC}','email_verified',true)
   WHERE user_id='${AUTH_USER_ID}'::uuid AND provider='email'
   RETURNING provider_id, identity_data->>'email';"

echo "=== after ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT a.login_code, a.contact_email, u.email FROM public.agents a JOIN auth.users u ON u.id=a.auth_user_id WHERE a.id='${AGENT_ID}'::uuid;"
