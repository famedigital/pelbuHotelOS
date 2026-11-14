/** Shared desk/portal token issue + verify (HMAC SHA-256 over base64url JSON). */
import { createHash, timingSafeEqual } from "node:crypto";

export const DEV_DESK_JWT_SECRET = "hos-v2-desk-dev";

export type DeskTokenClaims = {
  sub: string;
  propertyId: string;
  organizationId?: string;
  /** Travel Agent OS tenant (M01). Required for role=agent going forward. */
  agencyOrgId?: string;
  role: "staff" | "hotel_desk" | "agent" | "guide" | "driver" | "owner";
  staffId?: string;
  staffName?: string;
  deskRole?: string;
  employeeCode?: string | null;
  portalAccountId?: string;
  subjectId?: string;
  homeRoute?: string;
  /** Unix seconds */
  iat?: number;
  /** Unix seconds — required on verify (M01 Phase A) */
  exp?: number;
};

function secret(): string {
  return process.env.DESK_JWT_SECRET ?? DEV_DESK_JWT_SECRET;
}

/** Call at API boot. Refuses default secret in production unless ALLOW_DEV_DESK_JWT_SECRET=1. */
export function assertDeskJwtSecretConfigured(): void {
  const s = process.env.DESK_JWT_SECRET ?? DEV_DESK_JWT_SECRET;
  const allowDev =
    String(process.env.ALLOW_DEV_DESK_JWT_SECRET ?? "") === "1";
  const isProd =
    String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
  if (isProd && s === DEV_DESK_JWT_SECRET && !allowDev) {
    throw new Error(
      "DESK_JWT_SECRET must be set to a non-default value in production",
    );
  }
}

function tokenTtlSec(): number {
  const n = Number(process.env.DESK_TOKEN_TTL_SEC ?? 28800);
  return Number.isFinite(n) && n > 60 ? Math.trunc(n) : 28800;
}

export function issueDeskToken(
  payload: Omit<DeskTokenClaims, "iat" | "exp"> & { exp?: number },
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const { exp: expOverride, ...rest } = payload;
  const body = Buffer.from(
    JSON.stringify({
      ...rest,
      iat: nowSec,
      exp: expOverride ?? nowSec + tokenTtlSec(),
    }),
  ).toString("base64url");
  const sig = createHash("sha256")
    .update(`${body}:${secret()}`)
    .digest("base64url");
  return `${body}.${sig}`;
}

function safeEqualB64(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyDeskToken(
  token: string | undefined | null,
): DeskTokenClaims | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHash("sha256")
    .update(`${body}:${secret()}`)
    .digest("base64url");
  if (!safeEqualB64(expected, sig)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as DeskTokenClaims;
    if (!claims.sub || !claims.propertyId || !claims.role) return null;
    if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp < nowSec) return null;
    return claims;
  } catch {
    return null;
  }
}

export function bearerToken(
  header: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || null;
}
