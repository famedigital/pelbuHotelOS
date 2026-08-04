/**
 * End-to-end staff login smoke test (local dev).
 * Usage: node scripts/test-staff-login.mjs [baseUrl]
 */
const base = process.argv[2] ?? "http://localhost:3000";

function parseSetCookie(headers) {
  return headers.getSetCookie?.() ?? [];
}

async function main() {
  const jar = new Map();

  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function absorb(res) {
    for (const line of parseSetCookie(res.headers)) {
      const name = line.split("=", 1)[0];
      const value = line.split(";")[0].slice(name.length + 1);
      if (/Max-Age=0/i.test(line) || /expires=Thu, 01 Jan 1970/i.test(line)) {
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    }
  }

  const loginGet = await fetch(`${base}/erp/login`, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  absorb(loginGet);
  const html = await loginGet.text();

  const actionRef = html.match(/name="\$ACTION_REF_(\d+)"/);
  const actionKey = html.match(/name="\$ACTION_KEY"\s+value="([^"]+)"/);
  const actionBound = html.match(
    /name="\$ACTION_\d+:0"\s+value="(\{[^"]+\})"/,
  );
  if (!actionRef || !actionKey || !actionBound) {
    throw new Error("Could not parse Server Action fields from login page");
  }
  const refNum = actionRef[1];

  const form = new FormData();
  form.set(`$ACTION_REF_${refNum}`, "");
  form.set(`$ACTION_${refNum}:0`, actionBound[1].replace(/&quot;/g, '"'));
  form.set(`$ACTION_${refNum}:1`, JSON.stringify([{ ok: false }]));
  form.set("$ACTION_KEY", actionKey[1]);
  form.set("employee_code", "gm-01");
  form.set("pin", "0519");

  const loginPost = await fetch(`${base}/erp/login`, {
    method: "POST",
    headers: {
      cookie: cookieHeader(),
      origin: base,
    },
    body: form,
    redirect: "manual",
  });
  absorb(loginPost);

  const postStatus = loginPost.status;
  const postLocation = loginPost.headers.get("location");
  const hasAuthCookie = [...jar.keys()].some(
    (n) => n.includes("-auth-token") && !n.includes("code-verifier"),
  );

  const nextUrl = postLocation?.startsWith("http")
    ? postLocation
    : postLocation
      ? `${base}${postLocation}`
      : `${base}/erp`;

  const erpRes = await fetch(nextUrl, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  absorb(erpRes);

  const erpStatus = erpRes.status;
  const erpLocation = erpRes.headers.get("location");
  const ok =
    hasAuthCookie &&
    erpStatus !== 307 &&
    erpStatus !== 302 &&
    !erpLocation?.includes("/erp/login");

  console.log(
    JSON.stringify(
      {
        ok,
        postStatus,
        postLocation,
        hasAuthCookie,
        authCookieNames: [...jar.keys()].filter((n) => n.startsWith("sb-")),
        erpStatus,
        erpLocation,
      },
      null,
      2,
    ),
  );
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
