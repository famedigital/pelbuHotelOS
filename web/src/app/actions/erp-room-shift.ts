"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday } from "@/lib/erp-lists";
import { snapshotStayBeforeEdit } from "@/lib/erp/rack-history";
import { ensureOpenFolio } from "@/lib/folio/open-folio";
import { postFolioCharge } from "@/lib/folio/post-charge";
import {
  nightsFromShift,
  planInHouseRoomShift,
  taxFromGuestBalance,
  upgradeBalanceChange,
  upgradeNeedsManagerPin,
  type ShiftBillChoice,
} from "@/lib/folio/room-shift";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import {
  applyDiscountPct,
  resolveBookingPartnerDiscountPct,
} from "@/lib/partners/discount";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import { stayRangesOverlap } from "@/lib/room-assignments";
import {
  agentRateTier,
  isRateTier,
  lookupRoomRateBtn,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ShiftRoomOption = {
  id: string;
  label: string;
  floorLabel: string | null;
  viewLabel: string | null;
  typeName: string;
  hkStatus: string;
  sameCategory: boolean;
  free: boolean;
  reason: string | null;
};

export type ShiftRoomListState =
  | {
      ok: true;
      fromLabel: string;
      fromView: string | null;
      shiftDate: string;
      checkOut: string;
      mode: "full" | "split";
      rooms: ShiftRoomOption[];
    }
  | { ok: false; error: string };

export type ShiftRoomResult =
  | {
      ok: true;
      message: string;
      assignmentId: string;
      roomLabel: string;
    }
  | { ok: false; error: string };

export type ShiftBillInput = {
  choice: ShiftBillChoice;
  /** Guest balance change. Prefilled with the tariff gap × nights left. */
  topUpBalanceBtn?: number;
  reason?: string;
  managerPin?: string;
};

export type ShiftUpgradePreview =
  | {
      ok: true;
      quotedGuestNightly: number;
      newGuestNightly: number;
      nights: number;
      nightlyGapBtn: number;
      balanceChangeBtn: number;
      chargeable: boolean;
      samePrice: boolean;
      tariffKnown: boolean;
    }
  | { ok: false; error: string };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function revalidateShiftSurfaces() {
  revalidatePath("/erp/today");
  revalidatePath("/erp/day");
  revalidatePath("/erp/calendar");
  revalidatePath("/erp/in-house");
  revalidatePath("/erp/housekeeping");
  revalidatePath("/erp/rooms");
}

async function loadShiftContext(admin: Admin, assignmentId: string) {
  const propertyId = await requireDeskPropertyId();
  const { data: assignment, error } = await admin
    .from("room_assignments")
    .select(
      `id, booking_id, room_unit_id, from_date, to_date, chargeable, nc_reason_code, nc_authorized_by,
       bookings!inner(id, status, contact_name, check_out, property_id),
       room_units!inner(id, label, view_label, room_type_id, hk_status, room_types(name, inventory_kind))`,
    )
    .eq("id", assignmentId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!assignment) throw new Error("Room assignment was not found.");

  const bookingRaw = assignment.bookings as
    | {
        id: string;
        status: string;
        contact_name: string | null;
        check_out: string;
        property_id: string;
      }
    | {
        id: string;
        status: string;
        contact_name: string | null;
        check_out: string;
        property_id: string;
      }[]
    | null;
  const booking = Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw;
  if (!booking || booking.property_id !== propertyId) {
    throw new Error("Booking was not found.");
  }
  if (booking.status !== "checked_in") {
    throw new Error("Shift room is for a guest who is already in house.");
  }

  const unitRaw = assignment.room_units as
    | {
        id: string;
        label: string;
        view_label: string | null;
        room_type_id: string;
        hk_status: string | null;
        room_types:
          | { name?: string; inventory_kind?: string }
          | { name?: string; inventory_kind?: string }[]
          | null;
      }
    | {
        id: string;
        label: string;
        view_label: string | null;
        room_type_id: string;
        hk_status: string | null;
        room_types:
          | { name?: string; inventory_kind?: string }
          | { name?: string; inventory_kind?: string }[]
          | null;
      }[]
    | null;
  const unit = Array.isArray(unitRaw) ? unitRaw[0] : unitRaw;
  if (!unit) throw new Error("Current room was not found.");
  const typeRaw = unit.room_types;
  const roomType = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw;

  const { data: property } = await admin
    .from("properties")
    .select("current_business_date")
    .eq("id", propertyId)
    .maybeSingle();
  const businessDate =
    (property?.current_business_date as string | null)?.slice(0, 10) ||
    thimphuToday();

  const plan = planInHouseRoomShift({
    fromDate: assignment.from_date as string,
    toDate: assignment.to_date as string,
    businessDate,
  });
  if (!plan.ok) throw new Error(plan.error);

  return {
    propertyId,
    assignment,
    booking,
    unit,
    inventoryKind: roomType?.inventory_kind ?? "sellable_guest",
    plan,
    checkOut: (assignment.to_date as string).slice(0, 10),
  };
}

function rateTierFromSource(source: string): RateTier {
  if (source === "mou_agent") return "mou_agents";
  if (source === "agent") return "agents";
  return "public";
}

function discountListed(
  amount: number,
  promoPct: number,
  partnerPct: number,
): number {
  let next = amount;
  if (promoPct > 0) {
    next = roundBtn(next * (1 - Math.min(100, promoPct) / 100));
  }
  if (partnerPct > 0) next = applyDiscountPct(next, partnerPct);
  return roundBtn(next);
}

async function resolveShiftQuote(
  admin: Admin,
  ctx: Awaited<ReturnType<typeof loadShiftContext>>,
  toTypeId: string,
) {
  const { propertyId, booking, unit, plan, checkOut, assignment } = ctx;
  const chargeable = assignment.chargeable !== false;
  const { data: stay, error: stayError } = await admin
    .from("bookings")
    .select(
      "agreed_nightly_rate_btn, agreed_rate_reason, sheet_rate_tier, source, booked_by_role, adults, rate_tax_mode, promo_discount_pct, agents(rate_tier)",
    )
    .eq("id", booking.id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (stayError) throw new Error(stayError.message);
  if (!stay) throw new Error("Booking was not found.");

  const { data: roomLines, error: roomLineError } = await admin
    .from("booking_rooms")
    .select("id, qty, room_type_id, inventory_kind, agreed_nightly_rate_btn, rate_request_status")
    .eq("booking_id", booking.id);
  if (roomLineError) throw new Error(roomLineError.message);

  const currentLine = (roomLines ?? []).find((line) => {
    const status = (line.rate_request_status as string | null) ?? "none";
    return (
      (line.room_type_id as string) === unit.room_type_id &&
      (line.inventory_kind as string) === "sellable_guest" &&
      status !== "pending" &&
      status !== "rejected" &&
      line.agreed_nightly_rate_btn != null
    );
  });
  const lineAgreed =
    currentLine?.agreed_nightly_rate_btn != null
      ? Number(currentLine.agreed_nightly_rate_btn)
      : null;
  const bookingAgreed =
    stay.agreed_nightly_rate_btn != null
      ? Number(stay.agreed_nightly_rate_btn)
      : null;

  const agentRaw = stay.agents as
    | { rate_tier?: string | null }
    | { rate_tier?: string | null }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
  const source =
    (stay.booked_by_role as string | null) ||
    (stay.source as string | null) ||
    "direct";
  const sheetTier = stay.sheet_rate_tier as string | null;
  const tier: RateTier =
    sheetTier && isRateTier(sheetTier)
      ? sheetTier
      : agent?.rate_tier
        ? agentRateTier(agent.rate_tier)
        : rateTierFromSource(source);

  const [taxSettings, seasonKind, partner] = await Promise.all([
    loadRoomRateTaxSettings(admin, propertyId),
    resolveSeasonKind(admin, propertyId, plan.shiftDate),
    resolveBookingPartnerDiscountPct(admin, booking.id),
  ]);
  const rateTaxMode = stay.rate_tax_mode as string | null;
  const taxOpts = {
    ...taxSettings,
    inclusiveOfGstSc:
      rateTaxMode === "inclusive"
        ? true
        : rateTaxMode === "exclusive"
          ? false
          : taxSettings.inclusiveOfGstSc,
  };
  const promoPct = Number(stay.promo_discount_pct ?? 0);
  const quotedIsAgreed =
    (lineAgreed != null && lineAgreed >= 0) ||
    (bookingAgreed != null && bookingAgreed >= 0);

  const quotedTariff = quotedIsAgreed
    ? null
    : await lookupRoomRateBtn(admin, {
        propertyId,
        roomTypeId: unit.room_type_id,
        seasonKind,
        rateTier: tier,
        adults: Math.max(1, Number(stay.adults ?? 2)),
      });
  const newTariff = await lookupRoomRateBtn(admin, {
    propertyId,
    roomTypeId: toTypeId,
    seasonKind,
    rateTier: tier,
    adults: Math.max(1, Number(stay.adults ?? 2)),
  });

  const quotedListed = quotedIsAgreed
    ? roundBtn((lineAgreed ?? bookingAgreed) as number)
    : quotedTariff == null
      ? null
      : discountListed(quotedTariff, promoPct, partner.pct);
  if (quotedListed == null) {
    throw new Error("This stay has no quoted nightly rate.");
  }
  const newListed =
    newTariff == null
      ? null
      : quotedIsAgreed
        ? roundBtn(newTariff)
        : discountListed(newTariff, promoPct, partner.pct);

  const quotedGuest = calculateRoomNightTax(quotedListed, taxOpts).totalBtn;
  const newGuest =
    newListed == null
      ? quotedGuest
      : calculateRoomNightTax(newListed, taxOpts).totalBtn;
  const nights = nightsFromShift(plan.shiftDate, checkOut);
  const gap = upgradeBalanceChange({
    quotedGuestNightly: quotedGuest,
    newGuestNightly: newGuest,
    nights,
  });

  const singleLine = (roomLines ?? []).filter(
    (line) =>
      (line.room_type_id as string) === unit.room_type_id &&
      (line.inventory_kind as string) === "sellable_guest" &&
      Number(line.qty ?? 1) === 1,
  );

  return {
    quotedListed,
    quotedGuest,
    newListed,
    newGuest,
    nights,
    ...gap,
    chargeable,
    taxOpts,
    hasTariff: newListed != null,
    bookingAgreed,
    agreedReason: (stay.agreed_rate_reason as string | null) ?? null,
    lineToPin:
      singleLine.length === 1
        ? {
            id: singleLine[0]!.id as string,
            agreed:
              singleLine[0]!.agreed_nightly_rate_btn != null
                ? Number(singleLine[0]!.agreed_nightly_rate_btn)
                : null,
          }
        : null,
  };
}

export async function previewInHouseRoomUpgrade(
  assignmentId: string,
  toUnitId: string,
): Promise<ShiftUpgradePreview> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired. Sign in again." };
    }
    if (!UUID_RE.test(assignmentId) || !UUID_RE.test(toUnitId)) {
      return { ok: false, error: "Invalid room." };
    }
    const admin = createSupabaseAdminClient();
    const ctx = await loadShiftContext(admin, assignmentId);
    const { data: dest, error } = await admin
      .from("room_units")
      .select("room_type_id")
      .eq("id", toUnitId)
      .eq("property_id", ctx.propertyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dest) return { ok: false, error: "Destination room was not found." };
    const quote = await resolveShiftQuote(
      admin,
      ctx,
      dest.room_type_id as string,
    );
    return {
      ok: true,
      quotedGuestNightly: quote.quotedGuest,
      newGuestNightly: quote.newGuest,
      nights: quote.nights,
      nightlyGapBtn: quote.nightlyGapBtn,
      balanceChangeBtn: quote.chargeable ? quote.balanceChangeBtn : 0,
      chargeable: quote.chargeable,
      samePrice: Math.abs(quote.nightlyGapBtn) < 0.5,
      tariffKnown: quote.hasTariff,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not price this room.",
    };
  }
}

