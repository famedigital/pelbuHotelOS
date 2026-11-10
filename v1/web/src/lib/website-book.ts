import "server-only";

import { ensurePaymentLinkForBooking } from "@/app/actions/erp-holds";
import {
  computeTokenRequiredBtn,
  holdExpiresAtFromNow,
  resolveHoldTtlHours,
} from "@/lib/holds";
import {
  availabilityByRoomType,
  soldQtyByRoomType,
} from "@/lib/inventory-availability";
import { notifyNewBooking } from "@/lib/notify";
import { redeemPromoCode } from "@/lib/marketing/promo";
import { stayLevelPromoDiscountPct } from "@/lib/marketing/promo-math";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import {
  loadExtraBedPolicy,
  MAX_CHILDREN,
  MAX_EXTRA_BEDS,
  resolveStayAddonsForBook,
} from "@/lib/meal-plans";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import {
  lookupRoomRatesBatch,
  nightsBetween,
  resolveSeasonKind,
  type SeasonKind,
} from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertOptionalEmail,
  assertPhone,
  assertStayDates,
} from "@/lib/validation";
import {
  generateLookupToken,
  hashLookupToken,
  safeEqualHex,
} from "@/lib/website-api-keys";

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

export type MealPlanOption = {
  code: string;
  name: string;
  blurb: string | null;
  amountPerAdultNight: number | null;
  amountPerChildNight: number | null;
  priced: boolean;
};

export type ExtraBedOption = {
  sellable: boolean;
  ratePerNight: number | null;
  maxQty: number;
};

export type StayPreview = {
  ok: true;
  checkIn: string;
  checkOut: string;
  nights: number;
  season: SeasonKind;
  currency: "BTN";
  rooms: number;
  ratesInclusiveOfGstSc: boolean;
  options: RoomOption[];
  mealPlans: MealPlanOption[];
  extraBed: ExtraBedOption;
};

export type StayPreviewInput = {
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults?: number;
};

