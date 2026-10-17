import { createHmac, timingSafeEqual } from "node:crypto";

export const AGENT_PORTAL_COOKIE = "innora_agent_portal";
export const AGENT_PORTAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type PortalCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
  domain?: string;
};

export type AgentPortalSession = {
  agentId: string;
  authUserId: string;
  exp: number;
};

export function agentPortalSigningSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret =
    env.AGENT_PORTAL_SECRET?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    env.DESK_PIN?.trim();
  if (!secret) {
    throw new Error("Agent portal signing is not configured.");
  }
  return secret;
}

function b64url(data: string | Buffer): string {
  return Buffer.from(data)
    .toString("base64url")
    .replace(/=+$/, "");
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createAgentPortalToken(
  agentId: string,
  authUserId: string,
  now = Date.now(),
  secret = agentPortalSigningSecret(),
): string {
  const body: AgentPortalSession = {
    agentId,
    authUserId,
    exp: now + AGENT_PORTAL_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(body));
  return `${payloadB64}.${signPayload(payloadB64, secret)}`;
}

export function parseAgentPortalToken(
  token: string | undefined | null,
  now = Date.now(),
  secret?: string,
): AgentPortalSession | null {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  let expected: string;
  try {
    expected = signPayload(payloadB64, secret ?? agentPortalSigningSecret());
  } catch {
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const body = JSON.parse(raw) as AgentPortalSession;
    if (
      !body?.agentId ||
      !body?.authUserId ||
      typeof body.exp !== "number" ||
      body.exp <= now
    ) {
      return null;
    }
    return {
      agentId: String(body.agentId),
      authUserId: String(body.authUserId),
      exp: body.exp,
    };
  } catch {
    return null;
  }
}

/** Shared apex/www cookie scope when serving innorahotel.com. */
export function agentPortalCookieDomain(
  host: string | null | undefined,
): string | undefined {
  const h = (host ?? "").split(":")[0]?.toLowerCase() ?? "";
  if (h === "innorahotel.com" || h.endsWith(".innorahotel.com")) {
    return ".innorahotel.com";
  }
  return undefined;
}

export function agentPortalCookieOptions(
  host: string | null | undefined,
  opts?: { clear?: boolean },
): PortalCookieOptions {
  const domain = agentPortalCookieDomain(host);
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: opts?.clear ? 0 : Math.floor(AGENT_PORTAL_TTL_MS / 1000),
    ...(domain ? { domain } : {}),
  };
}

/** Clear both Domain-scoped and host-only portal cookies. */
export function portalCookieClearSpecs(
  host: string | null | undefined,
): Array<{ name: string; value: string; options: PortalCookieOptions }> {
  const domainClear = agentPortalCookieOptions(
    host ?? "innorahotel.com",
    { clear: true },
  );
  const hostOnlyClear = agentPortalCookieOptions(null, { clear: true });
  return [
    { name: AGENT_PORTAL_COOKIE, value: "", options: domainClear },
    { name: AGENT_PORTAL_COOKIE, value: "", options: hostOnlyClear },
  ];
}
