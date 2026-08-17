import "server-only";
import { postFolioCharge } from "@/lib/folio/post-charge";
import {
  applyDiscountPct,
  resolveBookingPartnerDiscountPct,
} from "@/lib/partners/discount";
import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import {
  agentRateTier,
  lookupRoomRateBtn,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RoomNightPostResult = {
  posted: number;
  skipped: number;
  errors: string[];
};

function rateTierFromSource(source: string): RateTier {
  if (source === "mou_agent") return "mou_agents";
  if (source === "agent") return "agents";
  return "public";
}

async function ensureOpenFolio(
  admin: Admin,
  propertyId: string,
  bookingId: string,
  label: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: folio, error } = await admin
    .from("folios")
    .insert({
      property_id: propertyId,
      booking_id: bookingId,
      folio_type: "guest",
      label,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !folio) throw new Error("Could not open guest folio.");
  return folio.id as string;
}

type OccupiedRoom = {
  assignmentId: string;
  bookingId: string;
  roomUnitId: string;
  roomLabel: string;
  roomTypeId: string;
  contactName: string;
  checkIn: string;
  source: string;
  agentRateTier: string | null;
  chargeable: boolean;
  ncReasonCode: string | null;
  promoDiscountPct: number;
  promoCodeId: string | null;
  adults: number;
  /** Manager-approved special nightly rate (BTN, rate-sheet tax basis). */
  agreedNightlyRateBtn: number | null;
};

/**
 * Post day-1 room nights for a single booking (arrival business date).
 * Used at check-in; night audit re-run is safe (idempotent skip).
 */
export async function postRoomNightsForBooking(
  admin: Admin,
  propertyId: string,
  bookingId: string,
  businessDate: string,
): Promise<RoomNightPostResult> {
  return postRoomNightsForDate(admin, propertyId, businessDate, {
    bookingId,
  });
}

/**
 * Post one room-night folio line per occupied sellable room for businessDate.
 * Idempotent via DB unique (folio_id, business_date, room_unit_id).
 * Rates always resolve from live `room_rates` (same sheet as `/erp/rates`).
 */
export async function postRoomNightsForDate(
  admin: Admin,
  propertyId: string,
  businessDate: string,
  opts?: { bookingId?: string },
): Promise<RoomNightPostResult> {
  const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);
  const seasonKind = await resolveSeasonKind(admin, propertyId, businessDate);

  const { data: assignments, error: assignError } = await admin
    .from("room_assignments")
    .select(
      `id, booking_id, room_unit_id, from_date, to_date, chargeable, nc_reason_code,
       room_units(id, label, room_type_id, room_types(inventory_kind)),
       bookings!inner(
         id, status, check_in, check_out, contact_name, source, agent_id,
         adults, promo_discount_pct, promo_code_id, agreed_nightly_rate_btn,
         agents(rate_tier)
       )`,
    )
    .eq("property_id", propertyId)
    .lte("from_date", businessDate)
    .gt("to_date", businessDate);

  if (assignError) {
    return { posted: 0, skipped: 0, errors: [assignError.message] };
  }

  const rooms: OccupiedRoom[] = [];
  for (const row of assignments ?? []) {
    const bookingRaw = row.bookings as
      | {
          id: string;
          status: string;
          check_in: string;
          check_out: string;
          contact_name: string | null;
          source: string | null;
          agent_id: string | null;
          adults?: number | null;
          agreed_nightly_rate_btn?: number | null;
          agents?:
            | { rate_tier?: string | null }
            | { rate_tier?: string | null }[]
            | null;
        }
      | {
          id: string;
          status: string;
          check_in: string;
          check_out: string;
          contact_name: string | null;
          source: string | null;
          agent_id: string | null;
          adults?: number | null;
          agreed_nightly_rate_btn?: number | null;
          agents?:
            | { rate_tier?: string | null }
            | { rate_tier?: string | null }[]
            | null;
        }[]
      | null;
    const booking = Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw;
    if (!booking || booking.status !== "checked_in") continue;
    if (opts?.bookingId && booking.id !== opts.bookingId) continue;
    if (businessDate < String(booking.check_in).slice(0, 10)) continue;
    if (businessDate >= String(booking.check_out).slice(0, 10)) continue;

    const unitRaw = row.room_units as
      | {
          id: string;
          label: string;
          room_type_id: string;
          room_types?:
            | { inventory_kind?: string }
            | { inventory_kind?: string }[]
            | null;
        }
      | {
          id: string;
          label: string;
          room_type_id: string;
          room_types?:
            | { inventory_kind?: string }
            | { inventory_kind?: string }[]
            | null;
        }[]
      | null;
    const unit = Array.isArray(unitRaw) ? unitRaw[0] : unitRaw;
    if (!unit) continue;
    const rt = unit.room_types;
    const kind = (
      Array.isArray(rt) ? rt[0]?.inventory_kind : rt?.inventory_kind
    ) as string | undefined;
    if (kind !== "sellable_guest") continue;

    const agentRaw = booking.agents;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

    rooms.push({
      assignmentId: row.id as string,
      bookingId: booking.id,
      roomUnitId: unit.id,
      roomLabel: unit.label,
      roomTypeId: unit.room_type_id,
      contactName: booking.contact_name ?? "Guest",
      checkIn: booking.check_in,
      source: booking.source ?? "direct",
      agentRateTier: (agent?.rate_tier as string | null) ?? null,
      chargeable: row.chargeable !== false,
      ncReasonCode: (row.nc_reason_code as string | null) ?? null,
      promoDiscountPct: Number(
        (booking as { promo_discount_pct?: number | null }).promo_discount_pct ??
          0,
      ),
      promoCodeId:
        ((booking as { promo_code_id?: string | null }).promo_code_id as
          | string
          | null) ?? null,
      adults: Math.max(1, Number(booking.adults ?? 2)),
      agreedNightlyRateBtn:
        booking.agreed_nightly_rate_btn != null
          ? Number(booking.agreed_nightly_rate_btn)
          : null,
    });
  }

  // Prefer approved per-category rates on booking_rooms when present.
  const bookingIds = [...new Set(rooms.map((r) => r.bookingId))];
  const lineRateByBookingType = new Map<string, number>();
  if (bookingIds.length > 0) {
    const { data: brRows } = await admin
      .from("booking_rooms")
      .select(
        "booking_id, room_type_id, agreed_nightly_rate_btn, rate_request_status",
      )
      .in("booking_id", bookingIds);
    for (const br of brRows ?? []) {
      const status = (br.rate_request_status as string | null) ?? "none";
      if (status === "pending" || status === "rejected") continue;
      const agreed =
        br.agreed_nightly_rate_btn != null
          ? Number(br.agreed_nightly_rate_btn)
          : null;
      if (agreed == null || !Number.isFinite(agreed) || agreed < 0) continue;
      // approved or none-with-agreed (legacy backfill)
      if (status === "approved" || status === "none") {
        lineRateByBookingType.set(
          `${br.booking_id as string}:${br.room_type_id as string}`,
          agreed,
        );
      }
    }
    for (const room of rooms) {
      const lineRate = lineRateByBookingType.get(
        `${room.bookingId}:${room.roomTypeId}`,
      );
      if (lineRate != null) {
        room.agreedNightlyRateBtn = lineRate;
      }
    }
  }

  let posted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const room of rooms) {
    // NC / house-use: skip folio charge, still counts as occupied elsewhere
    if (!room.chargeable) {
      skipped += 1;
      continue;
    }

    const tier = room.agentRateTier
      ? agentRateTier(room.agentRateTier)
      : rateTierFromSource(room.source);

    let rate =
      room.agreedNightlyRateBtn != null && room.agreedNightlyRateBtn >= 0
        ? room.agreedNightlyRateBtn
        : await lookupRoomRateBtn(admin, {
            propertyId,
            roomTypeId: room.roomTypeId,
            seasonKind,
            rateTier: tier,
            adults: room.adults,
          });
    if (rate == null) {
      errors.push(`Room ${room.roomLabel}: no rate for ${tier}/${seasonKind}.`);
      continue;
    }

    // Promo + partner discounts apply to sheet rates only.
    // Agreed/special rate is already negotiated — do not stack promo/partner.
    let listedAmountBtn = roundBtn(rate);
    const usedAgreed =
      room.agreedNightlyRateBtn != null && room.agreedNightlyRateBtn >= 0;
    let promoNote = "";
    let partnerNote = "";
    if (!usedAgreed) {
      if (room.promoDiscountPct > 0) {
        listedAmountBtn = roundBtn(
          listedAmountBtn * (1 - Math.min(100, room.promoDiscountPct) / 100),
        );
        promoNote = ` · promo −${room.promoDiscountPct}%`;
      }
      const partner = await resolveBookingPartnerDiscountPct(
        admin,
        room.bookingId,
      );
      if (partner.pct > 0) {
        listedAmountBtn = applyDiscountPct(listedAmountBtn, partner.pct);
        partnerNote = ` · partner −${partner.pct}%`;
      }
    } else {
      partnerNote = " · agreed rate";
    }

    const tax = calculateRoomNightTax(listedAmountBtn, taxSettings);
    const amountBtn = tax.amountBtn;
    const serviceChargeRate = tax.serviceChargeRate;
    const serviceChargeBtn = tax.serviceChargeBtn;
    const serviceChargeApplied = tax.serviceChargeApplied;
    const gstBtn = tax.gstBtn;
    const totalBtn = tax.totalBtn;

    const folioLabel = `${room.contactName} · Room ${room.roomLabel}`;
    let folioId: string;
    try {
      folioId = await ensureOpenFolio(admin, propertyId, room.bookingId, folioLabel);
    } catch (e) {
      errors.push(
        `Room ${room.roomLabel}: ${e instanceof Error ? e.message : "folio error"}.`,
      );
      continue;
    }

    const { data: existingLine } = await admin
      .from("folio_lines")
      .select("id")
      .eq("folio_id", folioId)
      .eq("business_date", businessDate)
      .eq("room_unit_id", room.roomUnitId)
      .eq("source_type", "room")
      .eq("status", "posted")
      .maybeSingle();
    if (existingLine) {
      skipped += 1;
      continue;
    }

    const description = `Room ${room.roomLabel} · ${businessDate}${promoNote}${partnerNote}`;

    try {
      await postFolioCharge(admin, propertyId, {
        folio_id: folioId,
        booking_id: room.bookingId,
        source_type: "room",
        source_id: room.assignmentId,
        description,
        qty: 1,
        unit_price_btn: amountBtn,
        amount_btn: amountBtn,
        service_charge_rate: serviceChargeRate,
        service_charge_btn: serviceChargeBtn,
        service_charge_applied: serviceChargeApplied,
        gst_applicable: gstBtn > 0,
        gst_btn: gstBtn,
        total_btn: totalBtn,
        business_date: businessDate,
        room_unit_id: room.roomUnitId,
        journal_date: businessDate,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "post failed";
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
        skipped += 1;
        continue;
      }
      errors.push(`Room ${room.roomLabel}: ${msg}`);
      continue;
    }

    posted += 1;
  }

  return { posted, skipped, errors };
}
