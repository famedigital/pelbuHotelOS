#!/usr/bin/env bash
set -euo pipefail
: "${AGENT_PORTAL_PASSWORD:?required}"
docker exec -e AGENT_PORTAL_PASSWORD="$AGENT_PORTAL_PASSWORD" innora node -e '
const body = new URLSearchParams({
  login_code: "soultrip@gmail.com",
  pin: process.env.AGENT_PORTAL_PASSWORD,
});
fetch("http://127.0.0.1:3000/api/agents/login", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
  redirect: "manual",
}).then((r) => {
  const loc = r.headers.get("location") || "";
  console.log("status", r.status);
  console.log("location", loc);
  const ok = (r.status === 303 || r.status === 302) && loc.includes("/agents/app") && !loc.includes("error=");
  console.log(ok ? "LOGIN_POST_OK" : "LOGIN_POST_FAIL");
  process.exit(ok ? 0 : 1);
}).catch((e) => { console.error(e); process.exit(1); });
'
