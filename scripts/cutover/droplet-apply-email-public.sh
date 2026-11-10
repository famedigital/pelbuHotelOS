#!/usr/bin/env bash
# Unpack cutover tarball + deploy API/desk/web with anon key for email login.
set -euo pipefail
rm -rf /opt/hos-v2/apps/web
mkdir -p /opt/hos-v2
tar -xzf /tmp/hos-v2-cutover.tgz -C /opt/hos-v2
cp -f /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2/droplet-deploy-v2-stack.sh
chmod +x /tmp/droplet-deploy-v2-stack.sh /tmp/droplet-smoke-email-pin.sh /opt/hos-v2/droplet-deploy-v2-stack.sh

if ! grep -qE '^SUPABASE_ANON_KEY=.+' /tmp/hos-v2-dburl.env 2>/dev/null; then
  ANON=""
  for c in $(docker ps --format '{{.Names}}'); do
    case "$c" in
      *kong*|*auth*|innora*|supabase*)
        ANON="$(docker exec "$c" printenv ANON_KEY 2>/dev/null || true)"
        [[ -z "$ANON" ]] && ANON="$(docker exec "$c" printenv SUPABASE_ANON_KEY 2>/dev/null || true)"
        [[ -z "$ANON" ]] && ANON="$(docker exec "$c" printenv NEXT_PUBLIC_SUPABASE_ANON_KEY 2>/dev/null || true)"
        [[ -n "$ANON" ]] && break
        ;;
    esac
  done
  if [[ -z "$ANON" ]]; then
    ANON="$(grep -RhoE 'eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' /opt/supabase /data/coolify 2>/dev/null | head -1 || true)"
  fi
  if [[ -n "$ANON" ]]; then
    printf '\nSUPABASE_ANON_KEY=%s\nSUPABASE_URL=%s\nSUPABASE_AUTH_URL=%s\n' \
      "$ANON" "http://supabase-envoy:8000" "http://supabase-envoy:8000/auth/v1" \
      >> /tmp/hos-v2-dburl.env
    echo "pre-injected SUPABASE_ANON_KEY len=${#ANON}"
  fi
fi

bash /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2
