import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Server-only seal for laundry bag QR tokens so stickers can be reprinted
 * without rotating the hash (which would kill existing physical labels).
 */

function sealKey(): Buffer {
  const material =
    process.env.LAUNDRY_BAG_TOKEN_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "pelbu-dev-laundry-bag-seal";
  return createHash("sha256")
    .update(`pelbu-laundry-bag-token-v1:${material}`)
    .digest();
}

/** AES-256-GCM: base64url(iv || ciphertext || tag). */
export function sealLaundryBagToken(rawToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const enc = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64url");
}

export function unsealLaundryBagToken(sealed: string | null | undefined): string | null {
  if (!sealed?.trim()) return null;
  try {
    const buf = Buffer.from(sealed, "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const data = buf.subarray(12, buf.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
