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
import { applyDiscountPct } from "@/lib/partners/discount";
import { redeemPromoCode } from "@/lib/marketing/promo";
import { stayLevelPromoDiscountPct } from "@/lib/marketing/promo-math";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";
import {
  loadExtraBedPolicy,
  MAX_CHILDREN,
  MAX_EXTRA_BEDS,
  resolveStayAddonsForBook,
} from "@/lib/meal-plans";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import {
  lookupRoomRateBtn,
  lookupRoomRatesBatch,
  nightsBetween,
  resolveSeasonKind,
  type SeasonKind,
} from "@/lib/rates";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOptionalEmail,
  assertPhone,
  assertStayDates,
  optionalTrim,
  parseNonNegInt,
  parsePositiveInt,
  trimRequired,
} from "@/lib/validation";
import { headers } from "next/headers";
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
  /** Guest-facing all-in room Nu / night (includes GST+SC when exclusive rates add them). */
  perNightBtn: number | null;
  totalBtn: number | null;
  available: boolean;
};

/** Active meal plan shown for selection. */
export type MealPlanOption = {
  code: string;
  name: string;
  blurb: string | null;
  /** Nu per adult per night; null = label-only on quote. */
  amountPerAdultNight: number | null;
  /** Nu per child per night; null = free for children when adult priced. */
  amountPerChildNight: number | null;
  priced: boolean;
};

export type ExtraBedOption = {
  sellable: boolean;
  ratePerNight: number | null;
  maxQty: number;
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
  /** When true, sheet rates are all-in; when false, quote shows exclusive + GST/SC. */
  ratesInclusiveOfGstSc: boolean;
  options: RoomOption[];
  mealPlans: MealPlanOption[];
  extraBed: ExtraBedOption;
};

