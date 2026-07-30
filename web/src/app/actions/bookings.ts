"use server";

import { ensurePaymentLinkForBooking } from "@/app/actions/erp-holds";
import {
  computeTokenRequiredBtn,
  holdExpiresAtFromNow,
  resolveHoldTtlHours,
} from "@/lib/holds";
import { availabilityByRoomType } from "@/lib/inventory-availability";
import { soldQtyByRoomType } from "@/lib/inventory-availability";
import { notifyNewBooking } from "@/lib/notify";
import { roundBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import {
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  type SeasonKind,
} from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOptionalEmail,
  assertPhone,
  assertStayDates,
  optionalTrim,
  parsePositiveInt,
  trimRequired,
} from "@/lib/validation";

export type BookingActionState = {
  ok: boolean;
  bookingId?: string;
  paymentUrl?: string;
  tokenAmount?: number;
  holdExpiresAt?: string;
  error?: string;
};

/** A room type with its live availability and public-tier rate for a stay window. */
export type RoomOption = {
  roomTypeId: string;
  code: string;
  name: string;
  capacity: number;
  remaining: number;
  perNightBtn: number | null;
  totalBtn: number | null;
  available: boolean;
};

/** Active meal plan shown for selection. Amounts are never added to token/quote in P0. */
export type MealPlanOption = {
  code: string;
  name: string;
  blurb: string | null;
  /** Presentational only until desk prices are confirmed into money paths. */
  priced: boolean;
};

/** Result of a read-only rate/availability preview (no DB writes). */
export type StayPreview = {
  ok: true;
  checkIn: string;
  checkOut: string;
  nights: number;
  season: SeasonKind;
  currency: "BTN";
  rooms: number;
  options: RoomOption[];
  mealPlans: MealPlanOption[];
};

/** Plain-object input for preview — kept loose so it can be called from client state without FormData. */
export type StayPreviewInput = {
  checkIn: string;
  checkOut: string;
  rooms: number;
};

/**
 * Read-only preview of public-tier rates and availability for a stay window.
 * Used by the public /book wizard to show live prices before the guest submits.
 * Never writes to the DB.
 */
