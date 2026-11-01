"use server";

import { randomUUID } from "crypto";
import { writeAuditEvent } from "@/lib/audit";
import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type StayHubCheckoutResult =
  | {
      success: true;
      bookingId: string;
      invoiceNumber: string | null;
      alreadyExists?: boolean;
    }
  | { success: false; error: string };

/**
 * StayHub Settle & Check-out — atomic RPC with guest-stream balance + gapless INV.
 */
export async function checkoutStayAtomic(input: {
  bookingId: string;
  propertyId: string;
  idempotencyKey?: string | null;
  allowBalance?: boolean;
  issueInvoice?: boolean;
}): Promise<StayHubCheckoutResult> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    assertDeskProperty(propertyId, input.propertyId, "Property");

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, property_id, status, contact_name")
      .eq("id", input.bookingId)
      .maybeSingle();
    if (bookingError || !booking) {
      return { success: false, error: "Stay record not found" };
    }
    assertDeskProperty(propertyId, booking.property_id as string, "Booking");

    const key = (input.idempotencyKey?.trim() || randomUUID()).toLowerCase();
    const { data, error } = await admin.rpc("stayhub_checkout_atomic", {
      p_property_id: propertyId,
      p_booking_id: input.bookingId,
      p_idempotency_key: key,
      p_cashier_id: null,
      p_allow_balance: Boolean(input.allowBalance),
      p_issue_invoice: input.issueInvoice !== false,
    });

    if (error) {
      console.error("[checkoutStayAtomic] RPC failed", {
        bookingId: input.bookingId,
        error,
      });
      return {
        success: false,
        error: error.message || "Checkout failed",
      };
    }

    const row = (data ?? {}) as {
      success?: boolean;
      ok?: boolean;
      error?: string;
      invoice_number?: string | null;
      already_exists?: boolean;
      booking_id?: string;
    };

    if (row.success === false || (row.ok === false && row.success !== true)) {
      return {
        success: false,
        error: row.error || "Checkout blocked",
      };
    }

    if (!row.already_exists) {
      await writeAuditEvent(admin, {
        propertyId,
        action: "booking.check_out",
        entityType: "bookings",
        entityId: input.bookingId,
        summary: `StayHub checkout ${(booking.contact_name as string) ?? "guest"}${
          row.invoice_number ? ` · ${row.invoice_number}` : ""
        }`,
        meta: {
          invoiceNumber: row.invoice_number ?? null,
          source: "stayhub_checkout_atomic",
        },
      });
    }

    revalidatePath("/erp/calendar");
    revalidatePath("/erp/housekeeping");
    revalidatePath("/erp/day");
    revalidatePath(`/erp/folios`);

    return {
      success: true,
      bookingId: input.bookingId,
      invoiceNumber: row.invoice_number ?? null,
      alreadyExists: Boolean(row.already_exists),
    };
  } catch (err) {
    console.error("[checkoutStayAtomic]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Checkout failed",
    };
  }
}
