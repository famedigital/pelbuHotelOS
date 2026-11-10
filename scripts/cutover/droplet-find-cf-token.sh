#!/usr/bin/env bash
set +e
echo "printenv:"
printenv | grep -iE 'cloudflare|CF_API' | sed 's/=.*/=***/'
echo "files:"
grep -RIl 'CLOUDFLARE_API_TOKEN\|CF_API_TOKEN' /data/coolify /opt /root /etc 2>/dev/null | head -30
echo "docker env:"
docker ps -q | head -20 | while read -r id; do
  n=$(docker inspect -f '{{.Name}}' "$id")
  v=$(docker exec "$id" printenv CF_API_TOKEN 2>/dev/null || docker exec "$id" printenv CLOUDFLARE_API_TOKEN 2>/dev/null || true)
  if [[ -n "$v" ]]; then echo "found in $n len=${#v}"; fi
done