export class BookLibError extends Error {
  code:
    | "VALIDATION"
    | "SOLD_OUT"
    | "QUOTE_MISMATCH"
    | "NOT_FOUND"
    | "DUPLICATE_EXTERNAL_REF";
  constructor(
    code: BookLibError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

const MAX_NIGHTS = 30;
const MAX_CHECKIN_AHEAD_DAYS = 365;
const ARI_MAX_DAYS = 92;

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function assertApiStayWindow(checkIn: string, checkOut: string): void {
  assertStayDates(checkIn, checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > MAX_NIGHTS) {
    throw new BookLibError(
      "VALIDATION",
      `Stay cannot exceed ${MAX_NIGHTS} nights.`,
    );
  }
  const today = utcToday();
  if (checkIn < today) {
    throw new BookLibError("VALIDATION", "Check-in cannot be in the past.");
  }
  const maxIn = addDays(today, MAX_CHECKIN_AHEAD_DAYS);
  if (checkIn > maxIn) {
    throw new BookLibError(
      "VALIDATION",
      "Check-in is too far in the future.",
    );
  }
}

export function assertAriWindow(from: string, to: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new BookLibError("VALIDATION", "from/to must be YYYY-MM-DD.");
  }
  if (to <= from) {
    throw new BookLibError("VALIDATION", "to must be after from.");
  }
  const days = nightsBetween(from, to);
  if (days > ARI_MAX_DAYS) {
    throw new BookLibError(
      "VALIDATION",
      `ARI window cannot exceed ${ARI_MAX_DAYS} days.`,
    );
  }
  const today = utcToday();
  const maxFrom = addDays(today, MAX_CHECKIN_AHEAD_DAYS);
  if (from > maxFrom) {
    throw new BookLibError("VALIDATION", "from is too far in the future.");
  }
}

export async function previewStayForProperty(
  propertyId: string,
  input: StayPreviewInput,
): Promise<StayPreview> {
  const checkIn = input.checkIn;
  const checkOut = input.checkOut;
  const rooms = Math.max(1, Math.min(6, Math.floor(input.rooms)));
  const adults = Math.max(
    1,
    Math.min(12, Math.floor(Number(input.adults ?? 2)) || 2),
  );
  assertApiStayWindow(checkIn, checkOut);

  const admin = createSupabaseAdminClient();
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
      rate == null ? null : calculateRoomNightTax(rate, taxSettings).totalBtn;
    options.push({
      roomTypeId,
      code: rt.code as string,
      name: (rt.name as string) || (rt.code as string),
      capacity,
      remaining,
      perNightBtn: perNight,
      totalBtn: perNight == null ? null : roundBtn(perNight * nights * rooms),
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
  };
}

export type AriDayCell = {
  date: string;
  availability: number;
  rateBtn: number | null;
  stopSell: boolean;
};

export type AriRoomTypeBlock = {
  roomTypeId: string;
  code: string;
  name: string;
  days: AriDayCell[];
};

export async function buildAriWindow(
  propertyId: string,
  from: string,
  to: string,
  roomTypeCode?: string | null,
): Promise<{ from: string; to: string; currency: "BTN"; roomTypes: AriRoomTypeBlock[] }> {
  assertAriWindow(from, to);
  const admin = createSupabaseAdminClient();

  let q = admin
    .from("room_types")
    .select("id, code, name, unit_count")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest")
    .order("code");
  if (roomTypeCode) {
    q = q.eq("code", roomTypeCode);
  }
  const { data: roomTypes } = await q;
  if (!roomTypes?.length) {
    return { from, to, currency: "BTN", roomTypes: [] };
  }

  const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);
  const typeIds = roomTypes.map((rt) => rt.id as string);
  const dayMap = new Map<string, Map<string, AriDayCell>>();

  let cursor = from;
  while (cursor < to) {
    const next = addDays(cursor, 1);
    const avail = await availabilityByRoomType(
      admin,
      propertyId,
      cursor,
      next,
    );
    const remainingByType = new Map(
      avail.map((a) => [a.roomTypeId, a.remaining]),
    );
    const season = await resolveSeasonKind(admin, propertyId, cursor);
    const rates = await lookupRoomRatesBatch(admin, {
      propertyId,
      roomTypeIds: typeIds,
      seasonKind: season,
      rateTier: "public",
      adults: 2,
    });
    for (const id of typeIds) {
      const remaining = remainingByType.get(id) ?? 0;
      const base = rates.get(id) ?? null;
      const rateBtn =
        base == null
          ? null
          : calculateRoomNightTax(base, taxSettings).totalBtn;
      const cell: AriDayCell = {
        date: cursor,
        availability: remaining,
        rateBtn,
        stopSell: remaining <= 0,
      };
      if (!dayMap.has(id)) dayMap.set(id, new Map());
      dayMap.get(id)!.set(cursor, cell);
    }
    cursor = next;
  }

  const blocks: AriRoomTypeBlock[] = roomTypes.map((rt) => {
    const roomTypeId = rt.id as string;
    const days: AriDayCell[] = [];
    let d = from;
    while (d < to) {
      days.push(
        dayMap.get(roomTypeId)?.get(d) ?? {
          date: d,
          availability: 0,
          rateBtn: null,
          stopSell: true,
        },
      );
      d = addDays(d, 1);
    }
    return {
      roomTypeId,
      code: rt.code as string,
      name: (rt.name as string) || (rt.code as string),
      days,
    };
  });

  return { from, to, currency: "BTN", roomTypes: blocks };
}

export type CreateBookingForPropertyInput = {
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  extraBeds?: number;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  roomTypeId?: string | null;
  roomTypeCode?: string | null;
  mealPlanCode?: string | null;
  promoCode?: string | null;
  notes?: string | null;
  quotedTotalBtn?: number | null;
  mode: "hold" | "confirmed";
  externalRef?: string | null;
  channelSource?: string | null;
};

export type CreateBookingForPropertyResult = {
  bookingId: string;
  lookupToken: string;
  status: string;
  holdExpiresAt: string | null;
  paymentUrl: string | null;
  tokenAmount: number | null;
  quotedTotalBtn: number | null;
};

export async function createBookingForProperty(
  propertyId: string,
  input: CreateBookingForPropertyInput,
): Promise<CreateBookingForPropertyResult> {
  assertApiStayWindow(input.checkIn, input.checkOut);
  assertPhone(input.contactPhone);
  assertOptionalEmail(input.contactEmail ?? null);

  const rooms = Math.max(1, Math.min(6, Math.floor(input.rooms)));
  const adults = Math.max(1, Math.min(12, Math.floor(input.adults)));
  const children = Math.max(
    0,
    Math.min(MAX_CHILDREN, Math.floor(input.children || 0)),
  );
  const extraBedsRequested = Math.max(
    0,
    Math.min(MAX_EXTRA_BEDS, Math.floor(input.extraBeds || 0)),
  );

  if (input.mode === "confirmed") {
    const ref = (input.externalRef ?? "").trim();
    if (!ref) {
      throw new BookLibError(
        "VALIDATION",
        "external_ref is required for confirmed channel bookings.",
      );
    }
  }

  const admin = createSupabaseAdminClient();
  const stayNights = nightsBetween(input.checkIn, input.checkOut);
  const mealPlanCodeIn = (input.mealPlanCode ?? "EP").trim() || "EP";

  const addons = await resolveStayAddonsForBook(admin, propertyId, {
    mealPlanCode: mealPlanCodeIn,
    adults,
    children,
    extraBeds: extraBedsRequested,
    nights: stayNights,
  });

  const { data: roomTypes } = await admin
    .from("room_types")
    .select("id, code, unit_count")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest")
    .order("code");

  if (!roomTypes?.length) {
    throw new BookLibError("VALIDATION", "No rooms configured.");
  }

  const sold = await soldQtyByRoomType(
    admin,
    propertyId,
    input.checkIn,
    input.checkOut,
  );

  let assignedTypeId: string | null = null;
  if (input.roomTypeId) {
    const match = roomTypes.find((rt) => (rt.id as string) === input.roomTypeId);
    if (!match) {
      throw new BookLibError("SOLD_OUT", "Room type not available.");
    }
    const capacity = Number(match.unit_count ?? 0);
    const used = sold.get(match.id as string) ?? 0;
    if (capacity - used < rooms) {
      throw new BookLibError("SOLD_OUT", "Not enough rooms for those dates.");
    }
    assignedTypeId = match.id as string;
  } else if (input.roomTypeCode) {
    const match = roomTypes.find(
      (rt) => (rt.code as string) === input.roomTypeCode,
    );
    if (!match) {
      throw new BookLibError("SOLD_OUT", "Room type not available.");
    }
    const capacity = Number(match.unit_count ?? 0);
    const used = sold.get(match.id as string) ?? 0;
    if (capacity - used < rooms) {
      throw new BookLibError("SOLD_OUT", "Not enough rooms for those dates.");
    }
    assignedTypeId = match.id as string;
  } else {
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
    throw new BookLibError("SOLD_OUT", "Not enough rooms for those dates.");
  }

  const season = await resolveSeasonKind(admin, propertyId, input.checkIn);
  const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);
  const rateByType = await lookupRoomRatesBatch(admin, {
    propertyId,
    roomTypeIds: [assignedTypeId],
    seasonKind: season,
    rateTier: "public",
    adults,
  });
  const baseRate = rateByType.get(assignedTypeId) ?? null;
  if (baseRate == null) {
    throw new BookLibError("VALIDATION", "No public rate for this room type.");
  }
  const perNight = calculateRoomNightTax(baseRate, taxSettings).totalBtn;
  let quotedTotalBtn = roundBtn(
    perNight * stayNights * rooms +
      addons.mealPlanAmountBtn +
      addons.extraBedAmountBtn,
  );

