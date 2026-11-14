#!/usr/bin/env bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/_fix-pelbu-auth-info.sql
