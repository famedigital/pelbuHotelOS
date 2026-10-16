import { createHmac, timingSafeEqual } from "node:crypto";

/** Guest receipt links stay open long enough for WhatsApp / email follow-up. */
export const POS_RECEIPT_SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type PosReceiptShareSession = {
  orderId: string;
  propertyId: string;
  exp: number;
};

function signingSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret =
    env.RECEIPT_SHARE_SECRET?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    env.DESK_PIN?.trim();
  if (!secret) {
    throw new Error("Receipt share signing is not configured.");
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

export function createPosReceiptShareToken(
  orderId: string,
  propertyId: string,
  now = Date.now(),
  secret = signingSecret(),
): string {
  const body: PosReceiptShareSession = {
    orderId,
    propertyId,
    exp: now + POS_RECEIPT_SHARE_TTL_MS,
  };
  const payloadB64 = b64url(JSON.stringify(body));
  return `${payloadB64}.${signPayload(payloadB64, secret)}`;
}

export function parsePosReceiptShareToken(
  token: string | undefined | null,
  now = Date.now(),
  secret?: string,
): PosReceiptShareSession | null {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  let expected: string;
  try {
    expected = signPayload(payloadB64, secret ?? signingSecret());
  } catch {
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const body = JSON.parse(raw) as PosReceiptShareSession;
    if (
      !body?.orderId ||
      !body?.propertyId ||
      typeof body.exp !== "number" ||
      body.exp <= now
    ) {
      return null;
    }
    return {
      orderId: String(body.orderId),
      propertyId: String(body.propertyId),
      exp: body.exp,
    };
  } catch {
    return null;
  }
}

export function posReceiptSharePath(token: string): string {
  return `/guest/receipt/${encodeURIComponent(token)}`;
}
