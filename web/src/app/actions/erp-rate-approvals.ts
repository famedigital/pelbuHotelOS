"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { roundBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type RateApprovalActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function approveRateRequest(
  _prev: RateApprovalActionState,
  formData: FormData,
): Promise<RateApprovalActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requireDeskRole(["owner", "gm"]);
    const lineId = String(formData.get("booking_room_id") ?? "").trim();
    const bookingId = String(formData.get("booking_id") ?? "").trim();
    if (!UUID_RE.test(lineId) || !UUID_RE.test(bookingId)) {
      throw new Error("Invalid rate request.");
    }
    const note = optionalTrim(formData.get("note"));

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { data: booking } = await admin
      .from("bookings")
      .select("id, status, contact_name, hold_expires_at")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found.");

    const { data: line } = await admin
      .from("booking_rooms")
      .select(
        "id, booking_id, agreed_nightly_rate_btn, sheet_nightly_rate_btn, rate_request_status, room_type_id",
      )
      .eq("id", lineId)
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!line) throw new Error("Room line not found.");
    if ((line.rate_request_status as string) !== "pending") {
      throw new Error("Only pending rate requests can be approved.");
    }
    if (line.agreed_nightly_rate_btn == null) {
      throw new Error("No requested rate on this line.");
    }

    const { error: lineErr } = await admin
      .from("booking_rooms")
      .update({
        rate_request_status: "approved",
        rate_request_reason: note ?? "GM approved",
        agreed_nightly_rate_btn: roundBtn(
          Number(line.agreed_nightly_rate_btn),
        ),
      })
      .eq("id", lineId);
    if (lineErr) throw new Error("Could not approve rate line.");

    const { data: siblings } = await admin
      .from("booking_rooms")
      .select("id, rate_request_status")
      .eq("booking_id", bookingId);
    const stillPending = (siblings ?? []).some(
      (s) => (s.rate_request_status as string) === "pending",
    );

    if (
      !stillPending &&
      (booking.status === "held" || booking.status === "pending")
    ) {
      const { error: bookErr } = await admin
        .from("bookings")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: "rate_approval",
          hold_expires_at: null,
        })
        .eq("id", bookingId)
        .eq("property_id", propertyId);
      if (bookErr) throw new Error("Rate approved but could not confirm stay.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "rate.approve",
      entityType: "booking_rooms",
      entityId: lineId,
      summary: `Approved custom rate · ${booking.contact_name ?? "Guest"}`,
      meta: {
        booking_id: bookingId,
        agreed_nightly_rate_btn: line.agreed_nightly_rate_btn,
        sheet_nightly_rate_btn: line.sheet_nightly_rate_btn,
        note,
        promoted: !stillPending,
      },
    });

    revalidatePath("/erp/rate-approvals");
    revalidatePath("/erp/calendar");
    revalidatePath("/erp/reservations");
    return {
      ok: true,
      message: stillPending
        ? "Line approved — other categories still pending."
        : "Rate approved · booking confirmed.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not approve rate.",
    };
  }
}

export async function rejectRateRequest(
  _prev: RateApprovalActionState,
  formData: FormData,
): Promise<RateApprovalActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requireDeskRole(["owner", "gm"]);
    const lineId = String(formData.get("booking_room_id") ?? "").trim();
    const bookingId = String(formData.get("booking_id") ?? "").trim();
    if (!UUID_RE.test(lineId) || !UUID_RE.test(bookingId)) {
      throw new Error("Invalid rate request.");
    }
    const note = optionalTrim(formData.get("note")) ?? "Rejected by GM";

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { data: booking } = await admin
      .from("bookings")
      .select("id, contact_name, status")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found.");

    const { data: line } = await admin
      .from("booking_rooms")
      .select("id, rate_request_status, sheet_nightly_rate_btn")
      .eq("id", lineId)
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!line) throw new Error("Room line not found.");
    if ((line.rate_request_status as string) !== "pending") {
      throw new Error("Only pending rate requests can be rejected.");
    }

    const { error } = await admin
      .from("booking_rooms")
      .update({
        rate_request_status: "rejected",
        rate_request_reason: note,
        agreed_nightly_rate_btn: null,
      })
      .eq("id", lineId);
    if (error) throw new Error("Could not reject rate request.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "rate.reject",
      entityType: "booking_rooms",
      entityId: lineId,
      summary: `Rejected custom rate · ${booking.contact_name ?? "Guest"}`,
      meta: { booking_id: bookingId, note },
    });

    revalidatePath("/erp/rate-approvals");
    revalidatePath("/erp/calendar");
    revalidatePath("/erp/reservations");
    return {
      ok: true,
      message: "Rate request rejected — line reverts to sheet rate.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reject rate.",
    };
  }
}