export async function listInHouseShiftRooms(
  assignmentId: string,
): Promise<ShiftRoomListState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired. Sign in again." };
    }
    if (!UUID_RE.test(assignmentId)) {
      return { ok: false, error: "Invalid room assignment." };
    }
    const admin = createSupabaseAdminClient();
    const ctx = await loadShiftContext(admin, assignmentId);
    const { propertyId, unit, plan, checkOut, inventoryKind } = ctx;

    const [{ data: units, error: unitError }, { data: busy }, { data: blocks }] =
      await Promise.all([
        admin
          .from("room_units")
          .select(
            "id, label, floor_label, view_label, hk_status, is_active, sort_order, room_type_id, room_types(name, inventory_kind)",
          )
          .eq("property_id", propertyId)
          .order("sort_order", { ascending: true }),
        admin
          .from("room_assignments")
          .select("id, room_unit_id, from_date, to_date")
          .eq("property_id", propertyId)
          .lt("from_date", checkOut)
          .gt("to_date", plan.shiftDate),
        admin
          .from("room_blocks")
          .select("room_unit_id, from_date, to_date, block_kind")
          .eq("property_id", propertyId)
          .is("released_at", null)
          .lt("from_date", checkOut)
          .gt("to_date", plan.shiftDate),
      ]);
    if (unitError) throw new Error(unitError.message);

    const rooms: ShiftRoomOption[] = [];
    for (const row of units ?? []) {
      if ((row.id as string) === unit.id) continue;
      const typeRaw = row.room_types as
        | { name?: string; inventory_kind?: string }
        | { name?: string; inventory_kind?: string }[]
        | null;
      const type = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw;
      const kind = type?.inventory_kind ?? "sellable_guest";
      if (kind !== inventoryKind) continue;

      const hk = ((row.hk_status as string | null) ?? "unknown").toLowerCase();
      let reason: string | null = null;
      if (row.is_active === false) reason = "Inactive";
      else if (hk === "ooo") reason = "Out of order";
      else {
        const occupied = (busy ?? []).find(
          (stay) =>
            (stay.room_unit_id as string) === (row.id as string) &&
            (stay.id as string) !== assignmentId &&
            stayRangesOverlap(
              plan.shiftDate,
              checkOut,
              stay.from_date as string,
              stay.to_date as string,
            ),
        );
        const blocked = (blocks ?? []).find(
          (block) =>
            (block.room_unit_id as string) === (row.id as string) &&
            stayRangesOverlap(
              plan.shiftDate,
              checkOut,
              block.from_date as string,
              block.to_date as string,
            ),
        );
        if (occupied) reason = "Occupied";
        else if (blocked) reason = "Blocked";
        else if (hk === "dirty") reason = "Needs clean";
      }

      rooms.push({
        id: row.id as string,
        label: (row.label as string) ?? "Room",
        floorLabel: (row.floor_label as string | null) ?? null,
        viewLabel: (row.view_label as string | null)?.trim() || null,
        typeName: type?.name?.trim() || "Room",
        hkStatus: hk,
        sameCategory: (row.room_type_id as string) === unit.room_type_id,
        free: reason == null || reason === "Needs clean",
        reason,
      });
    }

    rooms.sort((a, b) => {
      if (a.free !== b.free) return a.free ? -1 : 1;
      const aView = a.viewLabel ? 0 : 1;
      const bView = b.viewLabel ? 0 : 1;
      if (aView !== bView) return aView - bView;
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });

    return {
      ok: true,
      fromLabel: unit.label,
      fromView: unit.view_label?.trim() || null,
      shiftDate: plan.shiftDate,
      checkOut,
      mode: plan.mode,
      rooms,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not list free rooms.",
    };
  }
}

