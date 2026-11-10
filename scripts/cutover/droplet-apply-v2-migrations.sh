#!/usr/bin/env bash
# Apply v2/packages/db/migrations inside supabase-db on the droplet.
# Expects migration .sql files already copied to host /tmp/hos-v2-migrations/
set -euo pipefail

MIG_DIR="${1:-/tmp/hos-v2-migrations}"
CONTAINER_MIG="/tmp/hos-v2-migrations"

if [[ ! -d "$MIG_DIR" ]]; then
  echo "Missing $MIG_DIR — scp migrations first"
  exit 1
fi

echo "=== pre-backup public schema (custom format, inside container) ==="
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER_BACKUP="/tmp/public-pre-v2-${STAMP}.dump"
HOST_BACKUP="/tmp/public-pre-v2-${STAMP}.dump"
docker exec supabase-db pg_dump -U postgres -d postgres --schema=public -Fc -f "$CONTAINER_BACKUP"
docker cp "supabase-db:${CONTAINER_BACKUP}" "$HOST_BACKUP"
ls -lh "$HOST_BACKUP"

echo "=== copy migrations into container ==="
docker exec supabase-db rm -rf "$CONTAINER_MIG"
docker cp "$MIG_DIR" "supabase-db:${CONTAINER_MIG}"

echo "=== ensure v2_app role ==="
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'v2_app') THEN
    CREATE ROLE v2_app LOGIN PASSWORD 'v2_app_change_me';
  END IF;
END$$;
SQL

mapfile -t FILES < <(ls -1 "$MIG_DIR"/[0-9][0-9][0-9][0-9]_*.sql | sort)
echo "Applying ${#FILES[@]} files from $MIG_DIR"

for f in "${FILES[@]}"; do
  base=$(basename "$f")
  id="${base%.sql}"
  echo "--- $base ---"
  applied=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
    "SELECT 1 FROM v2.schema_migrations WHERE id='${id}'" 2>/dev/null || true)
  if [[ "$applied" == "1" ]]; then
    echo "SKIP (ledger)"
    continue
  fi
  docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -f "${CONTAINER_MIG}/${base}"
  sum=$(sha256sum "$f" | awk '{print substr($1,1,16)}')
  docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
    "INSERT INTO v2.schema_migrations (id, checksum) VALUES ('${id}', '${sum}') ON CONFLICT (id) DO NOTHING;"
  echo "OK $base"
done

echo "=== grants for v2_app ==="
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
GRANT USAGE ON SCHEMA v2 TO v2_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA v2 TO v2_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA v2 TO v2_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA v2 GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO v2_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA v2 GRANT USAGE, SELECT ON SEQUENCES TO v2_app;
REVOKE ALL ON SCHEMA public FROM v2_app;
SQL

echo "=== ledger ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT id, applied_at FROM v2.schema_migrations ORDER BY id;"
echo "=== v2 table count ==="
docker exec supabase-db psql -U postgres -d postgres -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='v2';"
echo "DONE"
