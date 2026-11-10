import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";
import { roundBtn } from "./rates.js";

export async function listPendingRateApprovals(ctx: AdapterCtx) {
  const { data: lines, error } = await ctx.admin
    .from("booking_rooms")
    .select(
      `id, booking_id, room_type_id, agreed_nightly_rate_btn, sheet_nightly_rate_btn,
       rate_request_status, rate_request_reason,
       bookings!inner(id, confirmation_code, contact_name, status, property_id, check_in, check_out)`,
    )
    .eq("bookings.property_id", ctx.jwt.propertyId)
    .eq("rate_request_status", "pending")
    .order("booking_id")
    .limit(100);

  if (error) {
    console.error("[listPendingRateApprovals]", error);
    throw new Error(error.message ?? "Could not load rate approvals");
  }

  return {
    pending: (lines ?? []).map((row) => {
      const raw = row.bookings as unknown;
      const booking = (
        Array.isArray(raw) ? raw[0] : raw
      ) as {
        id: string;
        confirmation_code: string;
        contact_name: string;
        status: string;
        check_in: string;
        check_out: string;
      } | null;
      if (!booking) {
        throw new Error("Pending rate line missing booking join");
      }
      return {
        lineId: row.id as string,
        bookingId: booking.id,
        confirmationCode: booking.confirmation_code,
        guestName: booking.contact_name,
        bookingStatus: booking.status,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        roomTypeId: row.room_type_id as string | null,
        agreedNightlyRateBtn:
          row.agreed_nightly_rate_btn != null
            ? Number(row.agreed_nightly_rate_btn)
            : null,
        sheetNightlyRateBtn:
          row.sheet_nightly_rate_btn != null
            ? Number(row.sheet_nightly_rate_btn)
            : null,
        reason: row.rate_request_reason as string | null,
      };
    }),
  };
}

const decideSchema = z.object({
  lineId: z.string().uuid(),
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export async function approveRateRequest(ctx: AdapterCtx, raw: unknown) {
  const input = decideSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { data: booking, error: bErr } = await ctx.admin
    .from("bookings")
    .select("id, status, contact_name")
    .eq("id", input.bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!booking) throw new Error("Booking not found for property");

  const { data: line, error: lErr } = await ctx.admin
    .from("booking_rooms")
    .select(
      "id, booking_id, agreed_nightly_rate_btn, sheet_nightly_rate_btn, rate_request_status",
    )
    .eq("id", input.lineId)
    .eq("booking_id", input.bookingId)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!line) throw new Error("Room line not found");
  if ((line.rate_request_status as string) !== "pending") {
    throw new Error("Only pending rate requests can be approved");
  }
  if (line.agreed_nightly_rate_btn == null) {
    throw new Error("No requested rate on this line");
  }

  const { error: upErr } = await ctx.admin
    .from("booking_rooms")
    .update({
      rate_request_status: "approved",
      rate_request_reason: input.note ?? "GM approved",
      agreed_nightly_rate_btn: roundBtn(Number(line.agreed_nightly_rate_btn)),
    })
    .eq("id", input.lineId)
    .eq("booking_id", input.bookingId);
  if (upErr) {
    console.error("[approveRateRequest] line update", upErr);
    throw new Error(upErr.message ?? "Could not approve rate line");
  }

  const { data: siblings } = await ctx.admin
    .from("booking_rooms")
    .select("id, rate_request_status")
    .eq("booking_id", input.bookingId);
  const stillPending = (siblings ?? []).some(
    (s) => (s.rate_request_status as string) === "pending",
  );

  let bookingConfirmed = false;
  if (
    !stillPending &&
    (booking.status === "held" || booking.status === "pending")
  ) {
    const { error: bookErr } = await ctx.admin
      .from("bookings")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: "rate_approval",
        hold_expires_at: null,
      })
      .eq("id", input.bookingId)
      .eq("property_id", ctx.jwt.propertyId);
    if (bookErr) {
      console.error("[approveRateRequest] booking confirm", bookErr);
      throw new Error("Rate approved but could not confirm stay");
    }
    bookingConfirmed = true;
  }

  const result = {
    ok: true,
    lineId: input.lineId,
    bookingId: input.bookingId,
    stillPending,
    bookingConfirmed,
    message: stillPending
      ? "Line approved — other categories still pending."
      : bookingConfirmed
        ? "Rate approved · booking confirmed."
        : "Rate approved.",
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "rate_approve",
    result,
  );
  return result;
}

export async function rejectRateRequest(ctx: AdapterCtx, raw: unknown) {
  const input = decideSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const { data: booking, error: bErr } = await ctx.admin
    .from("bookings")
    .select("id")
    .eq("id", input.bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!booking) throw new Error("Booking not found for property");

  const { data: line, error: lErr } = await ctx.admin
    .from("booking_rooms")
    .select("id, rate_request_status")
    .eq("id", input.lineId)
    .eq("booking_id", input.bookingId)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!line) throw new Error("Room line not found");
  if ((line.rate_request_status as string) !== "pending") {
    throw new Error("Only pending rate requests can be rejected");
  }

  const { error: upErr } = await ctx.admin
    .from("booking_rooms")
    .update({
      rate_request_status: "rejected",
      rate_request_reason: input.note ?? "GM rejected",
    })
    .eq("id", input.lineId)
    .eq("booking_id", input.bookingId);
  if (upErr) {
    console.error("[rejectRateRequest]", upErr);
    throw new Error(upErr.message ?? "Could not reject rate line");
  }

  const result = {
    ok: true,
    lineId: input.lineId,
    bookingId: input.bookingId,
    message: "Rate request rejected.",
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "rate_reject",
    result,
  );
  return result;
}
