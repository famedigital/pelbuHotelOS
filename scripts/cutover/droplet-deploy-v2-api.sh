#!/usr/bin/env bash
# Legacy entrypoint — prefer droplet-deploy-v2-stack.sh (API + desk).
# Still deploys full cutover compose (desk included when compose defines it).
set -euo pipefail
ROOT="${1:-/opt/hos-v2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/droplet-deploy-v2-stack.sh" ]]; then
  exec bash "$SCRIPT_DIR/droplet-deploy-v2-stack.sh" "$ROOT"
fi
if [[ -f /tmp/droplet-deploy-v2-stack.sh ]]; then
  exec bash /tmp/droplet-deploy-v2-stack.sh "$ROOT"
fi
echo "Missing droplet-deploy-v2-stack.sh"
exit 1
