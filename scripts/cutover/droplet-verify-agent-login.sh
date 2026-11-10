#!/usr/bin/env bash
set -euo pipefail
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec innora node -e 'fetch("http://127.0.0.1:3000/agents/login").then(r=>{if(!r.ok)process.exit(2);return r.text()}).then(t=>{console.log(t.includes("Email or agent code")?"LOGIN_UI_OK":"LOGIN_UI_OLD"); console.log(t.includes("Password or PIN")?"PIN_LABEL_OK":"PIN_LABEL_OLD");}).catch(()=>process.exit(3))'; then
    break
  fi
  echo "waiting $i…"
  sleep 3
done

SITE="${PUBLIC_SITE:-https://innorahotel.com}"
echo "POST $SITE/api/agents/login"
curl -sS -D /tmp/agent-login-headers.txt -o /dev/null \
  -X POST "$SITE/api/agents/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "login_code=soultrip@gmail.com" \
  --data-urlencode "pin=${AGENT_PORTAL_PASSWORD:?set password}" \
  --max-redirs 0 || true
grep -iE '^(HTTP/|location:)' /tmp/agent-login-headers.txt | head -8 || true
rm -f /tmp/agent-login-headers.txt
