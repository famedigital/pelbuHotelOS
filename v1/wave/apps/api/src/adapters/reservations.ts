import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";
import {
  isRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  roundBtn,
  type RateTier,
} from "./rates.js";
import { ensureOpenFolio } from "./folio-rpc.js";

const createSchema = z.object({
  idempotencyKey: z.string().uuid(),
  contactName: z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  rooms: z.number().int().min(1).default(1),
  roomTypeId: z.string().uuid().optional(),
  roomUnitId: z.string().uuid().optional(),
  assignNow: z.boolean().optional(),
  mealPlanCode: z.enum(["EP", "CP", "MAP", "AP", "BB"]).default("EP"),
  agentId: z.string().uuid().optional().nullable(),
  source: z
    .enum(["owner", "reservation", "agent", "mou_agent"])
    .default("reservation"),
  paymentMode: z
    .enum(["prepaid", "partial", "on_credit", "cash"])
    .default("cash"),
  guestOrigin: z
    .enum(["international", "regional", "official", "local"])
    .default("international"),
  intent: z.enum(["reserve", "confirm", "check_in"]).default("confirm"),
  notes: z.string().optional(),
  agreedNightlyRateBtn: z.number().nonnegative().optional(),
  rateTier: z
    .enum([
      "public",
      "friends",
      "family",
      "mutual_friends",
      "agents",
      "mou_agents",
    ])
    .optional(),
});

export type CreateReservationInput = z.infer<typeof createSchema>;

function mapBookingStatus(raw: string): string {
  const v = raw.toLowerCase();
  if (v === "checked_in") return "in_house";
  return v;
}

function rangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return aFrom < bTo && aTo > bFrom;
}

export async function listRoomTypes(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("room_types")
    .select("id, code, name, inventory_kind, unit_count")
    .eq("property_id", ctx.jwt.propertyId)
    .order("name");
  if (error) throw error;
  return {
    roomTypes: (data ?? []).map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      inventoryKind: r.inventory_kind as string,
      unitCount: Number(r.unit_count || 0),
      sellable: r.inventory_kind === "sellable_guest",
    })),
  };
}

export async function listReservations(
  ctx: AdapterCtx,
  query: {
    view?: string;
    q?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  let q = ctx.admin
    .from("bookings")
    .select(
      `id, confirmation_code, contact_name, contact_phone, contact_email, status,
       check_in, check_out, adults, children, rooms, meal_plan_code, quoted_total_btn,
       agent_id, source, guest_origin, notes, agents(company_name),
       room_assignments(room_unit_id, from_date, to_date, room_units(label))`,
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("check_in", { ascending: true })
    .limit(query.limit ?? 200);

  const view = query.view || "in_house";
  if (view === "arrivals") {
    q = q.eq("check_in", today).neq("status", "cancelled");
  } else if (view === "departures") {
    q = q.eq("check_out", today).neq("status", "cancelled");
  } else if (view === "in_house") {
    q = q.eq("status", "checked_in");
  } else if (view === "upcoming") {
    q = q.gt("check_in", today).neq("status", "cancelled");
  } else {
    q = q.neq("status", "cancelled");
  }

  if (query.from) q = q.gte("check_in", query.from);
  if (query.to) q = q.lte("check_out", query.to);

  const { data, error } = await q;
  if (error) throw error;

  let rows = data ?? [];
  if (query.q?.trim()) {
    const needle = query.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.confirmation_code || "")
          .toLowerCase()
          .includes(needle) ||
        String(r.contact_name || "")
          .toLowerCase()
          .includes(needle) ||
        String(r.contact_phone || "").includes(needle),
    );
  }

  return {
    view,
    asOf: today,
    reservations: rows.map((r) => {
      const assigns =
        (r.room_assignments as Array<{
          room_units?: { label?: string } | { label?: string }[] | null;
        }>) ?? [];
      const ru = assigns[0]?.room_units;
      const label = Array.isArray(ru) ? ru[0]?.label : ru?.label;
      const agent = r.agents as { company_name?: string } | null;
      return {
        id: r.id,
        confirmationCode: r.confirmation_code,
        guestName: r.contact_name,
        phone: r.contact_phone,
        email: r.contact_email,
        status: mapBookingStatus(String(r.status)),
        checkIn: r.check_in,
        checkOut: r.check_out,
        adults: r.adults,
        children: r.children,
        rooms: r.rooms,
        mealPlan: r.meal_plan_code,
        quotedTotalBtn: Number(r.quoted_total_btn || 0),
        agentName: agent?.company_name ?? null,
        agentId: r.agent_id,
        source: r.source,
        guestOrigin: r.guest_origin,
        roomLabel: label ?? null,
        notes: r.notes,
      };
    }),
  };
}