export async function shiftInHouseRoom(
  assignmentId: string,
  toUnitId: string,
  bill: ShiftBillInput,
): Promise<ShiftRoomResult> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired. Sign in again." };
    }
    if (!UUID_RE.test(assignmentId) || !UUID_RE.test(toUnitId)) {
      return { ok: false, error: "Invalid room." };
    }
    const admin = createSupabaseAdminClient();
    const ctx = await loadShiftContext(admin, assignmentId);
    const { propertyId, assignment, booking, unit, plan, checkOut } = ctx;
    if (toUnitId === unit.id) {
      return { ok: false, error: "Choose a different room." };
    }

    const listed = await listInHouseShiftRooms(assignmentId);
    if (!listed.ok) return listed;
    const dest = listed.rooms.find((room) => room.id === toUnitId);
    if (!dest) return { ok: false, error: "That room is not on this property." };
    if (!dest.free) {
      return {
        ok: false,
        error: dest.reason
          ? `${dest.label} is not free (${dest.reason.toLowerCase()}).`
          : `${dest.label} is not free for the rest of the stay.`,
      };
    }

    const { data: destUnit, error: destError } = await admin
      .from("room_units")
      .select("id, label, room_type_id")
      .eq("id", toUnitId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (destError) throw new Error(destError.message);
    if (!destUnit) return { ok: false, error: "Destination room was not found." };

    const choice: ShiftBillChoice =
      bill?.choice === "top_up" ? "top_up" : "complimentary";
    const quote = await resolveShiftQuote(admin, ctx, destUnit.room_type_id as string);
    if (!quote.chargeable && choice === "top_up") {
      return {
        ok: false,
        error: "This room is non-chargeable. The move stays complimentary.",
      };
    }
    if (choice === "top_up" && !quote.hasTariff && Math.abs(Number(bill.topUpBalanceBtn ?? 0)) > 0.5) {
      return {
        ok: false,
        error: "This room has no tariff on the stay's rate plan. Keep it complimentary, or set a rate first.",
      };
    }
    const topUpBalance = roundBtn(Number(bill.topUpBalanceBtn ?? quote.balanceChangeBtn));
    if (!Number.isFinite(topUpBalance) || Math.abs(topUpBalance) > 500_000) {
      return { ok: false, error: "Enter a top-up amount the bill can carry." };
    }
    const needsPin = upgradeNeedsManagerPin({
      choice,
      suggestedBalanceBtn: quote.chargeable ? quote.balanceChangeBtn : 0,
      topUpBalanceBtn: choice === "top_up" ? topUpBalance : 0,
    });
    const reason = bill.reason?.trim() ?? "";
    if (needsPin) {
      if (reason.length < 3) {
        return {
          ok: false,
          error: "Add a short reason. A manager PIN is required when the upgrade is complimentary or the top-up is below the quoted gap.",
        };
      }
      const pin = bill.managerPin?.trim() ?? "";
      const verified = await verifyManagerPinForProperty(admin, propertyId, pin);
      if (!verified.ok) return { ok: false, error: verified.error };
    }

    await snapshotStayBeforeEdit(admin, propertyId, {
      assignmentId,
      summary: "Before in-house room shift",
    });

    const fromLabel = unit.label;
    const toLabel = destUnit.label as string;
    const fromType = unit.room_type_id;
    const toType = destUnit.room_type_id as string;

    let retargetedLineId: string | null = null;
    let previousLineType: string | null = null;
    if (fromType !== toType) {
      const { data: lines, error: lineError } = await admin
        .from("booking_rooms")
        .select("id, qty, room_type_id, inventory_kind")
        .eq("booking_id", booking.id);
      if (lineError) throw new Error(lineError.message);
      const matching = (lines ?? []).filter(
        (line) =>
          (line.room_type_id as string) === fromType &&
          (line.inventory_kind as string) === "sellable_guest" &&
          Number(line.qty ?? 1) === 1,
      );
      if (matching.length === 1) {
        retargetedLineId = matching[0]!.id as string;
        previousLineType = fromType;
        const { error: typeError } = await admin
          .from("booking_rooms")
          .update({ room_type_id: toType })
          .eq("id", retargetedLineId);
        if (typeError) throw new Error(typeError.message);
      }
    }

    const { data: folioLines, error: folioError } = await admin
      .from("folio_lines")
      .select("id, description, business_date")
      .eq("booking_id", booking.id)
      .eq("room_unit_id", unit.id)
      .eq("source_type", "room")
      .eq("status", "posted")
      .gte("business_date", plan.shiftDate);
    if (folioError) throw new Error(folioError.message);

    const fromToken = `Room ${fromLabel}`;
    const toToken = `Room ${toLabel}`;
    const touched: Array<{ id: string; description: string }> = [];
    let createdAssignmentId: string | null = null;
    let shortened = false;
    let fullMoved = false;
    let pinnedBooking = false;

    const rollback = async () => {
      if (createdAssignmentId) {
        await admin.from("room_assignments").delete().eq("id", createdAssignmentId);
      }
      if (shortened) {
        await admin
          .from("room_assignments")
          .update({ to_date: checkOut })
          .eq("id", assignmentId)
          .eq("property_id", propertyId);
      }
      if (fullMoved) {
        await admin
          .from("room_assignments")
          .update({ room_unit_id: unit.id })
          .eq("id", assignmentId)
          .eq("property_id", propertyId);
      }
      for (const line of touched) {
        await admin
          .from("folio_lines")
          .update({
            room_unit_id: unit.id,
            description: line.description,
            source_id: assignmentId,
          })
          .eq("id", line.id);
      }
      if (retargetedLineId && previousLineType) {
        await admin
          .from("booking_rooms")
          .update({
            room_type_id: previousLineType,
            agreed_nightly_rate_btn: quote.lineToPin?.agreed ?? null,
          })
          .eq("id", retargetedLineId);
      }
      if (pinnedBooking) {
        await admin
          .from("bookings")
          .update({
            agreed_nightly_rate_btn: quote.bookingAgreed,
            agreed_rate_reason: quote.agreedReason,
          })
          .eq("id", booking.id)
          .eq("property_id", propertyId);
      }
    };

    let activeAssignmentId = assignmentId;
    try {
      for (const line of folioLines ?? []) {
        const description = String(line.description ?? "")
          .split(fromToken)
          .join(toToken);
        touched.push({
          id: line.id as string,
          description: String(line.description ?? ""),
        });
        const { error: updateError } = await admin
          .from("folio_lines")
          .update({
            room_unit_id: toUnitId,
            description,
          })
          .eq("id", line.id as string);
        if (updateError) throw new Error(updateError.message);
      }

      if (plan.mode === "split") {
        const { error: shortenError } = await admin
          .from("room_assignments")
          .update({ to_date: plan.shiftDate })
          .eq("id", assignmentId)
          .eq("property_id", propertyId);
        if (shortenError) throw new Error(shortenError.message);
        shortened = true;

        const { data: created, error: insertError } = await admin
          .from("room_assignments")
          .insert({
            property_id: propertyId,
            booking_id: booking.id,
            room_unit_id: toUnitId,
            from_date: plan.shiftDate,
            to_date: checkOut,
            chargeable: assignment.chargeable !== false,
            nc_reason_code: assignment.nc_reason_code ?? null,
            nc_authorized_by: assignment.nc_authorized_by ?? null,
          })
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        createdAssignmentId = created.id as string;
        activeAssignmentId = createdAssignmentId;
      } else {
        const { error: moveError } = await admin
          .from("room_assignments")
          .update({ room_unit_id: toUnitId })
          .eq("id", assignmentId)
          .eq("property_id", propertyId);
        if (moveError) throw new Error(moveError.message);
        fullMoved = true;
      }

      if (touched.length > 0 && activeAssignmentId !== assignmentId) {
        const { error: sourceError } = await admin
          .from("folio_lines")
          .update({ source_id: activeAssignmentId })
          .in(
            "id",
            touched.map((line) => line.id),
          );
        if (sourceError) throw new Error(sourceError.message);
      }

      if (quote.bookingAgreed == null) {
        const { error: pinError } = await admin
          .from("bookings")
          .update({
            agreed_nightly_rate_btn: quote.quotedListed,
            agreed_rate_reason:
              quote.agreedReason ?? "Quoted rate kept on room change",
          })
          .eq("id", booking.id)
          .eq("property_id", propertyId);
        if (pinError) throw new Error(pinError.message);
        pinnedBooking = true;
      }
      if (quote.lineToPin && quote.lineToPin.agreed == null && fromType !== toType) {
        const { error: linePinError } = await admin
          .from("booking_rooms")
          .update({ agreed_nightly_rate_btn: quote.quotedListed })
          .eq("id", quote.lineToPin.id);
        if (linePinError) throw new Error(linePinError.message);
      }

      if (choice === "top_up" && Math.abs(topUpBalance) >= 0.5) {
        const tax = taxFromGuestBalance(topUpBalance, quote.taxOpts);
        const folioId = await ensureOpenFolio(
          admin,
          propertyId,
          booking.id,
          `${(booking.contact_name as string | null)?.trim() || "Guest"} · Room ${toLabel}`,
        );
        const upgrade =
          topUpBalance > 0
            ? `Upgrade ${fromLabel} → ${toLabel} · ${quote.nights} night${quote.nights === 1 ? "" : "s"} · on top of quoted rate`
            : `Room change ${fromLabel} → ${toLabel} · credit ${quote.nights} night${quote.nights === 1 ? "" : "s"} · below quoted rate`;
        await postFolioCharge(admin, propertyId, {
          folio_id: folioId,
          booking_id: booking.id,
          source_type: "room",
          source_id: activeAssignmentId,
          description: reason ? `${upgrade} · ${reason}` : upgrade,
          qty: 1,
          unit_price_btn: tax.amountBtn,
          amount_btn: tax.amountBtn,
          service_charge_rate: tax.serviceChargeRate,
          service_charge_btn: tax.serviceChargeBtn,
          service_charge_applied: tax.serviceChargeApplied,
          gst_applicable: tax.gstBtn !== 0,
          gst_btn: tax.gstBtn,
          total_btn: tax.totalBtn,
          business_date: plan.shiftDate,
          journal_date: plan.shiftDate,
          room_unit_id: toUnitId,
          tax_treatment: quote.taxOpts.inclusiveOfGstSc ? "inclusive" : "net",
          skip_guest_rate_adj: true,
        });
      }
    } catch (moveError) {
      await rollback();
      throw moveError;
    }

    const { data: stillThere } = await admin
      .from("room_assignments")
      .select("id")
      .eq("property_id", propertyId)
      .eq("room_unit_id", unit.id)
      .lte("from_date", plan.shiftDate)
      .gt("to_date", plan.shiftDate)
      .limit(1);
    if (!stillThere?.length) {
      await admin
        .from("room_units")
        .update({
          hk_status: "dirty",
          updated_at: new Date().toISOString(),
        })
        .eq("id", unit.id)
        .eq("property_id", propertyId)
        .neq("hk_status", "ooo");
    }

    await admin
      .from("orders")
      .update({ room_unit_id: toUnitId })
      .eq("property_id", propertyId)
      .eq("booking_id", booking.id)
      .eq("room_unit_id", unit.id)
      .is("settled_at", null)
      .neq("kot_status", "cancelled")
      .neq("kot_status", "served");

    const { data: openFolios } = await admin
      .from("folios")
      .select("id, label")
      .eq("booking_id", booking.id)
      .eq("property_id", propertyId)
      .eq("status", "open");
    for (const folio of openFolios ?? []) {
      const label = String(folio.label ?? "");
      if (!label.includes(fromToken)) continue;
      await admin
        .from("folios")
        .update({ label: label.split(fromToken).join(toToken) })
        .eq("id", folio.id as string);
    }

      const guest = (booking.contact_name as string | null)?.trim() || "Guest";
      const rateNote =
        choice === "top_up" && Math.abs(topUpBalance) >= 0.5
          ? topUpBalance > 0
            ? `Added Nu ${topUpBalance.toLocaleString("en-BT")} on top of the quoted rate for ${quote.nights} night(s). Later room nights stay at the quoted rate.`
            : `Credited Nu ${Math.abs(topUpBalance).toLocaleString("en-BT")} for ${quote.nights} night(s). Later room nights stay at the quoted rate.`
          : "Complimentary — the quoted rate stays. Nothing extra on the bill.";
      const nightNote =
        plan.mode === "split"
          ? `Nights before ${plan.shiftDate} stay on ${fromLabel}.`
          : `The whole stay, including today's room charge, is now ${toLabel}.`;

      await writeAuditEvent(admin, {
        propertyId,
        action: "stay.room.shift",
        entityType: "bookings",
        entityId: booking.id,
        summary: `${guest} · ${fromLabel} → ${toLabel} from ${plan.shiftDate}`,
        meta: {
          assignment_id: assignmentId,
          active_assignment_id: activeAssignmentId,
          from_unit_id: unit.id,
          to_unit_id: toUnitId,
          shift_date: plan.shiftDate,
          mode: plan.mode,
          bill: choice,
          quoted_guest_nightly: quote.quotedGuest,
          new_guest_nightly: quote.newGuest,
          nights: quote.nights,
          top_up_balance_btn: choice === "top_up" ? topUpBalance : 0,
          reason: reason || null,
        },
      });

      revalidateShiftSurfaces();
      return {
        ok: true,
        assignmentId: activeAssignmentId,
        roomLabel: toLabel,
        message: `${guest} moved to ${toLabel}. ${nightNote} ${rateNote} ${fromLabel} is dirty for housekeeping.`,
      };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not shift room.";
    if (/overlap|exclusion|23P01|conflicting key/i.test(message)) {
      return {
        ok: false,
        error: "That room is occupied for part of the remaining stay.",
      };
    }
    return { ok: false, error: message };
  }
}
