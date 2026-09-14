"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type SalesClaimActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveVerifierStaffId(): Promise<string | null> {
  const session = await getStaffSession();
  return session?.staffId ?? null;
}

export async function approveSalesClaim(
  _prev: SalesClaimActionState,
  formData: FormData,
): Promise<SalesClaimActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requireDeskRole(["owner", "gm"]);
    const bookingId = String(formData.get("booking_id") ?? "").trim();
    if (!UUID_RE.test(bookingId)) throw new Error("Invalid booking.");
    const note = optionalTrim(formData.get("note"));

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const { data: row } = await admin
      .from("bookings")
      .select("id, sold_by_staff_id, sales_claim_status, contact_name")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!row) throw new Error("Booking not found.");
    if (!row.sold_by_staff_id) {
      throw new Error("No sold-by staff on this booking.");
    }
    if ((row.sales_claim_status as string) !== "claimed") {
      throw new Error("Only claimed sales can be approved.");
    }

    const verifiedBy = await resolveVerifierStaffId();
    const { error } = await admin
      .from("bookings")
      .update({
        sales_claim_status: "approved",
        sales_verified_by_staff_id: verifiedBy,
        sales_verified_at: new Date().toISOString(),
        sales_claim_note: note,
      })
      .eq("id", bookingId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not approve claim.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "sales_claim.approve",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Approved sales claim · ${row.contact_name ?? "Guest"}`,
      meta: {
        sold_by_staff_id: row.sold_by_staff_id,
        note,
      },
    });

    revalidatePath("/erp/sales-claims");
    revalidatePath("/erp/reports");
    revalidatePath("/erp/calendar");
    return { ok: true, message: "Sales claim approved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not approve claim.",
    };
  }
}

export async function rejectSalesClaim(
  _prev: SalesClaimActionState,
  formData: FormData,
): Promise<SalesClaimActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requireDeskRole(["owner", "gm"]);
    const bookingId = String(formData.get("booking_id") ?? "").trim();
    if (!UUID_RE.test(bookingId)) throw new Error("Invalid booking.");
    const note = optionalTrim(formData.get("note"));

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const { data: row } = await admin
      .from("bookings")
      .select("id, sold_by_staff_id, sales_claim_status, contact_name")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!row) throw new Error("Booking not found.");
    if (
      !row.sales_claim_status ||
      !["claimed", "approved"].includes(row.sales_claim_status as string)
    ) {
      throw new Error("Nothing to reject on this booking.");
    }

    const verifiedBy = await resolveVerifierStaffId();
    const { error } = await admin
      .from("bookings")
      .update({
        sales_claim_status: "rejected",
        sales_verified_by_staff_id: verifiedBy,
        sales_verified_at: new Date().toISOString(),
        sales_claim_note: note,
      })
      .eq("id", bookingId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not reject claim.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "sales_claim.reject",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Rejected sales claim · ${row.contact_name ?? "Guest"}`,
      meta: {
        sold_by_staff_id: row.sold_by_staff_id,
        note,
      },
    });

    revalidatePath("/erp/sales-claims");
    revalidatePath("/erp/reports");
    revalidatePath("/erp/calendar");
    return { ok: true, message: "Sales claim rejected." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reject claim.",
    };
  }
}
