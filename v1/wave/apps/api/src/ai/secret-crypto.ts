import { createDecipheriv, createHash } from "node:crypto";

/**
 * Decrypt property_ai_settings.gemini_api_key_enc.
 * Must stay byte-compatible with Innora `web/src/lib/ai/secret-crypto.ts`
 * (AES-256-GCM, "v1:" + base64url(iv[12] | tag[16] | ciphertext)), keyed by
 * sha256(AI_SECRETS_KEY || SUPABASE_SERVICE_ROLE_KEY). Set the SAME
 * AI_SECRETS_KEY on the v2 API container as on Innora or keys won't decrypt.
 */
const PREFIX = "v1:";

function keyBytes(): Buffer {
  const raw =
    process.env.AI_SECRETS_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!raw) {
    throw new Error("AI_SECRETS_KEY (or service role) required to read Gemini keys.");
  }
  return createHash("sha256").update(raw).digest();
}

export function decryptSecret(blob: string | null | undefined): string | null {
  if (!blob?.trim() || !blob.startsWith(PREFIX)) return null;
  const buf = Buffer.from(blob.slice(PREFIX.length), "base64url");
  if (buf.length < 12 + 16 + 1) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    // Wrong AI_SECRETS_KEY or tampered blob — treat as not configured.
    return null;
  }
}

/** Mirrors Innora `lib/ai/gemini-models.ts`. */
const RETIRED_GEMINI_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
]);
const FAST_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"] as const;

export function liveGeminiModel(saved?: string | null): string {
  const name = saved?.trim() ?? "";
  return name && !RETIRED_GEMINI_MODELS.has(name) ? name : FAST_GEMINI_MODELS[0];
}
