#!/usr/bin/env bash
set -euo pipefail
# Remove high-priority stale file routes so docker-provider hos-v2-desk (priority 200) wins.
ts=$(date +%s)
for f in pelbu-desk.yml hos-v2-fo.yml; do
  if [[ -f "/data/coolify/proxy/dynamic/$f" ]]; then
    mv "/data/coolify/proxy/dynamic/$f" "/data/coolify/proxy/dynamic/$f.retired.$ts"
    echo "retired $f"
  fi
done
# Keep .bak* but Traefik file provider loads ALL yaml in directory — retire bak too
for f in /data/coolify/proxy/dynamic/pelbu-desk.yml.bak*; do
  [[ -e "$f" ]] || continue
  mv "$f" "${f}.retired.$ts"
  echo "retired $(basename "$f")"
done

ls -la /data/coolify/proxy/dynamic/
sleep 3
echo "=== probes ==="
for H in innorahotel.com www.innorahotel.com desk-v2.165.22.211.20.sslip.io zkggxjoxur9j8hxcghclplhw.165.22.211.20.sslip.io; do
  echo "-- $H"
  code=$(curl -sk -o /tmp/hbody -w "%{http_code}" -H "Host: $H" https://127.0.0.1/health || true)
  echo "health $code $(head -c 80 /tmp/hbody)"
done