/** Plain-object input for preview — kept loose so it can be called from client state without FormData. */
export type StayPreviewInput = {
  checkIn: string;
  checkOut: string;
  rooms: number;
  /** Adults for occupancy: 1 uses amount_single_btn when set on the rate sheet. */
  adults?: number;
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
    const adults = Math.max(
      1,
      Math.min(12, Math.floor(Number(input.adults ?? 2)) || 2),
    );
    assertStayDates(checkIn, checkOut);

    const admin = createSupabaseAdminClient();
    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", DEFAULT_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      return { ok: false, error: "Hotel property is not configured." };
    }

    const propertyId = property.id as string;
    const season = await resolveSeasonKind(admin, propertyId, checkIn);
    const nights = nightsBetween(checkIn, checkOut);
    const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);

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

    const rateByType = await lookupRoomRatesBatch(admin, {
      propertyId,
      roomTypeIds: (roomTypes ?? []).map((rt) => rt.id as string),
      seasonKind: season,
      rateTier: "public",
      adults,
    });

    const options: RoomOption[] = [];
    for (const rt of roomTypes ?? []) {
      const roomTypeId = rt.id as string;
      const capacity = Number(rt.unit_count ?? 0);
      const remaining = remainingByTypeId.get(roomTypeId) ?? 0;
      const rate = rateByType.get(roomTypeId) ?? null;
      const perNight =
        rate == null
          ? null
          : calculateRoomNightTax(rate, taxSettings).totalBtn;
      options.push({
        roomTypeId,
        code: rt.code as string,
        name: (rt.name as string) || (rt.code as string),
        capacity,
        remaining,
        perNightBtn: perNight,
        totalBtn:
          perNight == null ? null : roundBtn(perNight * nights * rooms),
        available: remaining >= rooms,
      });
    }

    const { data: mealPlanRows } = await admin
      .from("meal_plans")
      .select(
        "code, name, blurb, amount_btn_per_adult_night, amount_btn_per_child_night",
      )
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order");

    const mealPlans: MealPlanOption[] = (mealPlanRows ?? []).map((row) => ({
      code: row.code as string,
      name: row.name as string,
      blurb: (row.blurb as string | null) ?? null,
      amountPerAdultNight:
        row.amount_btn_per_adult_night == null
          ? null
          : Number(row.amount_btn_per_adult_night),
      amountPerChildNight:
        row.amount_btn_per_child_night == null
          ? null
          : Number(row.amount_btn_per_child_night),
      priced: row.amount_btn_per_adult_night != null,
    }));

    const extraPolicy = await loadExtraBedPolicy(admin, propertyId);

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
        ratesInclusiveOfGstSc: Boolean(taxSettings.inclusiveOfGstSc),
        options,
        mealPlans,
        extraBed: {
          sellable: extraPolicy.sellable,
          ratePerNight: extraPolicy.ratePerNight,
          maxQty: MAX_EXTRA_BEDS,
        },
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
    const h = await headers();
    const ip = clientIp(h);
    const rl = await rateLimit(`book:${ip}`, { limit: 30, windowMs: 60 * 60_000 });
    if (!rl.ok) {
      return { ok: false, error: "Too many booking attempts. Please try again later." };
    }

    const contactName = trimRequired(formData.get("contact_name"), "Full name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const checkIn = trimRequired(formData.get("check_in"), "Check-in");
    const checkOut = trimRequired(formData.get("check_out"), "Check-out");
    assertStayDates(checkIn, checkOut);

    const adults = parsePositiveInt(formData.get("adults"), "Adults", 12);
    const children = parseNonNegInt(
      formData.get("children"),
      "Children",
      MAX_CHILDREN,
    );
    const extraBedsRequested = parseNonNegInt(
      formData.get("extra_beds"),
      "Extra beds",
      MAX_EXTRA_BEDS,
    );
    const rooms = parsePositiveInt(formData.get("rooms"), "Rooms", 6);
    const guideNumber = optionalTrim(formData.get("guide_number"));
    const notes = optionalTrim(formData.get("notes"));
    // Optional: guest-picked room type from the wizard step 2. If absent or
    // unavailable, the action falls back to first-available auto-assignment
    // so the legacy single-form path still works.
    const requestedRoomTypeCode = optionalTrim(formData.get("room_type_code"));
    const requestedMealPlanCode =
      optionalTrim(formData.get("meal_plan_code")) ?? "EP";
    // so the quoted total survives later rate changes.
    const quotedTotalRaw = formData.get("quoted_total_btn");
    let quotedTotalBtn =
      typeof quotedTotalRaw === "string" && quotedTotalRaw.trim()
        ? Number(quotedTotalRaw)
        : null;

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", DEFAULT_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured. Please call the desk.");
    }

    const propertyId = property.id as string;

    const stayNights = nightsBetween(checkIn, checkOut);
    const addons = await resolveStayAddonsForBook(admin, propertyId, {
      mealPlanCode: requestedMealPlanCode,
      adults,
      children,
      extraBeds: extraBedsRequested,
      nights: stayNights,
    });
    const mealPlanAmountBtn = addons.mealPlanAmountBtn;
    const mealPlanCode = addons.mealPlanCode;
    const extraBeds = addons.extraBeds;
    const extraBedAmountBtn = addons.extraBedAmountBtn;

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

    let resolvedGuideId: string | null = null;
    if (guideNumber) {
      const { data: guide } = await admin
        .from("guides")
        .select("id, discount_pct")
        .eq("property_id", propertyId)
        .eq("guide_number", guideNumber)
        .maybeSingle();
      if (guide) {
        resolvedGuideId = guide.id as string;
        const pct = Number(guide.discount_pct ?? 0);
        if (
          pct > 0 &&
          quotedTotalBtn != null &&
          Number.isFinite(quotedTotalBtn)
        ) {
          quotedTotalBtn = roundBtn(applyDiscountPct(quotedTotalBtn, pct));
        }
      }
    }

    // quoted_total_btn from the wizard already includes room + meal + extra bed (+ guide disc.).
    // Token / deposit uses that figure for percent rules; one_night uses tax-all-in sheet rates.
    const tokenRequired = await computeTokenRequiredBtn(admin, {
      propertyId,
      checkIn,
      roomLines: [{ roomTypeId: assignedTypeId, qty: rooms }],
      adults,
      estimatedStayTotalBtn:
        quotedTotalBtn != null && Number.isFinite(quotedTotalBtn)
          ? quotedTotalBtn
          : undefined,
    });

    const promoCodeRaw = optionalTrim(formData.get("promo_code"));

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
        children,
        extra_beds: extraBeds,
        rooms,
        guide_number: guideNumber,
        guide_id: resolvedGuideId,
        notes,
        hold_expires_at: holdExpiresAt,
        token_required_btn: tokenRequired,
        payment_mode: "partial",
        quoted_total_btn: quotedTotalBtn,
        meal_plan_code: mealPlanCode,
        meal_plan_amount_btn: mealPlanAmountBtn,
        extra_bed_amount_btn: extraBedAmountBtn,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("createBooking insert failed", bookingError);
      throw new Error("Could not save your booking. Please try again.");
    }

    if (promoCodeRaw && quotedTotalBtn != null && quotedTotalBtn > 0) {
      let stackWithPartner = false;
      if (resolvedGuideId) {
        const { data: g } = await admin
          .from("guides")
          .select("discount_pct")
          .eq("id", resolvedGuideId)
          .maybeSingle();
        stackWithPartner = Number(g?.discount_pct ?? 0) > 0;
      }
      const nights = nightsBetween(checkIn, checkOut);
      const redeemed = await redeemPromoCode(admin, {
        propertyId,
        code: promoCodeRaw,
        channel: "public_book",
        domain: "rooms",
        preDiscountBtn: quotedTotalBtn,
        guestKey: contactPhone,
        bookingId: booking.id as string,
        minNights: nights,
        stackPartner: stackWithPartner,
        createdBy: "public_book",
      });
      if (!redeemed.ok) {
        await admin.from("bookings").delete().eq("id", booking.id);
        throw new Error(redeemed.error ?? "Promo code rejected.");
      }
      const promoCodeId = redeemed.promo_code_id ?? null;
      const promoCodeSnapshot = redeemed.code ?? promoCodeRaw.toUpperCase();

      if (
        redeemed.benefit_type === "nightly_rate_btn" &&
        redeemed.benefit_value != null &&
        Number.isFinite(Number(redeemed.benefit_value))
      ) {
        // Personal/manager agreed rate: lock folio room posts + re-quote stay.
        const agreed = Math.round(Number(redeemed.benefit_value) * 100) / 100;
        const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);
        const nightAllIn = calculateRoomNightTax(agreed, taxSettings).totalBtn;
        const roomStay = roundBtn(nightAllIn * nights * rooms);
        quotedTotalBtn = roundBtn(
          roomStay + mealPlanAmountBtn + extraBedAmountBtn,
        );
        await admin
          .from("bookings")
          .update({
            promo_code_id: promoCodeId,
            promo_discount_pct: null,
            promo_discount_btn: 0,
            promo_code_snapshot: promoCodeSnapshot,
            quoted_total_btn: quotedTotalBtn,
            agreed_nightly_rate_btn: agreed,
            agreed_rate_reason: `Promo ${promoCodeSnapshot}`,
            agreed_rate_set_at: new Date().toISOString(),
            agreed_rate_set_by: "public_book_promo",
          })
          .eq("id", booking.id);
      } else {
        const promoDiscountBtn = Number(redeemed.discount_btn ?? 0);
        // Persist stay-level % (pct as-is; fixed_btn amortized) so room-night + meal posts cascade.
        const promoDiscountPct = stayLevelPromoDiscountPct({
          benefitType: redeemed.benefit_type,
          benefitValue: redeemed.benefit_value,
          discountBtn: promoDiscountBtn,
          preDiscountBtn: quotedTotalBtn,
        });
        quotedTotalBtn = roundBtn(
          Number(redeemed.post_discount_btn ?? quotedTotalBtn - promoDiscountBtn),
        );
        await admin
          .from("bookings")
          .update({
            promo_code_id: promoCodeId,
            promo_discount_pct: promoDiscountPct,
            promo_discount_btn: promoDiscountBtn,
            promo_code_snapshot: promoCodeSnapshot,
            quoted_total_btn: quotedTotalBtn,
          })
          .eq("id", booking.id);
      }
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
