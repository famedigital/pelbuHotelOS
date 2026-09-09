"use server";

import { chargeAgentCredit } from "@/app/actions/erp-agents";
import {
  creditAgentIneligibilityMessage,
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
import { isDeskAuthenticated, getDeskRole } from "@/lib/desk-auth";
import { writeAuditEvent } from "@/lib/audit";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import { isManagerDeskRole } from "@/lib/manager-pin-core";
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

export type DeskBookIntent = "reserve" | "confirm" | "check_in";

export type FastBookState = {
  ok: boolean;
  bookingId?: string;
  /** Human stay confirmation PS-YYYY-##### */
  confirmationCode?: string;
  /** How the desk created this stay — clients open the right StayHub panel. */
  intent?: DeskBookIntent;
  /** FO custom rate queued for GM — booking is held until approved. */
  ratePendingApproval?: boolean;
  /** Non-fatal issues (unassigned room, missing guest row) — booking still saved. */
  warnings?: string[];
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

const WALKIN_RATE_TIERS = new Set<RateTier>([
  "public",
  "friends",
  "family",
  "mutual_friends",
]);

function rateTierFromSource(source: string): RateTier {
  if (source === "mou_agent") return agentRateTier("mou_agents");
  if (source === "agent") return agentRateTier("agents");
  return "public";
}

function resolveWalkinRateTier(raw: string | null | undefined): RateTier | null {
  if (!raw) return null;
  if (WALKIN_RATE_TIERS.has(raw as RateTier)) return raw as RateTier;
  return null;
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
    const phoneRaw = optionalTrim(formData.get("contact_phone")) ?? "";
    const phoneDeferred =
      formData.get("phone_later") === "1" ||
      formData.get("phone_deferred") === "1" ||
      formData.get("phone_later") === "on";
    let contactPhone = "";
    if (phoneRaw) {
      assertPhone(phoneRaw);
      contactPhone = phoneRaw;
    } else if (!phoneDeferred) {
      // Blank allowed for walk-in (phone later) — same as calendar
      contactPhone = "";
    }

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
    void extraBedsRaw;
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

    const mealPlanCodeRaw =
      optionalTrim(formData.get("meal_plan_code")) ?? "EP";
    const nights = nightsBetween(checkIn, checkOut);

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

    const lines: {
      room_type_id: string;
      qty: number;
      inventory_kind: string;
      meal_plan_code: string;
      occupancy: "single" | "double";
      adults: number;
      children: number;
      extra_beds: number;
      sheet_nightly_rate_btn: number | null;
      agreed_nightly_rate_btn: number | null;
      rate_request_status: string;
      rate_request_reason: string | null;
    }[] = [];
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

      const lineAdults = Math.max(
        1,
        parseNonNegInt(
          formData.get(`line_adults_${rt.code}`),
          `${rt.name} adults`,
          12,
        ) || adults,
      );
      const lineChildren = parseNonNegInt(
        formData.get(`line_children_${rt.code}`),
        `${rt.name} children`,
        MAX_CHILDREN,
      );
      const lineExtra = parseNonNegInt(
        formData.get(`line_extra_${rt.code}`),
        `${rt.name} extra beds`,
        MAX_EXTRA_BEDS,
      );
      const lineOccRaw = optionalTrim(formData.get(`line_occ_${rt.code}`));
      const lineOcc: "single" | "double" =
        lineOccRaw === "single" || lineOccRaw === "double"
          ? lineOccRaw
          : lineAdults === 1
            ? "single"
            : "double";
      const lineMeal =
        optionalTrim(formData.get(`line_meal_${rt.code}`)) || mealPlanCodeRaw;
      const sheetRaw = optionalTrim(formData.get(`line_sheet_${rt.code}`));
      const sheetNightly = sheetRaw ? Number(sheetRaw) : null;
      const agreedLineRaw = optionalTrim(
        formData.get(`line_agreed_${rt.code}`),
      );
      let agreedLine: number | null = null;
      if (agreedLineRaw) {
        const n = Number(agreedLineRaw);
        if (Number.isFinite(n) && n >= 0) agreedLine = roundBtn(n);
      }

      lines.push({
        room_type_id: rt.id,
        qty,
        inventory_kind: rt.inventory_kind,
        meal_plan_code: lineMeal,
        occupancy: lineOcc,
        adults: lineAdults,
        children: lineChildren,
        extra_beds: lineExtra,
        sheet_nightly_rate_btn:
          sheetNightly != null && Number.isFinite(sheetNightly)
            ? roundBtn(sheetNightly)
            : null,
        agreed_nightly_rate_btn: agreedLine,
        rate_request_status: "none",
        rate_request_reason: null,
      });

      if (rt.inventory_kind === "sellable_guest") {
        guestRooms += qty;
      }
    }

    if (guestRooms < 1) {
      throw new Error("Add at least one guest room.");
    }

    // Stay-level pax / meal totals from per-line config (qty-weighted).
    let bookingAdults = 0;
    let bookingChildren = 0;
    let bookingExtraBeds = 0;
    let mealPlanAmountBtn = 0;
    let extraBedAmountBtn = 0;
    let mealPlanCode = mealPlanCodeRaw;
    for (const line of lines) {
      if (line.inventory_kind !== "sellable_guest") continue;
      bookingAdults += line.adults * line.qty;
      bookingChildren += line.children * line.qty;
      bookingExtraBeds += line.extra_beds * line.qty;
      mealPlanCode = line.meal_plan_code || mealPlanCode;
      const addons = await resolveStayAddonsForBook(
        admin,
        property.id as string,
        {
          mealPlanCode: line.meal_plan_code,
          adults: line.adults * line.qty,
          children: line.children * line.qty,
          extraBeds: line.extra_beds * line.qty,
          nights,
        },
      );
      mealPlanAmountBtn = roundBtn(
        mealPlanAmountBtn + addons.mealPlanAmountBtn,
      );
      extraBedAmountBtn = roundBtn(
        extraBedAmountBtn + addons.extraBedAmountBtn,
      );
    }
    if (bookingAdults < 1) bookingAdults = adults;
    const extraBeds = bookingExtraBeds;

    if (lines.length === 0) {
      throw new Error("Select at least one guest, guide, or driver bed.");
    }

    if (guestRooms < 1) {
      throw new Error("Add at least one sellable guest room.");
    }

    let tier = rateTierFromSource(source);
    const walkinTier = resolveWalkinRateTier(
      optionalTrim(formData.get("rate_tier")),
    );
    if (!agentId && walkinTier) {
      tier = walkinTier;
    }
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
          creditAgentIneligibilityMessage(agent.status as string) ??
            "On-credit stays require an approved or demo trade partner.",
        );
      }
      tier = agentRateTier(agent.rate_tier as string);
    }

    const intentRaw = (optionalTrim(formData.get("intent")) ?? "confirm") as string;
    const intent: DeskBookIntent =
      intentRaw === "reserve" || intentRaw === "check_in"
        ? intentRaw
        : "confirm";

    /** Per-line custom rates: GM/owner (or PIN) approve instantly; FO → held + pending. */
    let agreedNightly: number | null = null;
    const agreedRaw = optionalTrim(formData.get("agreed_nightly_rate_btn"));
    if (agreedRaw) {
      const n = Number(agreedRaw);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("Agreed nightly rate must be a non-negative number.");
      }
      agreedNightly = roundBtn(n);
    }
    const systemNightlyRaw = optionalTrim(
      formData.get("system_nightly_rate_btn"),
    );
    const systemNightly = systemNightlyRaw ? Number(systemNightlyRaw) : null;
    const rateReason =
      optionalTrim(formData.get("rate_request_reason")) ?? "desk override";
    const deskRole = await getDeskRole();
    const canInstantRate = isManagerDeskRole(deskRole);
    const pin = optionalTrim(formData.get("manager_pin")) ?? "";
    let pinVerified = false;
    if (pin) {
      const pinRes = await verifyManagerPinForProperty(
        admin,
        property.id as string,
        pin,
      );
      if (!pinRes.ok) {
        throw new Error(
          pinRes.error ?? "Manager PIN required to change the rate.",
        );
      }
      pinVerified = true;
    }

    // Propagate legacy blended override onto lines that have no per-line agreed.
    if (agreedNightly != null) {
      const differs =
        systemNightly == null ||
        !Number.isFinite(systemNightly) ||
        Math.abs(agreedNightly - systemNightly) > 0.009;
      if (!differs) {
        agreedNightly = null;
      } else {
        for (const line of lines) {
          if (
            line.inventory_kind === "sellable_guest" &&
            line.agreed_nightly_rate_btn == null
          ) {
            line.agreed_nightly_rate_btn = agreedNightly;
          }
        }
      }
    }

    let anyRatePending = false;
    let approvedCustomCount = 0;
    for (const line of lines) {
      if (line.inventory_kind !== "sellable_guest") continue;
      const agreed = line.agreed_nightly_rate_btn;
      if (agreed == null) {
        line.rate_request_status = "none";
        continue;
      }
      const sheet = line.sheet_nightly_rate_btn;
      const differs =
        sheet == null ||
        !Number.isFinite(sheet) ||
        Math.abs(agreed - sheet) > 0.009;
      if (!differs) {
        line.agreed_nightly_rate_btn = null;
        line.rate_request_status = "none";
        line.rate_request_reason = null;
        continue;
      }
      if (canInstantRate || pinVerified) {
        line.rate_request_status = "approved";
        line.rate_request_reason = rateReason;
        approvedCustomCount += 1;
      } else {
        line.rate_request_status = "pending";
        line.rate_request_reason = rateReason;
        anyRatePending = true;
      }
    }

    // Booking-level agreed only when single sellable category with approved override.
    const sellableLines = lines.filter(
      (l) => l.inventory_kind === "sellable_guest",
    );
    if (
      sellableLines.length === 1 &&
      sellableLines[0].agreed_nightly_rate_btn != null &&
      sellableLines[0].rate_request_status === "approved"
    ) {
      agreedNightly = sellableLines[0].agreed_nightly_rate_btn;
    } else if (anyRatePending || sellableLines.length > 1) {
      agreedNightly =
        approvedCustomCount === 1 && sellableLines.length === 1
          ? sellableLines[0].agreed_nightly_rate_btn
          : null;
    }

    let creditChargeBtn = 0;
    let quotedRoomsBtn = 0;
    {
      const [season, taxSettings] = await Promise.all([
        resolveSeasonKind(admin, property.id as string, checkIn),
        loadRoomRateTaxSettings(admin, property.id as string),
      ]);
      const sellable = lines.filter((l) => l.inventory_kind === "sellable_guest");
      const sheetRates = await Promise.all(
        sellable.map((line) =>
          lookupRoomRateBtn(admin, {
            propertyId: property.id as string,
            roomTypeId: line.room_type_id,
            seasonKind: season,
            rateTier: tier,
            adults: line.adults,
            occupancy: line.occupancy,
          }),
        ),
      );
      for (let i = 0; i < sellable.length; i++) {
        const line = sellable[i];
        const sheetRate = sheetRates[i];
        const sheetAllIn =
          sheetRate != null
            ? calculateRoomNightTax(sheetRate, taxSettings).totalBtn
            : null;
        if (line.sheet_nightly_rate_btn == null && sheetAllIn != null) {
          line.sheet_nightly_rate_btn = roundBtn(sheetAllIn);
        }
        const rate =
          line.agreed_nightly_rate_btn != null
            ? line.agreed_nightly_rate_btn
            : sheetAllIn;
        if (rate != null) {
          quotedRoomsBtn += rate * line.qty * nights;
        }
      }
      quotedRoomsBtn = roundBtn(quotedRoomsBtn);

      if (paymentMode === "on_credit" && agentId) {
        let estimate = 0;
        for (let i = 0; i < sellable.length; i++) {
          const line = sellable[i];
          const sheetRate = sheetRates[i];
          const sheetAllIn =
            sheetRate != null
              ? calculateRoomNightTax(sheetRate, taxSettings).totalBtn
              : null;
          const rate =
            line.agreed_nightly_rate_btn != null
              ? line.agreed_nightly_rate_btn
              : sheetAllIn;
          if (rate == null) {
            throw new Error(
              "No room rate for this season/tier. Set rates before on-credit booking.",
            );
          }
          estimate += rate * line.qty * nights;
        }
        creditChargeBtn = roundBtn(estimate);
        if (creditChargeBtn <= 0) {
          throw new Error("Could not estimate on-credit amount from rates.");
        }
      }
    }

    const promoCodeRaw = optionalTrim(formData.get("promo_code"));
    const passportOrCid = optionalTrim(formData.get("passport_or_cid"));
    const sdfRef = optionalTrim(formData.get("sdf_ref"));

    const isHold = intent === "reserve" || anyRatePending;
    const holdExpiresAt = isHold
      ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        property_id: property.id,
        agent_id: agentId,
        source: source === "mou_agent" ? "agent" : source,
        booked_by_role: source,
        status: isHold ? "held" : "confirmed",
        confirmed_at: isHold ? null : new Date().toISOString(),
        confirmed_by: isHold ? null : "desk_fast_book",
        hold_expires_at: holdExpiresAt,
        check_in: checkIn,
        check_out: checkOut,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        adults: bookingAdults,
        children: bookingChildren,
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
        agreed_nightly_rate_btn: agreedNightly,
        agreed_rate_reason:
          agreedNightly != null ? "desk override" : null,
        agreed_rate_set_at:
          agreedNightly != null ? new Date().toISOString() : null,
        quoted_total_btn:
          quotedRoomsBtn > 0
            ? roundBtn(
                quotedRoomsBtn +
                  (mealPlanAmountBtn ?? 0) +
                  (extraBedAmountBtn ?? 0),
              )
            : null,
        rate_tax_mode:
          optionalTrim(formData.get("rate_tax_mode")) === "inclusive"
            ? "inclusive"
            : "exclusive",
        tax_exempt_gst: formData.get("tax_exempt_gst") === "1",
        tax_exempt_service: formData.get("tax_exempt_service") === "1",
        tax_exempt_bst: formData.get("tax_exempt_bst") === "1",
        release_days_before_arrival: (() => {
          const raw = optionalTrim(formData.get("release_days_before_arrival"));
          if (!raw) return null;
          const n = Number(raw);
          return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
        })(),
        release_percent: (() => {
          const raw = optionalTrim(formData.get("release_percent"));
          if (!raw) return null;
          const n = Number(raw);
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
        })(),
        deposit_due_on: (() => {
          // If release days set, deposit due = check-in minus release days
          const raw = optionalTrim(formData.get("release_days_before_arrival"));
          if (!raw) return null;
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) return null;
          const d = new Date(`${checkIn}T12:00:00`);
          d.setDate(d.getDate() - Math.floor(n));
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })(),
      })
      .select("id, confirmation_code")
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
        meal_plan_code: line.meal_plan_code,
        occupancy: line.occupancy,
        adults: line.adults,
        children: line.children,
        extra_beds: line.extra_beds,
        sheet_nightly_rate_btn: line.sheet_nightly_rate_btn,
        agreed_nightly_rate_btn: line.agreed_nightly_rate_btn,
        rate_request_status: line.rate_request_status,
        rate_request_reason: line.rate_request_reason,
      })),
    );

    if (linesError) {
      console.error("createFastBooking lines failed", linesError);
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not save room lines. Apply fast-book migration.");
    }

    const warnings: string[] = [];

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
      warnings.push(
        assignErr instanceof Error
          ? `Saved without room assign: ${assignErr.message}`
          : "Saved without room assign — assign on Stay View before check-in.",
      );
    }

    if (paymentMode === "on_credit" && agentId && creditChargeBtn > 0 && !anyRatePending) {
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

    const { error: guestInsertError } = await admin.from("booking_guests").insert({
      booking_id: booking.id,
      full_name: contactName,
      passport_or_cid: passportOrCid,
      sdf_ref: sdfRef,
    });
    if (guestInsertError) {
      console.error("createFastBooking guest insert failed", guestInsertError);
      warnings.push(
        "Saved without guest row — add the guest on check-in before confirming.",
      );
    }

    if (agreedNightly != null) {
      await writeAuditEvent(admin, {
        propertyId: property.id as string,
        action: "rate.agreed",
        entityType: "bookings",
        entityId: booking.id as string,
        summary: `Agreed nightly Nu ${agreedNightly} on desk book`,
        meta: {
          agreed_nightly_rate_btn: agreedNightly,
          system_nightly: systemNightly,
          reason: rateReason,
        },
      });
    } else if (anyRatePending) {
      await writeAuditEvent(admin, {
        propertyId: property.id as string,
        action: "rate.request_pending",
        entityType: "bookings",
        entityId: booking.id as string,
        summary: "Custom category rate(s) awaiting GM approval",
        meta: { reason: rateReason },
      });
    }

    // Don't block FO on WhatsApp/email or channel ARI (calendar single-room already does this).
    void notifyNewBooking({
      bookingId: booking.id,
      contactName,
      contactPhone,
      contactEmail,
      checkIn,
      checkOut,
      adults: bookingAdults,
      rooms: guestRooms,
      guideNumber,
      notes: notes
        ? `[DESK-BOOK ${source}/${intent}${anyRatePending ? "/rate-pending" : ""}] ${notes}`
        : `[DESK-BOOK ${source}/${intent}${anyRatePending ? "/rate-pending" : ""}]`,
    }).catch((err) => console.error("notifyNewBooking fast_book", err));

    void enqueueAfterBookingChange(
      admin,
      property.id as string,
      checkIn,
      checkOut,
      "fast_book.create",
    ).catch((err) => console.error("enqueueAfterBookingChange fast_book", err));

    revalidatePath("/erp/calendar");
    revalidatePath("/erp/reservations");
    if (anyRatePending) revalidatePath("/erp/rate-approvals");
    if (agentId) revalidatePath("/erp/agents");

    return {
      ok: true,
      bookingId: booking.id as string,
      confirmationCode:
        (booking.confirmation_code as string | null) ?? undefined,
      intent: anyRatePending ? "reserve" : intent,
      ratePendingApproval: anyRatePending,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
