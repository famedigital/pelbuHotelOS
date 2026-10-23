"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { ensureFolioEditSession } from "@/lib/folio/edit-session";
import { postRoomNightsForBooking } from "@/lib/folio/room-night";
import { voidFolioLineWithReversal } from "@/lib/folio/void-line";
import { offerNightlyAmount, listStayRateOffers, type RateOffer } from "@/lib/rates/rate-offers";
import { resolveSeasonKind } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type StayRateState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Copy a central-book row onto the stay and re-post open room nights. */
export async function applyStayRate(
  _prev: StayRateState,
  formData: FormData,
): Promise<StayRateState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const rateId = trimRequired(formData.get("room_rate_id"), "Rate");
    const session = await ensureFolioEditSession({
      admin,
      propertyId,
      pin: optionalTrim(formData.get("manager_pin")),
    });
    if (!session.ok) return { ok: false, error: session.error };

    const { data: booking, error: loadErr } = await admin
      .from("bookings")
      .select("id, contact_name, status, adults, room_rate_id, agreed_nightly_rate_btn")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (loadErr || !booking) {
      return { ok: false, error: loadErr?.message ?? "Booking not found." };
    }

    const { data: rate, error: rateErr } = await admin
      .from("room_rates")
      .select(
        "id, room_type_id, label, amount_btn, amount_single_btn, active, property_id",
      )
      .eq("id", rateId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (rateErr || !rate || rate.active === false) {
      return { ok: false, error: rateErr?.message ?? "That rate is not in the book." };
    }

    const amount = offerNightlyAmount(
      {
        amount_btn: Number(rate.amount_btn),
        amount_single_btn:
          rate.amount_single_btn == null ? null : Number(rate.amount_single_btn),
      },
      Number(booking.adults ?? 2),
    );
    if (amount == null) return { ok: false, error: "That rate has no amount." };

    const { error: upErr } = await admin
      .from("bookings")
      .update({
        room_rate_id: rate.id,
        agreed_nightly_rate_btn: amount,
        agreed_rate_reason: `Rate book · ${rate.label as string}`,
        agreed_rate_set_at: new Date().toISOString(),
        agreed_rate_set_by: session.actor,
      })
      .eq("id", bookingId)
      .eq("property_id", propertyId);
    if (upErr) return { ok: false, error: upErr.message };

    await admin
      .from("booking_rooms")
      .update({ room_rate_id: rate.id, agreed_nightly_rate_btn: amount })
      .eq("booking_id", bookingId)
      .eq("room_type_id", rate.room_type_id as string);

    let adjusted = 0;
    if (booking.status === "checked_in") {
      const { data: folios } = await admin
        .from("folios")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("property_id", propertyId)
        .eq("status", "open");
      for (const folio of folios ?? []) {
        const { data: lines } = await admin
          .from("folio_lines")
          .select("id, business_date")
          .eq("folio_id", folio.id)
          .eq("source_type", "room")
          .eq("status", "posted");
        for (const line of lines ?? []) {
          try {
            await voidFolioLineWithReversal(admin, propertyId, {
              lineId: line.id as string,
              reason: `Rate book ${rate.label as string} Nu ${amount}`,
              voidedBy: session.actor,
            });
            const biz = (line.business_date as string | null) ?? null;
            if (biz) {
              await postRoomNightsForBooking(admin, propertyId, bookingId, biz);
            }
            adjusted += 1;
          } catch {
            // Count only the lines that reposted.
          }
        }
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "booking.rate_book.apply",
      entityType: "bookings",
      entityId: bookingId,
      actor: session.actor,
      summary: `Drew ${rate.label as string} Nu ${amount} for ${booking.contact_name ?? bookingId}`,
      meta: {
        room_rate_id: rate.id,
        previous_room_rate_id: booking.room_rate_id,
        agreed_nightly_rate_btn: amount,
        room_lines_adjusted: adjusted,
      },
    });

    revalidatePath("/erp/reservations");
    revalidatePath("/erp/in-house");
    revalidatePath("/erp/rates");

    return {
      ok: true,
      message:
        adjusted > 0
          ? `${rate.label as string} Nu ${amount}/night. Re-posted ${adjusted} room line(s).`
          : `${rate.label as string} Nu ${amount}/night. Later room posts use this rate.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not draw that rate.",
    };
  }
}

export async function loadStayRateOffers(
  bookingId: string,
): Promise<{ ok: true; offers: RateOffer[] } | { ok: false; error: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const { data: booking, error } = await admin
      .from("bookings")
      .select("id, check_in, agent_id, contact_name")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error || !booking) {
      return { ok: false, error: error?.message ?? "Booking not found." };
    }
    const { data: line } = await admin
      .from("booking_rooms")
      .select("room_type_id")
      .eq("booking_id", bookingId)
      .limit(1)
      .maybeSingle();
    const roomTypeId = (line?.room_type_id as string | null) ?? null;
    const seasonKind = await resolveSeasonKind(
      admin,
      propertyId,
      String(booking.check_in).slice(0, 10),
    );
    const offers = await listStayRateOffers(admin, {
      propertyId,
      roomTypeId,
      seasonKind,
      agentId: (booking.agent_id as string | null) ?? null,
      guestName: (booking.contact_name as string | null) ?? null,
    });
    return { ok: true, offers };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load rates.",
    };
  }
}
