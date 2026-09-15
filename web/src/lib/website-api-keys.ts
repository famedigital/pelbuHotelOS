import "server-only";

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const API_SCOPES = ["availability", "ari", "bookings"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_PURPOSES = ["website", "channel_manager", "both"] as const;
export type ApiKeyPurpose = (typeof API_PURPOSES)[number];

export type VerifiedApiKey = {
  apiKeyId: string;
  propertyId: string;
  purpose: ApiKeyPurpose;
  scopes: ApiScope[];
  corsOrigins: string[];
  ipAllowlist: string[];
};

const MAX_ACTIVE_KEYS = 5;

function pepper(): string {
  const p =
    process.env.WEBSITE_API_KEY_PEPPER?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!p || p.length < 16) {
    throw new Error("WEBSITE_API_KEY_PEPPER is not configured.");
  }
  return p;
}

export function hashApiKey(fullKey: string): string {
  return createHmac("sha256", pepper()).update(fullKey).digest("hex");
}

export function hashLookupToken(token: string): string {
  return createHmac("sha256", pepper()).update(`lookup:${token}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function generateApiKeyMaterial(
  env: "live" | "test" = "live",
): { fullKey: string; prefix: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  const fullKey = `innora_${env}_${secret}`;
  const prefix = fullKey.slice(0, 12);
  return { fullKey, prefix, hash: hashApiKey(fullKey) };
}

export function generateLookupToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashLookupToken(token) };
}

export function defaultScopesForPurpose(purpose: ApiKeyPurpose): ApiScope[] {
  if (purpose === "website") return ["availability", "bookings"];
  if (purpose === "channel_manager") return ["ari", "availability", "bookings"];
  return ["availability", "ari", "bookings"];
}

export function normalizeCorsOrigins(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const t = item.trim().replace(/\/$/, "");
    if (!t) continue;
    if (t === "*") {
      throw new Error("CORS wildcard * is not allowed.");
    }
    let url: URL;
    try {
      url = new URL(t);
    } catch {
      throw new Error(`Invalid CORS origin: ${t}`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`Invalid CORS origin protocol: ${t}`);
    }
    const origin = `${url.protocol}//${url.host}`;
    if (!out.includes(origin)) out.push(origin);
  }
  return out;
}

export function normalizeIpAllowlist(raw: string[]): string[] {
  return [...new Set(raw.map((s) => s.trim()).filter(Boolean))];
}

function ipMatchesAllowlist(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  // v1: exact IP match only (CIDR deferred)
  return allowlist.includes(ip);
}

export async function verifyBearerApiKey(
  authorization: string | null,
  opts: { ip: string; requiredScope: ApiScope },
): Promise<
  | { ok: true; key: VerifiedApiKey }
  | { ok: false; code: "UNAUTHORIZED" | "REVOKED_KEY" | "FORBIDDEN_SCOPE" }
