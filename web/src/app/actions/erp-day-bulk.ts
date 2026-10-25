"use server";

import { confirmCheckIn, confirmCheckOut } from "@/app/actions/erp-checkin";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type DayBulkResult = {
  ok: boolean;
  error?: string;
  message?: string;
  done: string[];
  failed: Array<{ bookingId: string; name: string; error: string }>;
};

const PAYMENT_MODES = new Set(["prepaid", "partial", "on_credit", "cash"]);

function refreshDay() {
  revalidatePath("/erp/day");
  revalidatePath("/erp/arrivals");
  revalidatePath("/erp/departures");
  revalidatePath("/erp/in-house");
  revalidatePath("/erp/reservations");
}

/**
 * Check in the chosen arrivals after the desk has already received them.
 * Passport and SDF can be filled later. A stay with no room is left out.
 */
export async function bulkCheckInBookings(bookingIds: string[]): Promise<DayBulkResult> {
  const done: string[] = [];
  const failed: DayBulkResult["failed"] = [];
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired.", done, failed };
    }
    const ids = [...new Set(bookingIds.map((id) => id.trim()).filter(Boolean))].slice(0, 40);
    if (!ids.length) {
      return { ok: false, error: "Choose arrivals to check in.", done, failed };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const { data: bookings } = await admin
      .from("bookings")
      .select(
        "id, status, contact_name, payment_mode, guide_number, room_assignments(room_unit_id)",
      )
      .eq("property_id", propertyId)
      .in("id", ids);

    for (const booking of bookings ?? []) {
      const bookingId = booking.id as string;
      const name = (booking.contact_name as string | null)?.trim() || "Guest";
      const status = booking.status as string;
      if (status === "checked_in") continue;
      if (!["pending", "confirmed", "held"].includes(status)) {
        failed.push({ bookingId, name, error: `Status ${status}` });
        continue;
      }
      const unitIds = (
        (booking.room_assignments as Array<{ room_unit_id?: string | null }> | null) ?? []
      )
        .map((row) => row.room_unit_id)
        .filter((id): id is string => Boolean(id));
      if (!unitIds.length) {
        failed.push({ bookingId, name, error: "Assign a room first" });
        continue;
      }
      const mode = String(booking.payment_mode ?? "cash");
      const form = new FormData();
      form.set("booking_id", bookingId);
      form.set("payment_mode", PAYMENT_MODES.has(mode) ? mode : "cash");
      form.set("guide_number", (booking.guide_number as string | null)?.trim() || "DEFERRED");
      form.set("docs_deferred", "true");
      form.set("allow_dirty_rooms", "on");
      form.set("guest_name", name);
      form.set("guest_passport_or_cid", "DEFERRED");
      form.set("guest_nationality", "Deferred");
      for (const unitId of unitIds) form.append("room_unit_id", unitId);
      const result = await confirmCheckIn({ ok: false }, form);
      if (result.ok) done.push(bookingId);
      else failed.push({ bookingId, name, error: result.error ?? "Check-in failed" });
    }

    if (done.length) {
      await writeAuditEvent(admin, {
        propertyId,
        action: "day.bulk_check_in",
        entityType: "bookings",
        entityId: done[0],
        summary: `Bulk check-in · ${done.length} stay(s)`,
        meta: { done, failed },
      });
      refreshDay();
    }
    const ok = done.length > 0;
    return {
      ok,
      done,
      failed,
      message: ok
        ? `Checked in ${done.length}${failed.length ? ` · ${failed.length} still need a room or a fix` : ""}`
        : failed[0]?.error ?? "No stays checked in.",
      error: ok ? undefined : failed[0]?.error ?? "No stays checked in.",
    };
  } catch (error) {
    return {
      ok: false,
      done,
      failed,
      error: error instanceof Error ? error.message : "Check-in failed.",
    };
  }
}

/** Check out chosen departures. An open guest balance or a missing guide sign stays on the list. */
export async function bulkCheckOutBookings(bookingIds: string[]): Promise<DayBulkResult> {
  const done: string[] = [];
  const failed: DayBulkResult["failed"] = [];
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired.", done, failed };
    }
    const ids = [...new Set(bookingIds.map((id) => id.trim()).filter(Boolean))].slice(0, 40);
    if (!ids.length) {
      return { ok: false, error: "Choose departures to check out.", done, failed };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const { data: bookings } = await admin
      .from("bookings")
      .select("id, status, contact_name")
      .eq("property_id", propertyId)
      .in("id", ids);

    for (const booking of bookings ?? []) {
      const bookingId = booking.id as string;
      const name = (booking.contact_name as string | null)?.trim() || "Guest";
      if ((booking.status as string) !== "checked_in") {
        failed.push({ bookingId, name, error: "Not checked in" });
        continue;
      }
      const form = new FormData();
      form.set("booking_id", bookingId);
      const result = await confirmCheckOut({ ok: false }, form);
      if (result.ok) done.push(bookingId);
      else failed.push({ bookingId, name, error: result.error ?? "Check-out failed" });
    }

    if (done.length) {
      await writeAuditEvent(admin, {
        propertyId,
        action: "day.bulk_check_out",
        entityType: "bookings",
        entityId: done[0],
        summary: `Bulk check-out · ${done.length} stay(s)`,
        meta: { done, failed },
      });
      refreshDay();
    }
    const ok = done.length > 0;
    return {
      ok,
      done,
      failed,
      message: ok
        ? `Checked out ${done.length}${failed.length ? ` · ${failed.length} still open` : ""}`
        : failed[0]?.error ?? "No stays checked out.",
      error: ok ? undefined : failed[0]?.error ?? "No stays checked out.",
    };
  } catch (error) {
    return {
      ok: false,
      done,
      failed,
      error: error instanceof Error ? error.message : "Check-out failed.",
    };
  }
}
