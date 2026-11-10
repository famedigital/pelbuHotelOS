#!/usr/bin/env bash
set -euo pipefail
echo "=== innora env urls ==="
docker exec innora sh -c 'printenv | grep -E "SUPABASE_URL|NEXT_PUBLIC_SUPABASE|GOTRUE|AUTH" | sed "s/\(KEY\|SECRET\|PASSWORD\)=.*/\1=***/"'
echo "=== innora networks ==="
docker inspect innora -f '{{json .NetworkSettings.Networks}}' | head -c 800; echo
echo "=== auth networks ==="
docker inspect supabase-auth -f '{{json .NetworkSettings.Networks}}' | head -c 800; echo
echo "=== auth IP ==="
docker inspect supabase-auth -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
echo "=== try kong from innora ==="
docker exec innora sh -c 'wget -qO- -T 3 http://supabase-kong:8000/auth/v1/health || wget -qO- -T 3 http://kong:8000/auth/v1/health || echo FAIL'
