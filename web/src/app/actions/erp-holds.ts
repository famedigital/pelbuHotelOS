"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  holdExpiresAtFromNow,
  loadDepositRule,
  paymentLinkToken,
  resolveHoldTtlHours,
  type BookingSource,
} from "@/lib/holds";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type HoldActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  paymentUrl?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateHolds() {
  revalidatePath("/erp");
  revalidatePath("/erp/group");
  revalidatePath("/erp/check-in");
}

/** Payment methods the system records against a token/deposit. */
const TOKEN_PAYMENT_METHODS = [
  "cash",
  "bank",
  "card",
  "agent_credit",
  "bank_qr",
  "pay_bt",
  "deposit",
] as const;
type TokenPaymentMethod = (typeof TOKEN_PAYMENT_METHODS)[number];

function normalisePaymentMethod(method: string | null | undefined): TokenPaymentMethod {
  return (
    TOKEN_PAYMENT_METHODS as readonly string[]
  ).includes(method ?? "")
    ? (method as TokenPaymentMethod)
    : "bank";
}

/**
 * Core booking-confirmation logic — shared by the desk action
 * (`confirmBookingToken`) and the gateway webhook
 * (`/api/payments/webhook`). Performs no auth check itself; callers gate it.
 *
 * Idempotent in spirit: re-confirming a booking that is already confirmed is
 * rejected unless `allowOverride` is true.
 */
export async function applyBookingConfirmation(args: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  propertyId: string;
  bookingId: string;
  amountBtn?: number | null;
  method?: string | null;
  reference?: string | null;
  confirmedBy: string;
  paymentGateway?: "manual" | "pay_bt" | "bank_qr";
  allowOverride?: boolean;
}): Promise<{ bookingId: string; amount: number; paymentId: string | null }> {
  const {
    admin,
    propertyId,
    bookingId,
    method,
    reference,
    confirmedBy,
    paymentGateway = "manual",
    allowOverride = false,
  } = args;

  const { data: booking, error } = await admin
    .from("bookings")
    .select(
      "id, status, token_required_btn, token_received_btn, check_in, check_out, contact_name",
    )
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .single();
  if (error || !booking) throw new Error("Booking not found.");
  if (
    !["held", "pending"].includes(booking.status as string) &&
    !allowOverride
  ) {
    throw new Error(`Cannot confirm token from status ${booking.status}.`);
  }

  const required = Number(booking.token_required_btn ?? 0);
  const amount =
    args.amountBtn != null
      ? Number(args.amountBtn)
      : required > 0
        ? required
        : 0;
  if (!allowOverride && amount <= 0) {
    throw new Error("Token amount required.");
  }
  if (!allowOverride && required > 0 && amount + 0.01 < required) {
    throw new Error(
      `Token shortfall: need Nu ${required.toFixed(0)}, got Nu ${amount.toFixed(0)}.`,
    );
  }

  const now = new Date().toISOString();
  const received =
    Number(booking.token_received_btn ?? 0) + Math.max(0, amount);

  let paymentId: string | null = null;
  if (amount > 0) {
    const payMethod = normalisePaymentMethod(method);
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        property_id: propertyId,
        booking_id: bookingId,
        amount_btn: amount,
        method: payMethod,
        kind: "deposit",
        reference: reference ?? null,
        notes: "Booking token / deposit",
      })
      .select("id")
      .single();
    if (payErr || !payment) {
      console.error("applyBookingConfirmation payment", payErr);
      throw new Error("Could not record deposit payment.");
    }
    paymentId = payment.id as string;
  }

  await admin
    .from("payment_links")
    .update({
      status: amount > 0 ? "paid" : "cancelled",
      paid_at: amount > 0 ? now : null,
      payment_id: paymentId,
      payment_gateway: amount > 0 ? paymentGateway : "manual",
    })
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId)
    .in("status", ["open", "processing"]);

  const { error: upd } = await admin
    .from("bookings")
    .update({
      status: "confirmed",
      token_received_btn: received,
      confirmed_at: now,
      confirmed_by: confirmedBy,
      payment_mode: "partial",
    })
    .eq("id", bookingId);
  if (upd) throw new Error("Could not confirm booking.");

  await writeAuditEvent(admin, {
    propertyId,
    action: "booking.token_confirm",
    entityType: "bookings",
    entityId: bookingId,
    summary: allowOverride
      ? `Owner override confirm · Nu ${amount}`
      : `Token confirmed · Nu ${amount}`,
  });

  return { bookingId, amount, paymentId };
}

