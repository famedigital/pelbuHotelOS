"use server";

import { chargeAgentCredit } from "@/app/actions/erp-agents";
import {
  isBookableAgentStatus,
  isCreditAgentStatus,
} from "@/lib/agents/status";
import { enqueueAfterBookingChange } from "@/lib/channel/ari-queue";
import { soldQtyByRoomType } from "@/lib/inventory-availability";
import {
  MAX_CHILDREN,
  MAX_EXTRA_BEDS,
  resolveStayAddonsForBook,
} from "@/lib/meal-plans";
import { redeemPromoCode } from "@/lib/marketing/promo";
import { stayLevelPromoDiscountPct } from "@/lib/marketing/promo-math";
import { notifyNewBooking } from "@/lib/notify";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { writeAuditEvent } from "@/lib/audit";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  buildSalesClaimInsert,
  resolveSoldByStaffId,
} from "@/lib/sales-claims";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
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
import { revalidatePath } from "next/cache";

export type FastBookState = {
  ok: boolean;
  bookingId?: string;
  error?: string;
};

const SOURCES = new Set(["owner", "reservation", "agent", "mou_agent"]);
const PAYMENT_MODES = new Set(["prepaid", "partial", "on_credit", "cash"]);
const GUEST_ORIGINS = new Set([
  "international",
  "regional",
  "official",
  "local",
]);

type RoomTypeRow = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
  unit_count: number;
};

function rateTierFromSource(source: string): RateTier {
  if (source === "mou_agent") return agentRateTier("mou_agents");
  if (source === "agent") return agentRateTier("agents");
  return agentRateTier("public");
}

