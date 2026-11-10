#!/usr/bin/env bash
# Smoke against local hos-v2-api (port 4200). No cutover flag flip.
set -euo pipefail
BASE="${1:-http://127.0.0.1:4200}"

echo "=== health ==="
curl -sf "$BASE/health"; echo

echo "=== owner properties ==="
OWNER="$(curl -sf "$BASE/v1/auth/owner/properties?email=pelbusuites%40gmail.com")"
echo "$OWNER" | head -c 900; echo

PROP="$(printf '%s' "$OWNER" | node -e '
let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
  try {
    const j=JSON.parse(d);
    const p=(j.properties||[]).find(x=>String(x.slug||"").includes("pelbu-olakha") && !String(x.slug).includes("suites"));
    console.log(p && p.id || "");
  } catch { console.log(""); }
});
')"
echo "olakha_prop=$PROP"

if [[ -n "$PROP" ]]; then
  echo "=== staff olakha ==="
  curl -sf "$BASE/v1/auth/staff?propertyId=$PROP" | head -c 900; echo
fi

echo "=== booking counts ==="
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
SELECT p.slug,
  count(*) FILTER (WHERE b.status='checked_in') AS checked_in,
  count(*) FILTER (WHERE b.status IN ('confirmed','held')) AS pipeline
FROM v2.bookings b
JOIN v2.properties p ON p.id=b.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
GROUP BY 1;
SELECT count(*) AS public_olakha_checked_in
FROM public.bookings b JOIN public.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in';
SELECT count(*) AS v2_olakha_checked_in
FROM v2.bookings b JOIN v2.properties p ON p.id=b.property_id
WHERE p.slug='pelbu-olakha' AND b.status='checked_in';
SQL

echo "=== container ==="
docker ps | grep hos-v2 || true
echo "=== smoke done ==="