  if (
    input.quotedTotalBtn != null &&
    Number.isFinite(input.quotedTotalBtn) &&
    Math.abs(Number(input.quotedTotalBtn) - quotedTotalBtn) > 1
  ) {
    throw new BookLibError(
      "QUOTE_MISMATCH",
      "Quoted total does not match current ERP rates.",
    );
  }

  // Final inventory recheck immediately before insert
  const soldAgain = await soldQtyByRoomType(
    admin,
    propertyId,
    input.checkIn,
    input.checkOut,
  );
  const matchRt = roomTypes.find((rt) => (rt.id as string) === assignedTypeId)!;
  const capacity = Number(matchRt.unit_count ?? 0);
  const usedAgain = soldAgain.get(assignedTypeId) ?? 0;
  if (capacity - usedAgain < rooms) {
    throw new BookLibError("SOLD_OUT", "Not enough rooms for those dates.");
  }

  let holdExpiresAt: string | null = null;
  let tokenRequired: number | null = null;
  const status = input.mode === "confirmed" ? "confirmed" : "held";
  const source = input.mode === "confirmed" ? "ota" : "client";
  const channelSource =
    (input.channelSource ?? "").trim() ||
    (input.mode === "confirmed" ? "channel_manager" : "website_api");
  const externalRef = (input.externalRef ?? "").trim() || null;

  if (input.mode === "hold") {
    const { hours } = await resolveHoldTtlHours(
      admin,
      propertyId,
      "client",
      input.checkIn,
    );
    holdExpiresAt = holdExpiresAtFromNow(hours);
    tokenRequired = await computeTokenRequiredBtn(admin, {
      propertyId,
      checkIn: input.checkIn,
      roomLines: [{ roomTypeId: assignedTypeId, qty: rooms }],
      adults,
      estimatedStayTotalBtn: quotedTotalBtn,
    });
  }

