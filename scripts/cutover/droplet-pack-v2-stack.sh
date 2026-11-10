#!/usr/bin/env bash
# Pack v2 tree for droplet deploy (run on local/CI machine).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-/tmp/hos-v2-cutover.tgz}"
cd "$ROOT/v2"
tar -czf "$OUT" \
  --exclude=node_modules \
  --exclude='*/node_modules' \
  --exclude='*/dist' \
  --exclude='apps/web/.next' \
  --exclude='apps/web/dist' \
  --exclude='**/.turbo' \
  docker-compose.cutover.yml \
  package.json \
  pnpm-workspace.yaml \
  pnpm-lock.yaml \
  apps/api \
  apps/desk \
  apps/web \
  packages/domain \
  packages/db \
  packages/ui \
  packages/hardware \
  packages/sync
echo "Packed $OUT ($(du -h "$OUT" | awk '{print $1}'))"
