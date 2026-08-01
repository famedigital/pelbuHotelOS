import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type PaymentLinkRow = {
  id: string;
  status: string;
  amount_btn: number;
  folio_id: string | null;
  booking_id: string | null;
  purpose: string;
  payment_id?: string | null;
};

export type ClaimPaymentLinkResult =
  | { ok: true; claimed: true; link: PaymentLinkRow }
  | {
      ok: true;
      claimed: false;
      reason: "already_paid" | "processing" | "not_open";
      link: PaymentLinkRow;
    }
  | { ok: false; error: string };

/**
 * Atomically claim an open payment link (open → processing).
 * Matches the gateway webhook pattern in `/api/payments/webhook`.
 */
export async function claimPaymentLinkOpen(
  admin: Admin,
  linkId: string,
  propertyId: string,
): Promise<ClaimPaymentLinkResult> {
  const { data: claim, error } = await admin
    .from("payment_links")
    .update({ status: "processing" })
    .eq("id", linkId)
    .eq("property_id", propertyId)
    .eq("status", "open")
    .select("id, status, amount_btn, folio_id, booking_id, purpose")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (claim) {
    return { ok: true, claimed: true, link: claim as PaymentLinkRow };
  }

  const { data: current } = await admin
    .from("payment_links")
    .select("id, status, amount_btn, folio_id, booking_id, purpose, payment_id")
    .eq("id", linkId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!current) return { ok: false, error: "Link not found." };

  const status = current.status as string;
  if (status === "paid") {
    return {
      ok: true,
      claimed: false,
      reason: "already_paid",
      link: current as PaymentLinkRow,
    };
  }
  if (status === "processing") {
    return {
      ok: true,
      claimed: false,
      reason: "processing",
      link: current as PaymentLinkRow,
    };
  }
  return {
    ok: true,
    claimed: false,
    reason: "not_open",
    link: current as PaymentLinkRow,
  };
}

/** Release a processing claim back to open (e.g. after a failed post). */
export async function releasePaymentLinkClaim(
  admin: Admin,
  linkId: string,
): Promise<void> {
  await admin
    .from("payment_links")
    .update({ status: "open" })
    .eq("id", linkId)
    .eq("status", "processing");
}

/** Claim all open payment links for a booking (desk confirm vs webhook). */
export async function claimBookingPaymentLinks(
  admin: Admin,
  propertyId: string,
  bookingId: string,
): Promise<void> {
  await admin
    .from("payment_links")
    .update({ status: "processing" })
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId)
    .eq("status", "open");
}

/** Release processing links for a booking after a failed confirmation. */
export async function releaseBookingPaymentLinks(
  admin: Admin,
  propertyId: string,
  bookingId: string,
): Promise<void> {
  await admin
    .from("payment_links")
    .update({ status: "open" })
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId)
    .eq("status", "processing");
}
