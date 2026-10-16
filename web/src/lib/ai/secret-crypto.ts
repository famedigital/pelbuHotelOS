import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "v1:";

function keyBytes(): Buffer {
  const raw =
    process.env.AI_SECRETS_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!raw) {
    throw new Error("AI_SECRETS_KEY (or service role) required to store Gemini keys.");
  }
  return createHash("sha256").update(raw).digest();
}

/** Encrypt a plaintext API key for property_ai_settings.gemini_api_key_enc. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    Buffer.concat([iv, tag, enc]).toString("base64url")
  );
}

export function decryptSecret(blob: string | null | undefined): string | null {
  if (!blob?.trim()) return null;
  if (!blob.startsWith(PREFIX)) return null;
  const buf = Buffer.from(blob.slice(PREFIX.length), "base64url");
  if (buf.length < 12 + 16 + 1) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function maskApiKey(plain: string | null | undefined): string | null {
  if (!plain?.trim()) return null;
  const s = plain.trim();
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