/** Mark payment link paid → confirm booking + post deposit payment. */
export async function confirmBookingToken(
  _prev: HoldActionState,
  formData: FormData,
): Promise<HoldActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const amountRaw = optionalTrim(formData.get("amount_btn"));
    const method = optionalTrim(formData.get("method")) ?? "bank";
    const reference = optionalTrim(formData.get("reference"));
    const override = optionalTrim(formData.get("owner_override")) === "1";

    const { amount } = await applyBookingConfirmation({
      admin,
      propertyId: pid,
      bookingId,
      amountBtn: amountRaw ? Number(amountRaw) : null,
      method,
      reference,
      confirmedBy: override ? "owner_override" : "desk_token",
      paymentGateway: "manual",
      allowOverride: override,
    });

    revalidateHolds();
    return {
      ok: true,
      message: `Confirmed · deposit Nu ${amount.toFixed(0)} recorded.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Confirm failed.",
    };
  }
}

export async function extendBookingHold(
  _prev: HoldActionState,
  formData: FormData,
): Promise<HoldActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const reason = optionalTrim(formData.get("reason")) ?? "desk_extend";

    const { data: booking } = await admin
      .from("bookings")
      .select("id, status, source, check_in, hold_extended_count, hold_expires_at")
      .eq("id", bookingId)
      .eq("property_id", pid)
      .single();
    if (!booking) throw new Error("Booking not found.");
    if ((booking.status as string) !== "held") {
      throw new Error("Only held bookings can be extended.");
    }
    if (Number(booking.hold_extended_count ?? 0) >= 1) {
      throw new Error("Hold already extended once.");
    }

    const source = (booking.source as BookingSource) ?? "client";
    const { hours } = await resolveHoldTtlHours(
      admin,
      pid,
      source,
      booking.check_in as string,
    );
    const expires = holdExpiresAtFromNow(hours);

    const { error } = await admin
      .from("bookings")
      .update({
        hold_expires_at: expires,
        hold_extended_count: Number(booking.hold_extended_count ?? 0) + 1,
      })
      .eq("id", bookingId);
    if (error) throw new Error("Could not extend hold.");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "booking.hold_extend",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Hold extended +${hours}h · ${reason}`,
    });

    revalidateHolds();
    return { ok: true, message: `Hold extended ${hours}h.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Extend failed.",
    };
  }
}

/** Create or refresh open payment link for a held booking. */
export async function ensurePaymentLinkForBooking(
  bookingId: string,
  propertyId: string,
): Promise<{ token: string; amount: number } | null> {
  const admin = createSupabaseAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, token_required_btn, contact_name, contact_phone, status")
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!booking) return null;

  const amount = Number(booking.token_required_btn ?? 0);
  if (amount <= 0) return null;

  const { data: existing } = await admin
    .from("payment_links")
    .select("token, amount_btn")
    .eq("booking_id", bookingId)
    .eq("status", "open")
    .maybeSingle();
  if (existing?.token) {
    return {
      token: existing.token as string,
      amount: Number(existing.amount_btn),
    };
  }

  const rule = await loadDepositRule(admin, propertyId);
  const token = paymentLinkToken();
  const { error } = await admin.from("payment_links").insert({
    property_id: propertyId,
    booking_id: bookingId,
    token,
    amount_btn: amount,
    purpose: "deposit",
    payee_name: booking.contact_name,
    payee_phone: booking.contact_phone,
    bank_hint: rule.bank_hint,
    status: "open",
    expires_at: null,
  });
  if (error) {
    console.error("ensurePaymentLinkForBooking", error);
    return null;
  }
  return { token, amount };
}

/** Expire all past-due held bookings (desk button or cron). */
export async function expireHeldBookings(
  propertyId?: string,
): Promise<{ expired: number }> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  let query = admin
    .from("bookings")
    .select("id, property_id, check_in, check_out")
    .eq("status", "held")
    .lt("hold_expires_at", now);

  if (propertyId) query = query.eq("property_id", propertyId);

  const { data: rows } = await query.limit(200);
  let expired = 0;
  for (const row of rows ?? []) {
    const { error } = await admin
      .from("bookings")
      .update({
        status: "expired",
        cancel_reason: "hold_ttl_expired",
        cancelled_at: now,
      })
      .eq("id", row.id)
      .eq("status", "held");
    if (error) continue;

    await admin
      .from("payment_links")
      .update({ status: "expired" })
      .eq("booking_id", row.id)
      .eq("status", "open");

    await writeAuditEvent(admin, {
      propertyId: row.property_id as string,
      action: "booking.hold_expire",
      entityType: "bookings",
      entityId: row.id as string,
      summary: "Hold TTL expired · inventory released",
    });
    expired += 1;
  }
  if (expired > 0) revalidateHolds();
  return { expired };
}

export async function runExpireHoldsAction(): Promise<HoldActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);
    const { expired } = await expireHeldBookings(pid);
    return {
      ok: true,
      message:
        expired === 0
          ? "No expired holds."
          : `Expired ${expired} hold${expired === 1 ? "" : "s"}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Expire failed.",
    };
  }
}

export async function switchActiveProperty(
  formData: FormData,
): Promise<void> {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired.");
  }
  const id = trimRequired(formData.get("property_id"), "Property");
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("properties")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("Property not found.");

  const { cookies } = await import("next/headers");
  const { ACTIVE_PROPERTY_COOKIE } = await import("@/lib/property-context");
  const jar = await cookies();
  jar.set(ACTIVE_PROPERTY_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/erp");
  const { redirect } = await import("next/navigation");
  redirect("/erp");
}
