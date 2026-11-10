import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";
import {
  assertBookingOwned,
  ensureOpenFolio,
  postChargeAtomic,
  postPaymentAtomic,
} from "./folio-rpc.js";

/**
 * Charges and payments go through `@hotel-os/core` (via ./folio-rpc) — the
 * same period lock, atomic RPC, GL journal and round-off absorb as Innora.
 */
const chargeSchema = z
  .object({
    bookingId: z.string().uuid(),
    description: z.string().min(1),
    /** Guest-facing total (BTN). Negative only for `adjustment` (hotel credit). */
    amountBtn: z.number(),
    /** GST already inside `amountBtn`; journals to GST output. */
    gstBtn: z.number().nonnegative().optional(),
    kind: z.enum(["room", "order", "service", "adjustment"]).default("service"),
    businessDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    idempotencyKey: z.string().uuid(),
  })
  .refine((v) => Math.abs(v.amountBtn) >= 0.01, {
    message: "Amount must be non-zero",
    path: ["amountBtn"],
  })
  .refine((v) => v.kind === "adjustment" || v.amountBtn > 0, {
    message: "Only adjustments can be negative — record payments via /v1/folio/payment",
    path: ["amountBtn"],
  });

export async function postFolioCharge(ctx: AdapterCtx, raw: unknown) {
  const input = chargeSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const folioId = await ensureOpenFolio(ctx, input.bookingId);
  const posted = await postChargeAtomic(ctx, {
    folioId,
    bookingId: input.bookingId,
    idempotencyKey: input.idempotencyKey,
    description: input.description,
    amountBtn: input.amountBtn,
    gstBtn: input.gstBtn,
    sourceType: input.kind,
    businessDate: input.businessDate ?? null,
  });

  const result = {
    ok: true,
    folioLineId: posted.folioLineId,
    folioId: posted.folioId,
    amountBtn: posted.amountBtn,
    gstBtn: posted.gstBtn,
    description: posted.description,
    alreadyExists: posted.alreadyExists,
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "folio_charge",
    result,
  );
  return result;
}

const paySchema = z.object({
  bookingId: z.string().uuid(),
  amountBtn: z.number().positive(),
  method: z.enum(["cash", "card", "transfer", "mbob", "agent_credit", "other"]),
  kind: z.enum(["settlement", "deposit"]).default("settlement"),
  reference: z.string().max(200).optional(),
  idempotencyKey: z.string().uuid(),
  note: z.string().optional(),
});

export async function postFolioPayment(ctx: AdapterCtx, raw: unknown) {
  const input = paySchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const folioId = await ensureOpenFolio(ctx, input.bookingId);
  const paid = await postPaymentAtomic(ctx, {
    folioId,
    bookingId: input.bookingId,
    idempotencyKey: input.idempotencyKey,
    amountBtn: input.amountBtn,
    method: input.method,
    kind: input.kind,
    reference: input.reference ?? null,
    notes: input.note ?? null,
  });

  const result = {
    ok: true,
    paymentId: paid.paymentId,
    folioId: paid.folioId,
    folioLineId: paid.folioLineId,
    amountBtn: paid.amountBtn,
    alreadyExists: paid.alreadyExists,
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "folio_payment",
    result,
  );
  return result;
}

export async function getFolioBalance(ctx: AdapterCtx, bookingId: string) {
  await assertBookingOwned(ctx, bookingId);

  const { data: lines, error } = await ctx.admin
    .from("folio_lines")
    .select("total_btn, status, source_type, folios!inner(property_id)")
    .eq("booking_id", bookingId)
    .eq("folios.property_id", ctx.jwt.propertyId);
  if (error) throw error;

  let charges = 0;
  let paid = 0;
  for (const l of lines ?? []) {
    if (l.status === "voided") continue;
    const amt = Number(l.total_btn || 0);
    if (l.source_type === "payment" || amt < 0) paid += Math.abs(amt);
    else charges += amt;
  }
  return {
    bookingId,
    chargesBtn: Math.round(charges * 100) / 100,
    paidBtn: Math.round(paid * 100) / 100,
    balanceBtn: Math.round((charges - paid) * 100) / 100,
  };
}