  const lookup = generateLookupToken();

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      property_id: propertyId,
      source,
      channel_source: channelSource,
      external_ref: externalRef,
      status,
      check_in: input.checkIn,
      check_out: input.checkOut,
      contact_name: input.contactName.trim(),
      contact_phone: input.contactPhone.trim(),
      contact_email: input.contactEmail?.trim() || null,
      adults,
      children,
      extra_beds: addons.extraBeds,
      rooms,
      notes: input.notes?.trim() || null,
      hold_expires_at: holdExpiresAt,
      token_required_btn: tokenRequired,
      payment_mode: input.mode === "hold" ? "partial" : "full",
      quoted_total_btn: quotedTotalBtn,
      meal_plan_code: addons.mealPlanCode,
      meal_plan_amount_btn: addons.mealPlanAmountBtn,
      extra_bed_amount_btn: addons.extraBedAmountBtn,
      api_lookup_token_hash: lookup.hash,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    if (bookingError?.code === "23505") {
      throw new BookLibError(
        "DUPLICATE_EXTERNAL_REF",
        "external_ref already exists for this hotel.",
      );
    }
    console.error("createBookingForProperty insert failed", bookingError);
    throw new BookLibError("VALIDATION", "Could not save booking.");
  }

  const promoCodeRaw = (input.promoCode ?? "").trim();
  if (promoCodeRaw && quotedTotalBtn > 0 && input.mode === "hold") {
    const redeemed = await redeemPromoCode(admin, {
      propertyId,
      code: promoCodeRaw,
      channel: "public_book",
      domain: "rooms",
      preDiscountBtn: quotedTotalBtn,
      guestKey: input.contactPhone,
      bookingId: booking.id as string,
      minNights: stayNights,
      stackPartner: false,
      createdBy: "website_api",
    });
    if (!redeemed.ok) {
      await admin.from("bookings").delete().eq("id", booking.id);
      throw new BookLibError(
        "VALIDATION",
        redeemed.error ?? "Promo code rejected.",
      );
    }
    const promoDiscountBtn = Number(redeemed.discount_btn ?? 0);
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
        promo_code_id: redeemed.promo_code_id ?? null,
        promo_discount_pct: promoDiscountPct,
        promo_discount_btn: promoDiscountBtn,
        promo_code_snapshot: redeemed.code ?? promoCodeRaw.toUpperCase(),
        quoted_total_btn: quotedTotalBtn,
      })
      .eq("id", booking.id);
  }

  const { error: linesError } = await admin.from("booking_rooms").insert({
    booking_id: booking.id,
    room_type_id: assignedTypeId,
    qty: rooms,
    inventory_kind: "sellable_guest",
  });

  if (linesError) {
    await admin.from("bookings").delete().eq("id", booking.id);
    throw new BookLibError("VALIDATION", "Could not hold rooms.");
  }

  await admin.from("booking_guests").insert({
    booking_id: booking.id,
    full_name: input.contactName.trim(),
  });

  let paymentUrl: string | null = null;
  if (input.mode === "hold") {
    const link = await ensurePaymentLinkForBooking(
      booking.id as string,
      propertyId,
    );
    paymentUrl = link ? `/pay/${link.token}` : null;
    await notifyNewBooking({
      bookingId: booking.id,
      contactName: input.contactName.trim(),
      contactPhone: input.contactPhone.trim(),
      contactEmail: input.contactEmail ?? null,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults,
      rooms,
      guideNumber: null,
      notes: `[HOLD website_api token Nu ${tokenRequired ?? 0}]`,
    });
  }

  return {
    bookingId: booking.id as string,
    lookupToken: lookup.token,
    status,
    holdExpiresAt,
    paymentUrl,
    tokenAmount: tokenRequired,
    quotedTotalBtn,
  };
}

export async function getBookingForApi(opts: {
  propertyId: string;
  bookingId: string;
  lookupToken: string;
}): Promise<{
  bookingId: string;
  status: string;
  checkIn: string;
  checkOut: string;
  holdExpiresAt: string | null;
  quotedTotalBtn: number | null;
  externalRef: string | null;
  channelSource: string | null;
} | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "id, status, check_in, check_out, hold_expires_at, quoted_total_btn, external_ref, channel_source, api_lookup_token_hash, property_id",
    )
    .eq("id", opts.bookingId)
    .eq("property_id", opts.propertyId)
    .maybeSingle();

  if (!data?.api_lookup_token_hash) return null;
  const expected = hashLookupToken(opts.lookupToken);
  if (!safeEqualHex(expected, data.api_lookup_token_hash as string)) {
    return null;
  }

  return {
    bookingId: data.id as string,
    status: data.status as string,
    checkIn: data.check_in as string,
    checkOut: data.check_out as string,
    holdExpiresAt: (data.hold_expires_at as string | null) ?? null,
    quotedTotalBtn:
      data.quoted_total_btn == null ? null : Number(data.quoted_total_btn),
    externalRef: (data.external_ref as string | null) ?? null,
    channelSource: (data.channel_source as string | null) ?? null,
  };
}

export async function listSellableRoomTypes(propertyId: string): Promise<
  { roomTypeId: string; code: string; name: string; unitCount: number }[]
> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("room_types")
    .select("id, code, name, unit_count")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest")
    .order("code");
  return (data ?? []).map((r) => ({
    roomTypeId: r.id as string,
    code: r.code as string,
    name: (r.name as string) || (r.code as string),
    unitCount: Number(r.unit_count ?? 0),
  }));
}
