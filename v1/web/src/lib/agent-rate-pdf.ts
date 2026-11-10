import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { agentRateViewSigningSecret } from "@/lib/agent-rate-view-token";

/** Short window after form submit to hit the download route once. */
export const AGENT_RATE_PDF_TTL_MS = 15 * 60 * 1000;
export const AGENT_RATE_PDF_COOKIE = "pelbu_agent_rate_pdf";

export type AgentRatePdfSession = {
  propertyId: string;
  email: string;
  phone: string;
  exp: number;
};

function b64url(data: string | Buffer): string {
  return Buffer.from(data).toString("base64url").replace(/=+$/, "");
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createAgentRatePdfToken(
  propertyId: string,
  email: string,
  phone: string,
  now = Date.now(),
  secret = agentRateViewSigningSecret(),
): string {
  const body: AgentRatePdfSession = {
    propertyId,
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    exp: now + AGENT_RATE_PDF_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(body));
  return `${payloadB64}.${signPayload(payloadB64, secret)}`;
}

export function parseAgentRatePdfToken(
  token: string | undefined | null,
  now = Date.now(),
  secret?: string,
): AgentRatePdfSession | null {
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
    const body = JSON.parse(raw) as AgentRatePdfSession;
    if (
      !body?.propertyId ||
      !body?.email ||
      !body?.phone ||
      typeof body.exp !== "number" ||
      body.exp <= now
    ) {
      return null;
    }
    return {
      propertyId: String(body.propertyId),
      email: String(body.email).toLowerCase(),
      phone: String(body.phone),
      exp: body.exp,
    };
  } catch {
    return null;
  }
}

export async function setAgentRatePdfCookie(
  propertyId: string,
  email: string,
  phone: string,
): Promise<void> {
  const token = createAgentRatePdfToken(propertyId, email, phone);
  const jar = await cookies();
  jar.set(AGENT_RATE_PDF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(AGENT_RATE_PDF_TTL_MS / 1000),
  });
}

export async function readAgentRatePdfSession(
  propertyId: string,
): Promise<AgentRatePdfSession | null> {
  const jar = await cookies();
  const session = parseAgentRatePdfToken(jar.get(AGENT_RATE_PDF_COOKIE)?.value);
  if (!session || session.propertyId !== propertyId) return null;
  return session;
}

export function normalizeAgentEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAgentPhone(phone: string): string {
  return phone.trim().replace(/\s+/g, " ");
}