> {
  const raw = authorization?.trim() ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  const fullKey = m?.[1]?.trim() ?? "";
  if (!fullKey || fullKey.length < 20) {
    // burn cycles similarly
    void hashApiKey("innora_live_dummy_key_for_timing___________");
    return { ok: false, code: "UNAUTHORIZED" };
  }

  const prefix = fullKey.slice(0, 12);
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("property_api_keys")
    .select(
      "id, property_id, purpose, key_hash, scopes, cors_origins, ip_allowlist, expires_at, revoked_at, last_used_at",
    )
    .eq("key_prefix", prefix)
    .maybeSingle();

  const candidateHash = hashApiKey(fullKey);
  if (!row) {
    safeEqualHex(candidateHash, "0".repeat(64));
    return { ok: false, code: "UNAUTHORIZED" };
  }

  if (!safeEqualHex(candidateHash, row.key_hash as string)) {
    return { ok: false, code: "UNAUTHORIZED" };
  }

  if (row.revoked_at) {
    return { ok: false, code: "REVOKED_KEY" };
  }
  if (row.expires_at && new Date(row.expires_at as string).getTime() <= Date.now()) {
    return { ok: false, code: "REVOKED_KEY" };
  }

  const ipAllowlist = (row.ip_allowlist as string[]) ?? [];
  if (!ipMatchesAllowlist(opts.ip, ipAllowlist)) {
    return { ok: false, code: "UNAUTHORIZED" };
  }

  const scopes = ((row.scopes as string[]) ?? []).filter((s): s is ApiScope =>
    (API_SCOPES as readonly string[]).includes(s),
  );
  if (!scopes.includes(opts.requiredScope)) {
    return { ok: false, code: "FORBIDDEN_SCOPE" };
  }

  const lastUsed = row.last_used_at
    ? new Date(row.last_used_at as string).getTime()
    : 0;
  if (Date.now() - lastUsed > 60_000) {
    void admin
      .from("property_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return {
    ok: true,
    key: {
      apiKeyId: row.id as string,
      propertyId: row.property_id as string,
      purpose: row.purpose as ApiKeyPurpose,
      scopes,
      corsOrigins: (row.cors_origins as string[]) ?? [],
      ipAllowlist,
    },
  };
}

export async function countActiveApiKeys(propertyId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("property_api_keys")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .is("revoked_at", null);
  return count ?? 0;
}

export { MAX_ACTIVE_KEYS };

export type ApiKeyListRow = {
  id: string;
  name: string;
  purpose: ApiKeyPurpose;
  keyPrefix: string;
  scopes: ApiScope[];
  corsOrigins: string[];
  ipAllowlist: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export async function listPropertyApiKeys(
  propertyId: string,
): Promise<ApiKeyListRow[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("property_api_keys")
    .select(
      "id, name, purpose, key_prefix, scopes, cors_origins, ip_allowlist, expires_at, revoked_at, last_used_at, created_at",
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    purpose: r.purpose as ApiKeyPurpose,
    keyPrefix: r.key_prefix as string,
    scopes: (r.scopes as ApiScope[]) ?? [],
    corsOrigins: (r.cors_origins as string[]) ?? [],
    ipAllowlist: (r.ip_allowlist as string[]) ?? [],
    expiresAt: (r.expires_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
    lastUsedAt: (r.last_used_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function insertPropertyApiKey(input: {
  propertyId: string;
  name: string;
  purpose: ApiKeyPurpose;
  scopes: ApiScope[];
  corsOrigins: string[];
  ipAllowlist: string[];
  expiresAt: string | null;
  createdByStaffId: string | null;
  env?: "live" | "test";
}): Promise<{ id: string; fullKey: string; prefix: string }> {
  const active = await countActiveApiKeys(input.propertyId);
  if (active >= MAX_ACTIVE_KEYS) {
    throw new Error(`At most ${MAX_ACTIVE_KEYS} active API keys per hotel.`);
  }
  const material = generateApiKeyMaterial(input.env ?? "live");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("property_api_keys")
    .insert({
      property_id: input.propertyId,
      name: input.name,
      purpose: input.purpose,
      key_prefix: material.prefix,
      key_hash: material.hash,
      scopes: input.scopes,
      cors_origins: input.corsOrigins,
      ip_allowlist: input.ipAllowlist,
      expires_at: input.expiresAt,
      created_by_staff_id: input.createdByStaffId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("insertPropertyApiKey", error);
    throw new Error("Could not create API key.");
  }
  return {
    id: data.id as string,
    fullKey: material.fullKey,
    prefix: material.prefix,
  };
}

export async function revokePropertyApiKey(
  propertyId: string,
  keyId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("property_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("property_id", propertyId)
    .is("revoked_at", null);
  if (error) throw new Error("Could not revoke API key.");
}

export async function writeApiAudit(row: {
  apiKeyId: string | null;
  propertyId: string | null;
  route: string;
  method: string;
  status: number;
  ip: string;
  requestId: string;
  latencyMs: number;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("api_request_audit").insert({
    api_key_id: row.apiKeyId,
    property_id: row.propertyId,
    route: row.route,
    method: row.method,
    status: row.status,
    ip: row.ip,
    request_id: row.requestId,
    latency_ms: row.latencyMs,
  });
}
