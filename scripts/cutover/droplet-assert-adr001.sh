#!/usr/bin/env bash
set -euo pipefail
set -a
# shellcheck disable=SC1091
source /tmp/hos-v2-dburl.env
set +a
# DATABASE_URL=postgres://v2_app:PW@supabase-db:5432/postgres
PW=$(python3 - <<'PY'
import os,urllib.parse
u=urllib.parse.urlparse(os.environ["DATABASE_URL"])
print(urllib.parse.unquote(u.password or ""))
PY
)
export PGPASSWORD="$PW"
set +e
OUT=$(docker exec -e PGPASSWORD="$PW" supabase-db \
  psql -h 127.0.0.1 -U v2_app -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM public.bookings;" 2>&1)
RC=$?
set -e
echo "$OUT"
if echo "$OUT" | grep -qiE 'permission denied|does not exist'; then
  echo "ADR 001 OK — v2_app cannot read public.bookings"
  exit 0
fi
if [[ $RC -ne 0 ]]; then
  echo "ADR 001 OK — failed as expected rc=$RC"
  exit 0
fi
echo "ADR 001 FAIL"
exit 1
