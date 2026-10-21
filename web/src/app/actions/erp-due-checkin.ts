"use server";

import { confirmCheckIn, type CheckInState } from "@/app/actions/erp-checkin";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  DUE_CHECK_IN_STATUSES,
  dueStayOpenOr,
  isDueToCheckIn,
} from "@/lib/erp/due-check-in";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const PAYMENT_MODES = new Set(["prepaid", "partial", "on_credit", "cash"]);

export type DueCheckInFailure = {
  bookingId: string;
  name: string;
  error: string;
};

export type DueCheckInResult = {
  ok: boolean;
  error?: string;
  message: string;
  checkedIn: number;
  failed: DueCheckInFailure[];
  skippedUnassigned: number;
};

function paymentModeFor(
  mode: string | null | undefined,
  hasAgent: boolean,
): string {
  const value = (mode ?? "").trim();
  if (PAYMENT_MODES.has(value)) return value;
  if (value === "full") return "prepaid";
  if (hasAgent && (value === "agent_credit" || value === "credit")) {
    return "on_credit";
  }
  return hasAgent ? "on_credit" : "cash";
}

function isDateGateError(message: string): boolean {
  return /manager PIN|business date|past check-in|Night audit/i.test(message);
}

/**
 * Check in every reservation still due through today (Thimphu).
 * Rooms must already be assigned. Passport / SDF / guide are deferred.
 * Past arrival dates and a closed business date need a GM session or manager PIN.
 */
export async function checkInDueThroughToday(
  managerPin: string,
): Promise<DueCheckInResult> {
  const failed: DueCheckInFailure[] = [];
  let checkedIn = 0;
  let skippedUnassigned = 0;

  try {
    if (!(await isDeskAuthenticated())) {
      return {
        ok: false,
        error: "Desk session expired.",
        message: "Desk session expired. Sign in again.",
        checkedIn,
        failed,
        skippedUnassigned,
      };
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const today = thimphuToday();
    const pin = managerPin.trim();

    const { data: rows, error: loadError } = await admin
      .from("bookings")
      .select(
        `id, status, contact_name, check_in, check_out, payment_mode, agent_id,
         guide_number, room_assignments(room_unit_id)`,
      )
      .eq("property_id", propertyId)
      .lte("check_in", today)
      .or(dueStayOpenOr(today))
      .in("status", [...DUE_CHECK_IN_STATUSES])
      .order("check_in", { ascending: true })
      .limit(200);

    if (loadError) {
      throw new Error(loadError.message || "Could not load due reservations.");
    }

    const due = (rows ?? []).filter((row) =>
      isDueToCheckIn({
        checkIn: row.check_in as string,
        checkOut: row.check_out as string,
        status: row.status as string,
        today,
      }),
    );

    const checkedIds: string[] = [];

    for (const row of due) {
      const bookingId = row.id as string;
      const name = (row.contact_name as string | null)?.trim() || "Guest";
      const assigns =
        (row.room_assignments as Array<{ room_unit_id?: string | null }> | null) ??
        [];
      const unitIds = assigns
        .map((a) => a.room_unit_id)
        .filter((id): id is string => Boolean(id));

      if (unitIds.length === 0) {
        skippedUnassigned += 1;
        failed.push({
          bookingId,
          name,
          error: "Assign a room number first",
        });
        continue;
      }

      const fd = new FormData();
      fd.set("booking_id", bookingId);
      fd.set(
        "payment_mode",
        paymentModeFor(
          row.payment_mode as string | null,
          Boolean(row.agent_id),
        ),
      );
      fd.set("guide_number", (row.guide_number as string) || "");
      fd.set("docs_deferred", "on");
      fd.set("guest_name", name);
      fd.set("guest_passport_or_cid", "DEFERRED");
      fd.set("guest_sdf_ref", "");
      fd.set("nationality", "Deferred");
      fd.set("past_check_in_ack", "on");
      fd.set("business_date_override", "on");
      if (pin) fd.set("manager_pin", pin);
      for (const uid of unitIds) fd.append("room_unit_id", uid);

      const result: CheckInState = await confirmCheckIn({ ok: false }, fd);
      if (result.ok) {
        checkedIn += 1;
        checkedIds.push(bookingId);
        continue;
      }

      const error = result.error ?? "Check-in failed";
      failed.push({ bookingId, name, error });
      if (isDateGateError(error)) break;
    }

    if (checkedIn > 0) {
      await writeAuditEvent(admin, {
        propertyId,
        action: "reservations.due.bulk_check_in",
        entityType: "bookings",
        entityId: propertyId,
        summary: `Checked in ${checkedIn} reservation(s) due through ${today}`,
        meta: {
          today,
          checkedIn: checkedIds,
          skippedUnassigned,
          failed: failed.map((f) => ({
            bookingId: f.bookingId,
            error: f.error,
          })),
        },
      });
    }

    revalidatePath("/erp");
    revalidatePath("/erp/stayview");
    revalidatePath("/erp/today");
    revalidatePath("/erp/arrivals");
    revalidatePath("/erp/in-house");
    revalidatePath("/erp/reservations");
    revalidatePath("/erp/calendar");

    const gate = failed.find((f) => isDateGateError(f.error));
    const attention = failed.length;
    const ok = checkedIn > 0 && !gate;
    const message = gate
      ? `${gate.error} Checked in ${checkedIn} before stopping.`
      : checkedIn > 0
        ? `Checked in ${checkedIn} reservation(s) due through ${today}${
            attention ? ` · ${attention} need attention` : ""
          }.`
        : failed[0]?.error ?? "No reservations checked in.";

    return {
      ok,
      checkedIn,
      failed,
      skippedUnassigned,
      message,
      error: ok ? undefined : message,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Check-in failed.";
    return {
      ok: false,
      checkedIn,
      failed,
      skippedUnassigned,
      message,
      error: message,
    };
  }
}
