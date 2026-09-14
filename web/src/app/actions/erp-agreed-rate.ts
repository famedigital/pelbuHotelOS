"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { postRoomNightsForBooking } from "@/lib/folio/room-night";
import { voidFolioLineWithReversal } from "@/lib/folio/void-line";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type AgreedRateState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/**
 * Manager-PIN approved special nightly room rate for regulars / negotiated stays.
 * Night audit and day-1 posts use this amount (rate-sheet tax basis) instead of looking up room_rates.
 */
export async function setAgreedNightlyRate(
  _prev: AgreedRateState,
  formData: FormData,
): Promise<AgreedRateState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const pin = trimRequired(formData.get("manager_pin"), "Manager PIN");
    const clear = formData.get("clear") === "1";
    const reason = optionalTrim(formData.get("reason"));
    const adjustPosted = formData.get("adjust_posted") !== "0";

    const verified = await verifyManagerPinForProperty(admin, propertyId, pin);
    if (!verified.ok) {
      return { ok: false, error: verified.error };
    }

    const { data: booking, error: loadErr } = await admin
      .from("bookings")
      .select(
        "id, contact_name, status, check_in, check_out, meal_plan_code, agreed_nightly_rate_btn",
      )
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (loadErr || !booking) {
      return { ok: false, error: loadErr?.message ?? "Booking not found." };
    }

    let agreed: number | null = null;
    if (!clear) {
      const raw = String(formData.get("agreed_nightly_rate_btn") ?? "").trim();
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Enter a valid nightly rate (BTN ≥ 0)." };
      }
      if (n > 500_000) {
        return { ok: false, error: "Amount looks too high — check the figure." };
      }
      agreed = Math.round(n * 100) / 100;
      if (!reason || reason.length < 3) {
        return {
          ok: false,
          error: "Reason required (e.g. regular client — manager approved).",
        };
      }
    }

    const approvedBy =
      verified.source === "staff"
        ? `staff:${verified.staffId}:${verified.fullName}`
        : "env_manager_pin";

    const patch: Record<string, unknown> = {
      agreed_nightly_rate_btn: agreed,
      agreed_rate_reason: clear ? null : reason,
      agreed_rate_set_at: new Date().toISOString(),
      agreed_rate_set_by: approvedBy,
    };

    // Regulars on EP often imply European Plan meal code.
    if (!clear && formData.get("set_ep") === "1") {
      patch.meal_plan_code = "EP";
      patch.meal_plan_amount_btn = 0;
    }

    const { error: upErr } = await admin
      .from("bookings")
      .update(patch)
      .eq("id", bookingId)
      .eq("property_id", propertyId);
    if (upErr) return { ok: false, error: upErr.message };

    let adjusted = 0;
    if (adjustPosted && booking.status === "checked_in") {
      const { data: folios } = await admin
        .from("folios")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("property_id", propertyId)
        .eq("status", "open");

      for (const f of folios ?? []) {
        const { data: lines } = await admin
          .from("folio_lines")
          .select("id, business_date, description, total_btn")
          .eq("folio_id", f.id)
          .eq("source_type", "room")
          .eq("status", "posted");

        for (const line of lines ?? []) {
          try {
            await voidFolioLineWithReversal(admin, propertyId, {
              lineId: line.id as string,
              reason: clear
                ? "Clear agreed rate — re-post from rate sheet"
                : `Agreed rate Nu ${agreed} — re-post room night`,
              voidedBy: approvedBy,
            });
            const biz = (line.business_date as string | null) ?? null;
            if (biz && !clear) {
              await postRoomNightsForBooking(
                admin,
                propertyId,
                bookingId,
                biz,
              );
            } else if (biz && clear) {
              await postRoomNightsForBooking(
                admin,
                propertyId,
                bookingId,
                biz,
              );
            }
            adjusted += 1;
          } catch {
            // Keep going; surface count in message
          }
        }
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: clear
        ? "booking.agreed_rate.clear"
        : "booking.agreed_rate.set",
      entityType: "bookings",
      entityId: bookingId,
      summary: clear
        ? `Cleared agreed nightly rate for ${booking.contact_name ?? bookingId}`
        : `Agreed rate Nu ${agreed}/night · ${booking.contact_name ?? bookingId}${reason ? ` · ${reason}` : ""}`,
      meta: {
        agreed_nightly_rate_btn: agreed,
        previous: booking.agreed_nightly_rate_btn,
        reason: reason ?? null,
        approved_by: approvedBy,
        room_lines_adjusted: adjusted,
      },
    });

    revalidatePath("/erp/reservations");
    revalidatePath("/erp/calendar");
    revalidatePath("/erp/in-house");
    revalidatePath("/erp/folios");
    revalidatePath(`/erp/bookings/${bookingId}`);

    if (clear) {
      return {
        ok: true,
        message:
          adjusted > 0
            ? `Agreed rate cleared. Re-posted ${adjusted} room-night line(s) from rate sheet.`
            : "Agreed rate cleared. Future night posts use the rate sheet.",
      };
    }

    return {
      ok: true,
      message:
        adjusted > 0
          ? `Agreed Nu ${agreed}/night · EP/special. Re-posted ${adjusted} room-night line(s).`
          : `Agreed Nu ${agreed}/night set. Future night posts use this rate.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not set agreed rate.",
    };
  }
}
