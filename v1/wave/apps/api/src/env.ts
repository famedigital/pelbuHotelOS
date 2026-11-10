export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/**
 * Secret for desk JWTs. Required — never fall back to a public default (anyone
 * could mint staff tokens) and never reuse SUPABASE_JWT_SECRET (desk tokens
 * would then be valid Supabase JWTs). Local dev may opt in explicitly.
 */
import { normalizePropertySlugInput } from "@hotel-os/core";

export function jwtSecret(): string {
  const v = process.env.HOTEL_OS_JWT_SECRET?.trim();
  if (v && v.length >= 32) return v;
  if (process.env.HOTEL_OS_ALLOW_DEV_JWT === "1" && process.env.NODE_ENV !== "production") {
    return "dev-only-hotel-os-v2-jwt-not-for-production-use";
  }
  throw new Error(
    "HOTEL_OS_JWT_SECRET must be set (>= 32 chars). For local dev only, set HOTEL_OS_ALLOW_DEV_JWT=1.",
  );
}

export function defaultPropertySlug(): string {
  const candidates = [
    process.env.DEFAULT_PROPERTY_SLUG,
    process.env.FLAGSHIP_PROPERTY_SLUG,
  ];
  for (const c of candidates) {
    const n = normalizePropertySlugInput(c);
    if (n) return n;
  }
  return "pelbu-olakha";
}