export async function previewStayCost(
  input: StayPreviewInput,
): Promise<{ ok: true; preview: StayPreview } | { ok: false; error: string }> {
  try {
    const { checkIn, checkOut } = input;
    const rooms = Math.max(1, Math.min(6, Math.floor(input.rooms)));
    assertStayDates(checkIn, checkOut);

    const admin = createSupabaseAdminClient();
    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      return { ok: false, error: "Hotel property is not configured." };
    }

    const propertyId = property.id as string;
    const season = await resolveSeasonKind(admin, propertyId, checkIn);
    const nights = nightsBetween(checkIn, checkOut);

    const { data: roomTypes } = await admin
      .from("room_types")
      .select("id, code, name, unit_count")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code");

    const availability = await availabilityByRoomType(
      admin,
      propertyId,
      checkIn,
      checkOut,
    );
    const remainingByTypeId = new Map(
      availability.map((a) => [a.roomTypeId, a.remaining]),
    );

    const options: RoomOption[] = [];
    for (const rt of roomTypes ?? []) {
      const roomTypeId = rt.id as string;
      const capacity = Number(rt.unit_count ?? 0);
      const remaining = remainingByTypeId.get(roomTypeId) ?? 0;
      const rate = await lookupRoomRateBtn(admin, {
        propertyId,
        roomTypeId,
        seasonKind: season,
        rateTier: "public",
      });
      options.push({
        roomTypeId,
        code: rt.code as string,
        name: (rt.name as string) || (rt.code as string),
        capacity,
        remaining,
        perNightBtn: rate,
        totalBtn: rate == null ? null : roundBtn(rate * nights * rooms),
        available: remaining >= rooms,
      });
    }

    const { data: mealPlanRows } = await admin
      .from("meal_plans")
      .select("code, name, blurb, amount_btn_per_adult_night")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order");

    const mealPlans: MealPlanOption[] = (mealPlanRows ?? []).map((row) => ({
      code: row.code as string,
      name: row.name as string,
      blurb: (row.blurb as string | null) ?? null,
      // P0: never treat meal-plan amounts as bookable money.
      priced: false,
    }));

    return {
      ok: true,
      preview: {
        ok: true,
        checkIn,
        checkOut,
        nights,
        season,
        currency: "BTN",
        rooms,
        options,
        mealPlans,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not preview rates.";
    return { ok: false, error: message };
  }
}

export async function createBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  try {
    const contactName = trimRequired(formData.get("contact_name"), "Full name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const checkIn = trimRequired(formData.get("check_in"), "Check-in");
    const checkOut = trimRequired(formData.get("check_out"), "Check-out");
    assertStayDates(checkIn, checkOut);

    const adults = parsePositiveInt(formData.get("adults"), "Adults", 12);
    const rooms = parsePositiveInt(formData.get("rooms"), "Rooms", 6);
    const guideNumber = optionalTrim(formData.get("guide_number"));
    const notes = optionalTrim(formData.get("notes"));
    // Optional: guest-picked room type from the wizard step 2. If absent or
    // unavailable, the action falls back to first-available auto-assignment
    // so the legacy single-form path still works.
    const requestedRoomTypeCode = optionalTrim(formData.get("room_type_code"));
    // Meal plan is preference metadata in P0 — never folded into token or
    // quoted_total_btn until desk-priced meal math ships.
    const requestedMealPlanCode =
      optionalTrim(formData.get("meal_plan_code")) ?? "EP";
    // Optional: snapshot of the price the guest saw in the wizard preview,
    // so the quoted total survives later rate changes.
    const quotedTotalRaw = formData.get("quoted_total_btn");
    const quotedTotalBtn =
      typeof quotedTotalRaw === "string" && quotedTotalRaw.trim()
        ? Number(quotedTotalRaw)
        : null;

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured. Please call the desk.");
    }

    const propertyId = property.id as string;

    const { data: mealPlan } = await admin
      .from("meal_plans")
      .select("code")
      .eq("property_id", propertyId)
      .eq("code", requestedMealPlanCode)
      .eq("is_active", true)
      .maybeSingle();
    const mealPlanCode = (mealPlan?.code as string | undefined) ?? "EP";

    const { data: roomTypes } = await admin
      .from("room_types")
      .select("id, code, unit_count")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code");

    if (!roomTypes?.length) {
      throw new Error("No rooms configured. Please call the desk.");
    }

    const sold = await soldQtyByRoomType(admin, propertyId, checkIn, checkOut);

    // If the guest picked a specific room type, honour it when there is room.
    // Otherwise fall back to first-available (legacy behaviour).
    let assignedTypeId: string | null = null;
    if (requestedRoomTypeCode) {
      const match = roomTypes.find(
        (rt) => (rt.code as string) === requestedRoomTypeCode,
      );
      if (match) {
        const capacity = Number(match.unit_count ?? 0);
        const used = sold.get(match.id as string) ?? 0;
        if (capacity - used >= rooms) {
          assignedTypeId = match.id as string;
        } else {
          throw new Error(
            "The room type you picked is fully booked for those dates. Please pick another type or change dates.",
          );
        }
      }
    }
    if (!assignedTypeId) {
      for (const rt of roomTypes) {
        const capacity = Number(rt.unit_count ?? 0);
        const used = sold.get(rt.id as string) ?? 0;
        if (capacity - used >= rooms) {
          assignedTypeId = rt.id as string;
          break;
        }
      }
    }
    if (!assignedTypeId) {
      throw new Error(
        "Not enough rooms free for those dates. Try fewer rooms or different dates, or call the desk.",
      );
    }

    const { hours } = await resolveHoldTtlHours(
      admin,
      propertyId,
      "client",
      checkIn,
    );
    const holdExpiresAt = holdExpiresAtFromNow(hours);
    const tokenRequired = await computeTokenRequiredBtn(admin, {
      propertyId,
      checkIn,
      roomLines: [{ roomTypeId: assignedTypeId, qty: rooms }],
    });

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: propertyId,
        source: "client",
        status: "held",
        check_in: checkIn,
        check_out: checkOut,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        adults,
        rooms,
        guide_number: guideNumber,
        notes,
        hold_expires_at: holdExpiresAt,
        token_required_btn: tokenRequired,
        payment_mode: "partial",
        quoted_total_btn: quotedTotalBtn,
        meal_plan_code: mealPlanCode,
        meal_plan_amount_btn: 0,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("createBooking insert failed", bookingError);
      throw new Error("Could not save your booking. Please try again.");
    }

    const { error: linesError } = await admin.from("booking_rooms").insert({
      booking_id: booking.id,
      room_type_id: assignedTypeId,
      qty: rooms,
      inventory_kind: "sellable_guest",
    });

    if (linesError) {
      console.error("createBooking rooms failed", linesError);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not hold rooms. Please try again.");
    }

    const { error: guestError } = await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: contactName,
    });

    if (guestError) {
      console.error("createBooking guest insert failed", guestError);
    }

    const link = await ensurePaymentLinkForBooking(
      booking.id as string,
      propertyId,
    );

    await notifyNewBooking({
      bookingId: booking.id,
      contactName,
      contactPhone,
      contactEmail,
      checkIn,
      checkOut,
      adults,
      rooms,
      guideNumber,
      notes: notes
        ? `[HOLD token Nu ${tokenRequired}] ${notes}`
        : `[HOLD token Nu ${tokenRequired}]`,
    });

    const paymentUrl = link ? `/pay/${link.token}` : undefined;

    return {
      ok: true,
      bookingId: booking.id,
      paymentUrl,
      tokenAmount: tokenRequired,
      holdExpiresAt,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
