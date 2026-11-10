#!/usr/bin/env bash
# Point parallel desk as FO entry via Caddy/nginx sidecar OR document Coolify route.
# Sets marker file for V2_DESK_CUTOVER evidence. Does not delete Innora.
set -euo pipefail

DESK_PORT="${DESK_PORT:-4280}"
MARKER=/etc/hos-v2-desk-cutover.env
FLIP="${1:-status}"

case "$FLIP" in
  on)
    cat > "$MARKER" <<EOF
V2_DESK_CUTOVER=true
HOS_V2_DESK_URL=http://127.0.0.1:${DESK_PORT}/
HOS_V2_FLIPPED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
    chmod 644 "$MARKER"
    # Ensure stack is up
    if [[ -f /opt/hos-v2/docker-compose.cutover.yml ]]; then
      bash /tmp/droplet-deploy-v2-stack.sh /opt/hos-v2 || bash /opt/hos-v2/droplet-deploy-v2-stack.sh /opt/hos-v2
    fi
    # Soft redirect helper page on :4281 if nothing else fronts desk
    mkdir -p /var/www/hos-v2-fo
    cat > /var/www/hos-v2-fo/index.html <<'HTML'
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=http://REPLACE_HOST:4280/"/>
<title>Hotel OS desk moved</title>
</head><body>
<p>Front desk moved to <a href="http://REPLACE_HOST:4280/">v2 desk</a>. Innora /erp remains for rollback.</p>
</body></html>
HTML
    HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    sed -i "s/REPLACE_HOST/${HOST_IP}/g" /var/www/hos-v2-fo/index.html
    echo "FLIP ON — desk http://${HOST_IP}:${DESK_PORT}/ marker $MARKER"
    echo "Wire Coolify/Traefik FO hostname → hos-v2-desk:${DESK_PORT} (or container) when ready."
    ;;
  off)
    cat > "$MARKER" <<EOF
V2_DESK_CUTOVER=false
HOS_V2_FLIPPED_AT=
EOF
    echo "FLIP OFF — Innora remains primary; marker $MARKER"
    ;;
  status|*)
    if [[ -f "$MARKER" ]]; then
      cat "$MARKER"
    else
      echo "V2_DESK_CUTOVER=false (no marker)"
    fi
    curl -sf "http://127.0.0.1:${DESK_PORT}/health" && echo || echo "desk health: down"
    ;;
esac
