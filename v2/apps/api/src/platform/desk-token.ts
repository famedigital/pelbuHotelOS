/** Shared desk/portal token issue + verify (HMAC SHA-256 over base64url JSON). */
import { createHash } from "node:crypto";

export type DeskTokenClaims = {
  sub: string;
  propertyId: string;
  organizationId?: string;
  role: "staff" | "hotel_desk" | "agent" | "guide" | "driver" | "owner";
  staffId?: string;
  staffName?: string;
  deskRole?: string;
  employeeCode?: string | null;
  portalAccountId?: string;
  subjectId?: string;
  homeRoute?: string;
  iat?: number;
};

function secret(): string {
  return process.env.DESK_JWT_SECRET ?? "hos-v2-desk-dev";
}

export function issueDeskToken(payload: Omit<DeskTokenClaims, "iat">): string {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString(
    "base64url",
  );
  const sig = createHash("sha256").update(`${body}:${secret()}`).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDeskToken(token: string | undefined | null): DeskTokenClaims | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHash("sha256").update(`${body}:${secret()}`).digest("base64url");
  if (expected !== sig) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DeskTokenClaims;
    if (!claims.sub || !claims.propertyId || !claims.role) return null;
    return claims;
  } catch {
    return null;
  }
}

export function bearerToken(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || null;
}
