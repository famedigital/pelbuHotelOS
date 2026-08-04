import { createHmac, timingSafeEqual } from "node:crypto";

/** Soft gate session — long enough for a desk call, short enough to re-log. */
export const AGENT_RATE_VIEW_TTL_MS = 4 * 60 * 60 * 1000;

export type AgentRateViewSession = {
  propertyId: string;
  email: string;
  exp: number;
};

export function agentRateViewSigningSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret =
    env.RATE_CARD_VIEW_SECRET?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    env.DESK_PIN?.trim();
  if (!secret) {
    throw new Error("Rate card view signing is not configured.");
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

export function createAgentRateViewToken(
  propertyId: string,
  email: string,
  now = Date.now(),
  secret = agentRateViewSigningSecret(),
): string {
  const body: AgentRateViewSession = {
    propertyId,
    email: email.trim().toLowerCase(),
    exp: now + AGENT_RATE_VIEW_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(body));
  return `${payloadB64}.${signPayload(payloadB64, secret)}`;
}

export function parseAgentRateViewToken(
  token: string | undefined | null,
  now = Date.now(),
  secret?: string,
): AgentRateViewSession | null {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  let expected: string;
  try {
    expected = signPayload(payloadB64, secret ?? agentRateViewSigningSecret());
  } catch {
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const body = JSON.parse(raw) as AgentRateViewSession;
    if (
      !body?.propertyId ||
      !body?.email ||
      typeof body.exp !== "number" ||
      body.exp <= now
    ) {
      return null;
    }
    return {
      propertyId: String(body.propertyId),
      email: String(body.email).toLowerCase(),
      exp: body.exp,
    };
  } catch {
    return null;
  }
}
