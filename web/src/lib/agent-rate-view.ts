import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const AGENT_RATE_VIEW_COOKIE = "pelbu_agent_rate_view";

/** Soft gate session — long enough for a desk call, short enough to re-log. */
const TTL_MS = 4 * 60 * 60 * 1000;

export type AgentRateViewSession = {
  propertyId: string;
  email: string;
  exp: number;
};

function signingSecret(): string {
  const secret =
    process.env.RATE_CARD_VIEW_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.DESK_PIN?.trim();
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

function signPayload(payloadB64: string): string {
  return createHmac("sha256", signingSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createAgentRateViewToken(
  propertyId: string,
  email: string,
  now = Date.now(),
): string {
  const body: AgentRateViewSession = {
    propertyId,
    email: email.trim().toLowerCase(),
    exp: now + TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(body));
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

export function parseAgentRateViewToken(
  token: string | undefined | null,
  now = Date.now(),
): AgentRateViewSession | null {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  let expected: string;
  try {
    expected = signPayload(payloadB64);
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

export async function readAgentRateViewSession(
  propertyId: string,
): Promise<AgentRateViewSession | null> {
  const jar = await cookies();
  const session = parseAgentRateViewToken(
    jar.get(AGENT_RATE_VIEW_COOKIE)?.value,
  );
  if (!session || session.propertyId !== propertyId) return null;
  return session;
}

export async function setAgentRateViewCookie(
  propertyId: string,
  email: string,
): Promise<void> {
  const token = createAgentRateViewToken(propertyId, email);
  const jar = await cookies();
  jar.set(AGENT_RATE_VIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/rates",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}
