"use server";

import { requireAgentSession } from "@/lib/agent-auth";
import { holdExpiresAtFromNow, resolveHoldTtlHours } from "@/lib/holds";
import { soldQtyByRoomType } from "@/lib/inventory-availability";
import { roundBtn } from "@/lib/pricing";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  pelbuPropertyId,
  resolveSeasonKind,
} from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertStayDates,
  optionalTrim,
  parsePositiveInt,
  trimRequired,
} from "@/lib/validation";

export type AgentRoomOption = {
  roomTypeId: string;
  code: string;
  name: string;
  remaining: number;
  perNightBtn: number | null;
  totalBtn: number | null;
  available: boolean;
};

export type AgentStayPreview = {
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  rateTier: string;
  options: AgentRoomOption[];
};

export async function previewAgentStay(input: {
  checkIn: string;
  checkOut: string;
  rooms: number;
}): Promise<
  { ok: true; preview: AgentStayPreview } | { ok: false; error: string }
> {
  try {
    const session = await requireAgentSession();
    const { checkIn, checkOut } = input;
    const rooms = Math.max(1, Math.min(10, Math.floor(input.rooms)));
    assertStayDates(checkIn, checkOut);

    const admin = createSupabaseAdminClient();
    const propertyId = await pelbuPropertyId(admin);
    const season = await resolveSeasonKind(admin, propertyId, checkIn);
    const nights = nightsBetween(checkIn, checkOut);
    const tier = agentRateTier(session.rateTier);

    const { data: roomTypes } = await admin
      .from("room_types")
      .select("id, code, name, unit_count")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code");

    const sold = await soldQtyByRoomType(admin, propertyId, checkIn, checkOut);

    const options: AgentRoomOption[] = [];
    for (const rt of roomTypes ?? []) {
      const roomTypeId = rt.id as string;
      const capacity = Number(rt.unit_count ?? 0);
      const remaining = Math.max(0, capacity - (sold.get(roomTypeId) ?? 0));
      const rate = await lookupRoomRateBtn(admin, {
        propertyId,
        roomTypeId,
        seasonKind: season,
        rateTier: tier,
      });
      options.push({
        roomTypeId,
        code: rt.code as string,
        name: (rt.name as string) || (rt.code as string),
        remaining,
        perNightBtn: rate,
        totalBtn: rate == null ? null : roundBtn(rate * nights * rooms),
        available: remaining >= rooms,
      });
    }

    return {
      ok: true,
      preview: {
        checkIn,
        checkOut,
        nights,
        rooms,
        rateTier: tier,
        options,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not preview rates.",
    };
  }
}

export type AgentBookingState = {
  ok: boolean;
  bookingId?: string;
  holdExpiresAt?: string;
  error?: string;
};

export async function createAgentBooking(
  _prev: AgentBookingState,
  formData: FormData,
): Promise<AgentBookingState> {
  try {
    const session = await requireAgentSession();

    const checkIn = trimRequired(formData.get("check_in"), "Check-in");
    const checkOut = trimRequired(formData.get("check_out"), "Check-out");
    assertStayDates(checkIn, checkOut);

    const rooms = parsePositiveInt(formData.get("rooms"), "Rooms", 10);
    const guideNumber = optionalTrim(formData.get("guide_number"));
    const notes = optionalTrim(formData.get("notes"));
    const requestedRoomTypeCode = trimRequired(
      formData.get("room_type_code"),
      "Room type",
    );

    const admin = createSupabaseAdminClient();
    const propertyId = await pelbuPropertyId(admin);
    const season = await resolveSeasonKind(admin, propertyId, checkIn);
    const nights = nightsBetween(checkIn, checkOut);
    const tier = agentRateTier(session.rateTier);

    const { data: roomTypes } = await admin
      .from("room_types")
      .select("id, code, unit_count")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest");

    const match = (roomTypes ?? []).find(
      (rt) => (rt.code as string) === requestedRoomTypeCode,
    );
    if (!match) throw new Error("Pick a valid room type.");

    const sold = await soldQtyByRoomType(admin, propertyId, checkIn, checkOut);
    const capacity = Number(match.unit_count ?? 0);
    const remaining = Math.max(0, capacity - (sold.get(match.id as string) ?? 0));
    if (remaining < rooms) {
      throw new Error(
        "That room type is fully booked for those dates. Try another type or dates.",
      );
    }

    const rate = await lookupRoomRateBtn(admin, {
      propertyId,
      roomTypeId: match.id as string,
      seasonKind: season,
      rateTier: tier,
    });
    const quotedTotalBtn = rate == null ? null : roundBtn(rate * nights * rooms);

    const { hours } = await resolveHoldTtlHours(
      admin,
      propertyId,
      "agent",
      checkIn,
    );
    const holdExpiresAt = holdExpiresAtFromNow(hours);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: propertyId,
        agent_id: session.agentId,
        source: "agent",
        status: "held",
        check_in: checkIn,
        check_out: checkOut,
        contact_name: session.companyName,
        adults: rooms,
        rooms,
        guide_number: guideNumber,
        notes,
        hold_expires_at: holdExpiresAt,
        // Agent credit is settled by the desk on confirmation, not here.
        payment_mode: "on_credit",
        quoted_total_btn: quotedTotalBtn,
        meal_plan_code: "EP",
        meal_plan_amount_btn: 0,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("createAgentBooking insert failed", bookingError);
      throw new Error("Could not save the booking. Please try again.");
    }

    const { error: linesError } = await admin.from("booking_rooms").insert({
      booking_id: booking.id,
      room_type_id: match.id as string,
      qty: rooms,
      inventory_kind: "sellable_guest",
    });
    if (linesError) {
      console.error("createAgentBooking rooms failed", linesError);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not hold rooms. Please try again.");
    }

    return { ok: true, bookingId: booking.id as string, holdExpiresAt };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not book.",
    };
  }
}
