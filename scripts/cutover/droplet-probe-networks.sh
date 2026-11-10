#!/usr/bin/env bash
set -euo pipefail
docker inspect innora --format '{{json .NetworkSettings.Networks}}' > /tmp/innora-nets.json
python3 - <<'PY'
import json
print("\n".join(json.load(open("/tmp/innora-nets.json")).keys()))
PY
echo "--- coolify proxy networks ---"
docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}' > /tmp/proxy-nets.json
python3 - <<'PY'
import json
print("\n".join(json.load(open("/tmp/proxy-nets.json")).keys()))
PY
