#!/usr/bin/env bash
# Create least-privilege v2_app role (ADR 001) and write DATABASE_URL env file.
set -euo pipefail

PW_FILE=/root/hos-v2-app.pw
if [[ ! -f "$PW_FILE" ]]; then
  openssl rand -base64 32 | tr -d '/+=\n' | head -c 32 > "$PW_FILE"
  chmod 600 "$PW_FILE"
fi
APP_PW="$(cat "$PW_FILE")"

# Set/create role + grants as postgres
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'v2_app') THEN
    CREATE ROLE v2_app LOGIN PASSWORD '${APP_PW}';
  ELSE
    ALTER ROLE v2_app WITH LOGIN PASSWORD '${APP_PW}';
  END IF;
END
\$\$;

REVOKE ALL ON SCHEMA public FROM v2_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM v2_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM v2_app;
REVOKE ALL ON TABLE public.bookings FROM v2_app;

GRANT USAGE ON SCHEMA v2 TO v2_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA v2 TO v2_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA v2 TO v2_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA v2
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO v2_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA v2
  GRANT USAGE, SELECT ON SEQUENCES TO v2_app;
SQL

# Verify via TCP password auth (not peer)
docker exec -e PGPASSWORD="$APP_PW" supabase-db \
  psql -h 127.0.0.1 -U v2_app -d postgres -c "SELECT 1 FROM v2.properties LIMIT 1;" >/dev/null

if docker exec -e PGPASSWORD="$APP_PW" supabase-db \
  psql -h 127.0.0.1 -U v2_app -d postgres -c "SELECT 1 FROM public.bookings LIMIT 1;" >/dev/null 2>&1; then
  echo "FAIL: v2_app can still read public.bookings"
  exit 1
fi
echo "OK: v2_app can read v2.*, blocked from public.bookings"

ENC_PW="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$APP_PW")"
JWT="$(openssl rand -hex 16)"
cat > /tmp/hos-v2-dburl.env <<EOF
DATABASE_URL=postgres://v2_app:${ENC_PW}@supabase-db:5432/postgres
DESK_JWT_SECRET=hos-v2-desk-cutover-${JWT}
PORT=4200
EOF
chmod 600 /tmp/hos-v2-dburl.env
echo "=== v2_app ready ==="