async function resolveRoomType(
  ctx: AdapterCtx,
  roomTypeId: string | undefined,
  roomUnitId: string | undefined,
): Promise<{
  id: string;
  inventory_kind: string;
  code: string;
}> {
  if (roomUnitId) {
    const { data: unit, error } = await ctx.admin
      .from("room_units")
      .select("id, room_type_id, room_types(id, code, inventory_kind)")
      .eq("id", roomUnitId)
      .eq("property_id", ctx.jwt.propertyId)
      .maybeSingle();
    if (error) throw error;
    if (!unit) throw new Error("Room unit not found for property");
    const rt = unit.room_types as
      | { id?: string; code?: string; inventory_kind?: string }
      | { id?: string; code?: string; inventory_kind?: string }[]
      | null;
    const row = Array.isArray(rt) ? rt[0] : rt;
    if (!row?.id) throw new Error("Room unit has no room type");
    return {
      id: row.id,
      inventory_kind: row.inventory_kind || "sellable_guest",
      code: row.code || "",
    };
  }

  if (roomTypeId) {
    const { data, error } = await ctx.admin
      .from("room_types")
      .select("id, code, inventory_kind")
      .eq("id", roomTypeId)
      .eq("property_id", ctx.jwt.propertyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Room type not found for property");
    return {
      id: data.id as string,
      inventory_kind: (data.inventory_kind as string) || "sellable_guest",
      code: (data.code as string) || "",
    };
  }

  const { data, error } = await ctx.admin
    .from("room_types")
    .select("id, code, inventory_kind")
    .eq("property_id", ctx.jwt.propertyId)
    .eq("inventory_kind", "sellable_guest")
    .order("name")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No sellable room types configured for property");
  return {
    id: data.id as string,
    inventory_kind: (data.inventory_kind as string) || "sellable_guest",
    code: (data.code as string) || "",
  };
}

async function assertUnitAvailable(
  ctx: AdapterCtx,
  roomUnitId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
): Promise<void> {
  const { data: busy, error } = await ctx.admin
    .from("room_assignments")
    .select("booking_id, from_date, to_date")
    .eq("property_id", ctx.jwt.propertyId)
    .eq("room_unit_id", roomUnitId)
    .lt("from_date", checkOut)
    .gt("to_date", checkIn);
  if (error) throw error;
  for (const row of busy ?? []) {
    if (excludeBookingId && row.booking_id === excludeBookingId) continue;
    if (
      rangesOverlap(
        checkIn,
        checkOut,
        row.from_date as string,
        row.to_date as string,
      )
    ) {
      throw new Error("Room unit is already assigned for these dates");
    }
  }
}

export async function createReservation(ctx: AdapterCtx, raw: unknown) {
  const input = createSchema.parse(raw);
  if (input.checkOut <= input.checkIn) {
    throw new Error("checkOut must be after checkIn");
  }

  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const roomType = await resolveRoomType(
    ctx,
    input.roomTypeId,
    input.roomUnitId,
  );
  if (input.roomUnitId) {
    await assertUnitAvailable(
      ctx,
      input.roomUnitId,
      input.checkIn,
      input.checkOut,
    );
  }

  const nights = nightsBetween(input.checkIn, input.checkOut);
  const tier: RateTier =
    input.rateTier && isRateTier(input.rateTier) ? input.rateTier : "public";
  const season = await resolveSeasonKind(
    ctx.admin,
    ctx.jwt.propertyId,
    input.checkIn,
  );
  const sheetRate = await lookupRoomRateBtn(ctx.admin, {
    propertyId: ctx.jwt.propertyId,
    roomTypeId: roomType.id,
    seasonKind: season,
    rateTier: tier,
    adults: input.adults,
  });

  const agreed =
    input.agreedNightlyRateBtn != null &&
    Number.isFinite(input.agreedNightlyRateBtn)
      ? roundBtn(input.agreedNightlyRateBtn)
      : null;
  const nightly = agreed ?? sheetRate ?? 0;
  const quoted = roundBtn(nightly * nights * input.rooms);

  const isHold = input.intent === "reserve";
  const holdExpiresAt = isHold
    ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  // Status before optional CI: never invent confirmation_code (DB trigger).
  const bookingStatus = isHold ? "held" : "confirmed";

  const { data: booking, error } = await ctx.admin
    .from("bookings")
    .insert({
      property_id: ctx.jwt.propertyId,
      contact_name: input.contactName.trim(),
      contact_phone: input.contactPhone?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      check_in: input.checkIn,
      check_out: input.checkOut,
      status: bookingStatus,
      confirmed_at: isHold ? null : new Date().toISOString(),
      confirmed_by: isHold ? null : "desk_v2_fast_book",
      hold_expires_at: holdExpiresAt,
      adults: input.adults,
      children: input.children,
      rooms: input.rooms,
      meal_plan_code: input.mealPlanCode,
      agent_id: input.agentId || null,
      source: input.source === "mou_agent" ? "agent" : input.source,
      booked_by_role: input.source,
      payment_mode: input.paymentMode,
      guest_origin: input.guestOrigin,
      notes: input.notes || null,
      quoted_total_btn: quoted > 0 ? quoted : null,
      agreed_nightly_rate_btn: agreed,
      agreed_rate_reason: agreed != null ? "desk override" : null,
      agreed_rate_set_at: agreed != null ? new Date().toISOString() : null,
      sheet_rate_tier: tier,
    })
    .select("id, confirmation_code, status, check_in, check_out")
    .single();

  if (error || !booking) {
    console.error("[createReservation] booking insert failed", error);
    throw new Error(error?.message ?? "Could not save booking.");
  }

  const occupancy: "single" | "double" =
    input.adults <= 1 ? "single" : "double";

  const { error: linesError } = await ctx.admin.from("booking_rooms").insert({
    booking_id: booking.id,
    room_type_id: roomType.id,
    qty: input.rooms,
    inventory_kind: roomType.inventory_kind,
    meal_plan_code: input.mealPlanCode,
    occupancy,
    adults: input.adults,
    children: input.children,
    extra_beds: 0,
    sheet_nightly_rate_btn: sheetRate,
    agreed_nightly_rate_btn: agreed,
    rate_request_status: "none",
  });

  if (linesError) {
    console.error("[createReservation] booking_rooms failed", linesError);
    await ctx.admin.from("bookings").delete().eq("id", booking.id);
    throw new Error(linesError.message ?? "Could not save room lines.");
  }

  const shouldAssign = Boolean(input.roomUnitId) || input.assignNow === true;
  let assignedUnitId: string | null = null;

  if (shouldAssign && input.roomUnitId) {
    const { error: aErr } = await ctx.admin.from("room_assignments").insert({
      property_id: ctx.jwt.propertyId,
      booking_id: booking.id,
      room_unit_id: input.roomUnitId,
      from_date: input.checkIn,
      to_date: input.checkOut,
    });
    if (aErr) {
      console.error("[createReservation] assign failed", aErr);
      await ctx.admin.from("booking_rooms").delete().eq("booking_id", booking.id);
      await ctx.admin.from("bookings").delete().eq("id", booking.id);
      throw new Error(aErr.message ?? "Could not assign room.");
    }
    assignedUnitId = input.roomUnitId;
  } else if (shouldAssign) {
    // Auto-pick first free unit of this type for the stay window.
    const { data: units, error: uErr } = await ctx.admin
      .from("room_units")
      .select("id")
      .eq("property_id", ctx.jwt.propertyId)
      .eq("room_type_id", roomType.id)
      .order("label");
    if (uErr) throw uErr;

    const { data: busy } = await ctx.admin
      .from("room_assignments")
      .select("room_unit_id, from_date, to_date")
      .eq("property_id", ctx.jwt.propertyId)
      .lt("from_date", input.checkOut)
      .gt("to_date", input.checkIn);

    const occupied = new Set<string>();
    for (const row of busy ?? []) {
      if (
        rangesOverlap(
          input.checkIn,
          input.checkOut,
          row.from_date as string,
          row.to_date as string,
        )
      ) {
        occupied.add(row.room_unit_id as string);
      }
    }

    const free = (units ?? []).find((u) => !occupied.has(u.id as string));
    if (!free) {
      await ctx.admin.from("booking_rooms").delete().eq("booking_id", booking.id);
      await ctx.admin.from("bookings").delete().eq("id", booking.id);
      throw new Error("No free room unit for these dates.");
    }

    const { error: aErr } = await ctx.admin.from("room_assignments").insert({
      property_id: ctx.jwt.propertyId,
      booking_id: booking.id,
      room_unit_id: free.id,
      from_date: input.checkIn,
      to_date: input.checkOut,
    });
    if (aErr) {
      await ctx.admin.from("booking_rooms").delete().eq("booking_id", booking.id);
      await ctx.admin.from("bookings").delete().eq("id", booking.id);
      throw new Error(aErr.message ?? "Could not assign room.");
    }
    assignedUnitId = free.id as string;
  }

  let status = booking.status as string;
  let folioId: string | null = null;

  if (input.intent === "check_in") {
    const { data: rpcRaw, error: ciErr } = await ctx.admin.rpc(
      "check_in_guest_atomic",
      {
        p_property_id: ctx.jwt.propertyId,
        p_booking_id: booking.id,
        p_idempotency_key: input.idempotencyKey,
        p_room_unit_id: assignedUnitId,
      },
    );
    if (ciErr) {
      console.error("[createReservation] check_in_guest_atomic failed", ciErr);
      throw new Error(ciErr.message ?? "Check-in failed.");
    }
    const rpc = (rpcRaw ?? {}) as { status?: string };
    status = rpc.status || "checked_in";
    folioId = await ensureOpenFolio(ctx, booking.id as string);
  }

  const result = {
    ok: true,
    bookingId: booking.id as string,
    confirmationCode: booking.confirmation_code as string,
    status,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    intent: input.intent,
    roomTypeId: roomType.id,
    roomUnitId: assignedUnitId,
    quotedTotalBtn: quoted,
    sheetNightlyRateBtn: sheetRate,
    folioId,
  };

  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "create_reservation",
    result,
  );
  return result;
}

export async function cancelReservation(
  ctx: AdapterCtx,
  bookingId: string,
  idempotencyKey: string,
) {
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { data: booking, error: bErr } = await ctx.admin
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "checked_out") {
    throw new Error("Cannot cancel a checked-out stay");
  }

  const { error } = await ctx.admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("property_id", ctx.jwt.propertyId);
  if (error) throw error;

  await ctx.admin
    .from("room_assignments")
    .delete()
    .eq("booking_id", bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .eq("is_locked", false);

  const result = { ok: true, bookingId, status: "cancelled" };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    idempotencyKey,
    "cancel_reservation",
    result,
  );
  return result;
}

export async function markNoShow(
  ctx: AdapterCtx,
  bookingId: string,
  idempotencyKey: string,
) {
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { error } = await ctx.admin
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .neq("status", "checked_in")
    .neq("status", "checked_out");
  if (error) throw error;

  const result = { ok: true, bookingId, status: "no_show" };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    idempotencyKey,
    "mark_no_show",
    result,
  );
  return result;
}
