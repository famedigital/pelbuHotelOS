#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d postgres -c "\d v2.folio_lines"
docker exec supabase-db psql -U postgres -d postgres -c "\d v2.booking_lines"
docker exec supabase-db psql -U postgres -d postgres -c "\d v2.groups"
docker exec supabase-db psql -U postgres -d postgres -c "\d v2.agents"
docker exec supabase-db psql -U postgres -d postgres -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='v2' AND table_name='bookings' ORDER BY ordinal_position;"
