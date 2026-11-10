import { z } from "zod";
import { settleStayCheckout } from "@hotel-os/core";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";
import { ensureOpenFolio } from "./folio-rpc.js";
import { getFolioBalance } from "./folio.js";

function rangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return aFrom < bTo && aTo > bFrom;
}

export async function getStaySummary(ctx: AdapterCtx, bookingId: string) {
  const { data: booking, error } = await ctx.admin
    .from("bookings")
    .select(
      `id, confirmation_code, contact_name, contact_phone, contact_email, status,
       check_in, check_out, adults, children, rooms, meal_plan_code, quoted_total_btn,
       agreed_nightly_rate_btn, agent_id, source, guest_origin, notes, payment_mode,
       agents(company_name),
       room_assignments(id, room_unit_id, from_date, to_date, room_units(id, label, hk_status))`,
    )
    .eq("id", bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!booking) throw new Error("Stay not found");

  const { data: lines } = await ctx.admin
    .from("folio_lines")
    .select(
      "id, description, total_btn, amount_btn, source_type, status, created_at",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(80);

  const { data: payments } = await ctx.admin
    .from("payments")
    .select("id, amount_btn, method, created_at, confirmation_status")
    .eq("booking_id", bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .order("created_at", { ascending: false })
    .limit(40);

  const balance = await getFolioBalance(ctx, bookingId);

  return {
    bookingId: booking.id,
    confirmationCode: booking.confirmation_code,
    guestName: booking.contact_name,
    phone: booking.contact_phone,
    email: booking.contact_email,
    status: booking.status,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    adults: booking.adults,
    children: booking.children,
    rooms: booking.rooms,
    mealPlan: booking.meal_plan_code,
    quotedTotalBtn: Number(booking.quoted_total_btn || 0),
    agreedNightlyRateBtn: booking.agreed_nightly_rate_btn
      ? Number(booking.agreed_nightly_rate_btn)
      : null,
    agentName:
      (booking.agents as { company_name?: string } | null)?.company_name ??
      null,
    source: booking.source,
    guestOrigin: booking.guest_origin,
    notes: booking.notes,
    paymentMode: booking.payment_mode,
    assignments: booking.room_assignments ?? [],
    folioLines: lines ?? [],
    payments: payments ?? [],
    balanceBtn: balance.balanceBtn,
    chargesBtn: balance.chargesBtn,
    paidBtn: balance.paidBtn,
  };
}

async function assignUnitDated(
  ctx: AdapterCtx,
  args: {
    bookingId: string;
    roomUnitId: string;
    checkIn: string;
    checkOut: string;
  },
): Promise<void> {
  const { data: busy, error: busyErr } = await ctx.admin
    .from("room_assignments")
    .select("booking_id, from_date, to_date")
    .eq("property_id", ctx.jwt.propertyId)
    .eq("room_unit_id", args.roomUnitId)
    .lt("from_date", args.checkOut)
    .gt("to_date", args.checkIn);
  if (busyErr) throw busyErr;
  for (const row of busy ?? []) {
    if (row.booking_id === args.bookingId) continue;
    if (
      rangesOverlap(
        args.checkIn,
        args.checkOut,
        row.from_date as string,
        row.to_date as string,
      )
    ) {
      throw new Error("Room unit is already assigned for these dates");
    }
  }

  const { data: unit, error: uErr } = await ctx.admin
    .from("room_units")
    .select("id")
    .eq("id", args.roomUnitId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!unit) throw new Error("Room unit not found for property");

  await ctx.admin
    .from("room_assignments")
    .delete()
    .eq("booking_id", args.bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .eq("is_locked", false);

  const { error } = await ctx.admin.from("room_assignments").insert({
    property_id: ctx.jwt.propertyId,
    booking_id: args.bookingId,
    room_unit_id: args.roomUnitId,
    from_date: args.checkIn,
    to_date: args.checkOut,
  });
  if (error) {
    console.error("[assignUnitDated]", error);
    throw new Error(error.message ?? "Could not assign room");
  }
}

const checkInSchema = z.object({
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  roomUnitId: z.string().uuid().optional(),
});

export async function checkInStay(ctx: AdapterCtx, raw: unknown) {
  const input = checkInSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { data: booking, error: bErr } = await ctx.admin
    .from("bookings")
    .select("id, status, check_in, check_out")
    .eq("id", input.bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled" || booking.status === "checked_out") {
    throw new Error(`Cannot check in from status ${booking.status}`);
  }
  if (booking.status === "checked_in") {
    const folioId = await ensureOpenFolio(ctx, input.bookingId);
    const result = {
      ok: true,
      bookingId: input.bookingId,
      status: "checked_in",
      folioId,
      alreadyInHouse: true,
    };
    await saveIdempotent(
      ctx.admin,
      ctx.jwt.propertyId,
      input.idempotencyKey,
      "check_in",
      result,
    );
    return result;
  }

  if (input.roomUnitId) {
    await assignUnitDated(ctx, {
      bookingId: input.bookingId,
      roomUnitId: input.roomUnitId,
      checkIn: booking.check_in as string,
      checkOut: booking.check_out as string,
    });
  }

  const { data: rpcRaw, error: rpcErr } = await ctx.admin.rpc(
    "check_in_guest_atomic",
    {
      p_property_id: ctx.jwt.propertyId,
      p_booking_id: input.bookingId,
      p_idempotency_key: input.idempotencyKey,
      p_room_unit_id: input.roomUnitId ?? null,
    },
  );
  if (rpcErr) {
    console.error("[checkInStay] check_in_guest_atomic failed", rpcErr);
    throw new Error(rpcErr.message ?? "Check-in failed");
  }

  const folioId = await ensureOpenFolio(ctx, input.bookingId);
  const rpc = (rpcRaw ?? {}) as {
    status?: string;
    already_exists?: boolean;
  };

  const result = {
    ok: true,
    bookingId: input.bookingId,
    status: rpc.status || "checked_in",
    folioId,
    alreadyExists: Boolean(rpc.already_exists),
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "check_in",
    result,
  );
  return result;
}

const assignSchema = z.object({
  bookingId: z.string().uuid(),
  roomUnitId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export async function assignRoom(ctx: AdapterCtx, raw: unknown) {
  const input = assignSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { data: booking, error: bErr } = await ctx.admin
    .from("bookings")
    .select("id, status, check_in, check_out")
    .eq("id", input.bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled" || booking.status === "checked_out") {
    throw new Error(`Cannot assign room when status is ${booking.status}`);
  }

  await assignUnitDated(ctx, {
    bookingId: input.bookingId,
    roomUnitId: input.roomUnitId,
    checkIn: booking.check_in as string,
    checkOut: booking.check_out as string,
  });

  const result = {
    ok: true,
    bookingId: input.bookingId,
    roomUnitId: input.roomUnitId,
    fromDate: booking.check_in,
    toDate: booking.check_out,
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "assign_room",
    result,
  );
  return result;
}

const rateSchema = z.object({
  bookingId: z.string().uuid(),
  agreedNightlyRateBtn: z.number().nonnegative(),
  idempotencyKey: z.string().uuid(),
});

export async function updateStayRate(ctx: AdapterCtx, raw: unknown) {
  const input = rateSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { error } = await ctx.admin
    .from("bookings")
    .update({
      agreed_nightly_rate_btn: input.agreedNightlyRateBtn,
      agreed_rate_reason: "desk override",
      agreed_rate_set_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .eq("property_id", ctx.jwt.propertyId);
  if (error) throw error;

  const result = {
    ok: true,
    bookingId: input.bookingId,
    agreedNightlyRateBtn: input.agreedNightlyRateBtn,
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "update_rate",
    result,
  );
  return result;
}

const checkoutSchema = z.object({
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  allowBalance: z.boolean().optional().default(false),
  earlyCheckoutFeeBtn: z.number().nonnegative().optional(),
  lateCheckoutFeeBtn: z.number().nonnegative().optional(),
});

/**
 * Checkout through `@hotel-os/core` `settleStayCheckout` — Innora rules:
 * guide-evidence gate, early/late fee via the GL charge path, balance check
 * (agent on-credit residual allowed), master-bill folio close, then
 * `settle_checkout_atomic`, dirty rooms and an audit event.
 */
export async function checkoutStay(ctx: AdapterCtx, raw: unknown) {
  const input = checkoutSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const settled = await settleStayCheckout(ctx.admin, ctx.jwt.propertyId, {
    bookingId: input.bookingId,
    idempotencyKey: input.idempotencyKey,
    allowBalance: input.allowBalance ?? false,
    earlyCheckoutFeeBtn: input.earlyCheckoutFeeBtn ?? null,
    lateCheckoutFeeBtn: input.lateCheckoutFeeBtn ?? null,
    actor: `v2:${ctx.jwt.staffId}`,
    period_guard: {
      propertyId: ctx.jwt.propertyId,
      actor: `v2:${ctx.jwt.staffId}`,
    },
  });

  const result = {
    ok: true,
    bookingId: settled.bookingId,
    status: "checked_out",
    folioId: settled.folioId,
    balanceBtn: settled.balanceBtn,
    roomsDirtied: settled.roomsDirtied,
    alreadyExists: settled.alreadyExists,
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "checkout",
    result,
  );
  return result;
}
