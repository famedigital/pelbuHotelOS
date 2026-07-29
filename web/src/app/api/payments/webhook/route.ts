import { applyBookingConfirmation } from "@/app/actions/erp-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Gateway = "pay_bt" | "bank_qr";

type WebhookPayload = {
  /** `payment_links.token` issued when the booking hold was created. */
  token?: string;
  /** Amount actually captured, in BTN. Falls back to the link's amount. */
  amount_btn?: number | string;
  /** Payment method to record on the `payments` row. */
  method?: "pay_bt" | "bank_qr" | "card" | "bank";
  /** Gateway / bank transaction reference. */
  reference?: string;
  /** Which gateway sent this event. */
  gateway?: Gateway;
};

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

/**
 * Verify a HMAC-SHA256 signature over the raw request body.
 *
 * The gateway is expected to send header `X-Pelbu-Signature: sha256=<hex>`
 * computed from the raw body using the shared secret `PAYMENTS_WEBHOOK_SECRET`.
 *
 * If no secret is configured the webhook refuses to run — no auth bypass.
 */
async function verifySignature(request: Request): Promise<boolean> {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("x-pelbu-signature") ?? "";
  const match = /^sha256=([a-f0-9]+)$/i.exec(header.trim());
  if (!match) return false;

  const expectedHex = match[1].toLowerCase();
  const rawBody = await request.clone().text();
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");

  if (computed.length !== expectedHex.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHex));
  } catch {
    return false;
  }
}

/**
 * Payment-gateway webhook.
 *
 * Confirms a held booking and records the deposit payment when a gateway
 * (Pay.bt, bank QR) reports a successful capture for a payment link token.
 * Same logic as the desk "confirm token" button — no desk auth needed, the
 * signature is the auth.
 *
 * Until a real gateway account exists this endpoint is dormant (no
 * PAYMENTS_WEBHOOK_SECRET configured → all requests 503).
 */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.PAYMENTS_WEBHOOK_SECRET?.trim()) {
    return json(503, { error: "Payment webhooks not configured." });
  }

  const ok = await verifySignature(request);
  if (!ok) return json(401, { error: "Invalid signature." });

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) return json(400, { error: "Missing token." });

  const gateway: Gateway =
    payload.gateway === "pay_bt" || payload.gateway === "bank_qr"
      ? payload.gateway
      : "pay_bt";

  const admin = createSupabaseAdminClient();
  const { data: link, error: linkErr } = await admin
    .from("payment_links")
    .select("id, booking_id, property_id, amount_btn, status")
    .eq("token", token)
    .maybeSingle();

  if (linkErr || !link) return json(404, { error: "Link not found." });
  if ((link.status as string) !== "open") {
    return json(409, { error: "Link already settled or cancelled." });
  }
  if (!link.booking_id || !link.property_id) {
    return json(400, { error: "Link is not bound to a booking." });
  }

  const linkAmount = Number(link.amount_btn ?? 0);
  const amountBtn =
    payload.amount_btn != null && payload.amount_btn !== ""
      ? Number(payload.amount_btn)
      : linkAmount;
  if (!Number.isFinite(amountBtn) || amountBtn < 0) {
    return json(400, { error: "Invalid amount." });
  }

  try {
    await applyBookingConfirmation({
      admin,
      propertyId: link.property_id as string,
      bookingId: link.booking_id as string,
      amountBtn,
      method: payload.method ?? gateway,
      reference: payload.reference ?? null,
      confirmedBy: `gateway:${gateway}`,
      paymentGateway: gateway,
    });
    return json(200, { ok: true, booking_id: link.booking_id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Confirm failed.";
    console.error("payments webhook", message);
    return json(500, { error: message });
  }
}

export async function GET(): Promise<Response> {
  return json(405, { error: "Use POST." });
}