/** Desk ultra-fast book: dates → rooms → pax → agent → guide → beds → save. */
export async function createFastBooking(
  _prev: FastBookState,
  formData: FormData,
): Promise<FastBookState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }

    const source = trimRequired(formData.get("source"), "Booked by");
    if (!SOURCES.has(source)) {
      throw new Error("Invalid booked-by role.");
    }

    const contactName = trimRequired(formData.get("contact_name"), "Guest name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);

    const checkIn = trimRequired(formData.get("check_in"), "Check-in");
    const checkOut = trimRequired(formData.get("check_out"), "Check-out");
    assertStayDates(checkIn, checkOut);

    const adults = parsePositiveInt(formData.get("adults"), "Adults", 24);
    const children = parseNonNegInt(
      formData.get("children"),
      "Children",
      MAX_CHILDREN,
    );
    const extraBedsRaw = parseNonNegInt(
      formData.get("extra_beds"),
      "Extra beds",
      MAX_EXTRA_BEDS,
    );
    const guideNumber = optionalTrim(formData.get("guide_number"));
    const notes = optionalTrim(formData.get("notes"));
    const agentId = optionalTrim(formData.get("agent_id"));

    const guestOriginRaw = optionalTrim(formData.get("guest_origin"));
    const guestOrigin = guestOriginRaw && GUEST_ORIGINS.has(guestOriginRaw)
      ? guestOriginRaw
      : "international";

    const paymentModeRaw = optionalTrim(formData.get("payment_mode"));
    const paymentMode =
      paymentModeRaw && PAYMENT_MODES.has(paymentModeRaw)
        ? paymentModeRaw
        : "cash";

    if ((source === "agent" || source === "mou_agent") && !agentId) {
      throw new Error("Select an approved agent for agent bookings.");
    }

    // Guide is required for international tourists (full-package rule).
    // Regional / official / local guests may legitimately have no guide.
    if (guestOrigin === "international" && !guideNumber) {
      throw new Error(
        "Guide number is required for international tourists. If this guest has no guide, change the origin to regional / official / local.",
      );
    }

    if (paymentMode === "on_credit" && !agentId) {
      throw new Error("Select an agent to book on credit.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const property = { id: propertyId };
    const soldByStaffId = await resolveSoldByStaffId(
      admin,
      propertyId,
      formData.get("sold_by_staff_id"),
    );
    const salesClaim = buildSalesClaimInsert(soldByStaffId);

    const mealPlanCodeRaw = trimRequired(formData.get("meal_plan_code"), "Meal plan");
    const nights = nightsBetween(checkIn, checkOut);
    const addons = await resolveStayAddonsForBook(admin, property.id as string, {
      mealPlanCode: mealPlanCodeRaw,
      adults,
      children,
      extraBeds: extraBedsRaw,
      nights,
    });
    const mealPlanAmountBtn = addons.mealPlanAmountBtn;
    const mealPlanCode = addons.mealPlanCode;
    const extraBeds = addons.extraBeds;
    const extraBedAmountBtn = addons.extraBedAmountBtn;

    const { data: roomTypes, error: typesError } = await admin
      .from("room_types")
      .select("id, code, name, inventory_kind, unit_count")
      .eq("property_id", property.id);

    if (typesError || !roomTypes?.length) {
      throw new Error("Room types are not configured.");
    }

    const types = roomTypes as RoomTypeRow[];

    const usedByType = await soldQtyByRoomType(
      admin,
      property.id as string,
      checkIn,
      checkOut,
    );

    const lines: { room_type_id: string; qty: number; inventory_kind: string }[] =
      [];
    let guestRooms = 0;

    for (const rt of types) {
      const qty = parseNonNegInt(
        formData.get(`qty_${rt.code}`),
        `${rt.name} qty`,
        Math.max(rt.unit_count, 20),
      );
      if (qty === 0) continue;

      if (qty > rt.unit_count) {
        throw new Error(
          `${rt.name}: only ${rt.unit_count} units in inventory (requested ${qty}).`,
        );
      }

      const used = usedByType.get(rt.id) ?? 0;
      if (used + qty > rt.unit_count) {
        throw new Error(
          `${rt.name}: ${Math.max(rt.unit_count - used, 0)} left for these dates (requested ${qty}).`,
        );
      }

      lines.push({
        room_type_id: rt.id,
        qty,
        inventory_kind: rt.inventory_kind,
      });

      if (rt.inventory_kind === "sellable_guest") {
        guestRooms += qty;
      }
    }

    if (lines.length === 0) {
      throw new Error("Select at least one guest, guide, or driver bed.");
    }

    if (guestRooms < 1) {
      throw new Error("Add at least one sellable guest room.");
    }

    let tier = rateTierFromSource(source);
    if (agentId) {
      const { data: agent } = await admin
        .from("agents")
        .select("id, status, rate_tier")
        .eq("id", agentId)
        .maybeSingle();
      if (!agent || !isBookableAgentStatus(agent.status as string)) {
        throw new Error(
          "Agent must be approved, demo, or directory to attach to a booking.",
        );
      }
      if (
        paymentMode === "on_credit" &&
        !isCreditAgentStatus(agent.status as string)
      ) {
        throw new Error(
          "On-credit stays require an approved or demo trade partner (directory listings have no credit).",
        );
      }
      tier = agentRateTier(agent.rate_tier as string);
    }

    let creditChargeBtn = 0;
    let quotedRoomsBtn = 0;
    {
      const season = await resolveSeasonKind(
        admin,
        property.id as string,
        checkIn,
      );
      const taxSettings = await loadRoomRateTaxSettings(
        admin,
        property.id as string,
      );
      for (const line of lines) {
        if (line.inventory_kind !== "sellable_guest") continue;
        const rate = await lookupRoomRateBtn(admin, {
          propertyId: property.id as string,
          roomTypeId: line.room_type_id,
          seasonKind: season,
          rateTier: tier,
        });
        if (rate != null) {
          const nightAllIn = calculateRoomNightTax(rate, taxSettings).totalBtn;
          quotedRoomsBtn += nightAllIn * line.qty * nights;
        }
      }
      quotedRoomsBtn = roundBtn(quotedRoomsBtn);
    }

    if (paymentMode === "on_credit" && agentId) {
      const season = await resolveSeasonKind(admin, property.id as string, checkIn);
      const taxSettings = await loadRoomRateTaxSettings(
        admin,
        property.id as string,
      );
      let estimate = 0;
      for (const line of lines) {
        if (line.inventory_kind !== "sellable_guest") continue;
        const rate = await lookupRoomRateBtn(admin, {
          propertyId: property.id as string,
          roomTypeId: line.room_type_id,
          seasonKind: season,
          rateTier: tier,
        });
        if (rate == null) {
          throw new Error(
            "No room rate for this season/tier. Set rates before on-credit booking.",
          );
        }
        const nightAllIn = calculateRoomNightTax(rate, taxSettings).totalBtn;
        estimate += nightAllIn * line.qty * nights;
      }
      creditChargeBtn = roundBtn(estimate);
      if (creditChargeBtn <= 0) {
        throw new Error("Could not estimate on-credit amount from rates.");
      }
    }

    const promoCodeRaw = optionalTrim(formData.get("promo_code"));

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: property.id,
        agent_id: agentId,
        source: source === "mou_agent" ? "agent" : source,
        booked_by_role: source,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: "desk_fast_book",
        check_in: checkIn,
        check_out: checkOut,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        adults,
        children,
        extra_beds: extraBeds,
        rooms: guestRooms,
        guide_number: guideNumber,
        guest_origin: guestOrigin,
        payment_mode: paymentMode,
        notes,
        meal_plan_code: mealPlanCode,
        meal_plan_amount_btn: mealPlanAmountBtn,
        extra_bed_amount_btn: extraBedAmountBtn,
        sold_by_staff_id: salesClaim.sold_by_staff_id,
        sales_claim_status: salesClaim.sales_claim_status,
        quoted_total_btn:
          quotedRoomsBtn > 0
            ? roundBtn(
                quotedRoomsBtn +
                  (mealPlanAmountBtn ?? 0) +
                  (extraBedAmountBtn ?? 0),
              )
            : null,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("createFastBooking insert failed", bookingError);
      throw new Error("Could not save booking. Check schema migration is applied.");
    }

    if (promoCodeRaw) {
      if (quotedRoomsBtn <= 0) {
        await admin.from("bookings").delete().eq("id", booking.id);
        throw new Error(
          "Room rates required to apply a promo on Fast Book. Set rates first.",
        );
      }
      const preDiscount = roundBtn(
        quotedRoomsBtn +
          (mealPlanAmountBtn ?? 0) +
          (extraBedAmountBtn ?? 0),
      );
      const redeemed = await redeemPromoCode(admin, {
        propertyId: property.id as string,
        code: promoCodeRaw,
        channel: "desk_folio",
        domain: "rooms",
        preDiscountBtn: preDiscount,
        guestKey: contactPhone,
        bookingId: booking.id as string,
        minNights: nights,
        createdBy: "desk_fast_book",
      });
      if (!redeemed.ok) {
        await admin.from("bookings").delete().eq("id", booking.id);
        throw new Error(redeemed.error ?? "Promo code rejected.");
      }
      const promoDiscountBtn = Number(redeemed.discount_btn ?? 0);
      const post = roundBtn(
        Number(redeemed.post_discount_btn ?? preDiscount - promoDiscountBtn),
      );
      // Persist stay-level % for nightly room + meal posters (fixed promo amortized).
      const promoDiscountPct = stayLevelPromoDiscountPct({
        benefitType: redeemed.benefit_type,
        benefitValue: redeemed.benefit_value,
        discountBtn: promoDiscountBtn,
        preDiscountBtn: preDiscount,
      });
      await admin
        .from("bookings")
        .update({
          promo_code_id: redeemed.promo_code_id ?? null,
          promo_discount_pct: promoDiscountPct,
          promo_discount_btn: promoDiscountBtn,
          promo_code_snapshot:
            redeemed.code ?? promoCodeRaw.toUpperCase(),
          quoted_total_btn: post,
        })
        .eq("id", booking.id);
    }

    if (soldByStaffId) {
      await writeAuditEvent(admin, {
        propertyId: property.id as string,
        action: "sales_claim.set",
        entityType: "bookings",
        entityId: booking.id as string,
        summary: "Sales claim set on fast book",
        meta: { sold_by_staff_id: soldByStaffId },
      });
    }

    const { error: linesError } = await admin.from("booking_rooms").insert(
      lines.map((line) => ({
        booking_id: booking.id,
        room_type_id: line.room_type_id,
        qty: line.qty,
        inventory_kind: line.inventory_kind,
      })),
    );

    if (linesError) {
      console.error("createFastBooking lines failed", linesError);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not save room lines. Apply fast-book migration.");
    }

    try {
      const { assignRoomsForBooking } = await import("@/lib/room-assignments");
      const preferredUnitId = optionalTrim(formData.get("room_unit_id"));
      await assignRoomsForBooking(admin, {
        propertyId: property.id as string,
        bookingId: booking.id as string,
        checkIn,
        checkOut,
        lines,
        preferredUnitId,
      });
    } catch (assignErr) {
      console.error("createFastBooking assign failed", assignErr);
      // Booking stays; rack may show unassigned until ensureAssignments runs.
    }

    if (paymentMode === "on_credit" && agentId && creditChargeBtn > 0) {
      try {
        await chargeAgentCredit(admin, {
          agentId,
          amountBtn: creditChargeBtn,
          bookingId: booking.id as string,
          note: `Fast-book on credit · ${nights} night(s)`,
        });
      } catch (creditErr) {
        await admin.from("booking_rooms").delete().eq("booking_id", booking.id);
        await admin.from("bookings").delete().eq("id", booking.id);
        throw creditErr;
      }
    }

    await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: contactName,
    });

    await notifyNewBooking({
      bookingId: booking.id,
      contactName,
      contactPhone,
      contactEmail,
      checkIn,
      checkOut,
      adults,
      rooms: guestRooms,
      guideNumber,
      notes: notes ? `[FAST-BOOK ${source}] ${notes}` : `[FAST-BOOK ${source}]`,
    });

    await enqueueAfterBookingChange(
      admin,
      property.id as string,
      checkIn,
      checkOut,
      "fast_book.create",
    );

    revalidatePath("/erp");
    revalidatePath("/erp/agents");
    revalidatePath("/erp/fast-book");
    revalidatePath("/erp/channel");
    revalidatePath("/erp/calendar");

    return { ok: true, bookingId: booking.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
