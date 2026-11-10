import {
  ensureOpenFolio as ensureCoreOpenFolio,
  postFolioCharge,
  postFolioPaymentRecord,
  roundBtn,
  type FolioBillTo,
} from "@hotel-os/core";
import type { AdapterCtx } from "./types.js";

/**
 * v2 folio money adapters — thin wrappers over `@hotel-os/core`, the same
 * code Innora runs: period lock → `post_folio_charge_atomic` (FOR UPDATE +
 * money_idempotency) → GL journal via posting rules → whole-Nu round-off
 * absorb. Payments: period lock → payments row (unique idempotency key) →
 * folio credit line → GL journal, with rollback when GL fails.
 */

export async function assertBookingOwned(
  ctx: AdapterCtx,
  bookingId: string,
): Promise<void> {
  const { data, error } = await ctx.admin
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Booking not found for property");
}

/** Open guest folio for a booking (property-scoped). Folio doc_no comes from DB trigger. */
export async function ensureOpenFolio(
  ctx: AdapterCtx,
  bookingId: string,
  label = "Guest folio",
): Promise<string> {
  await assertBookingOwned(ctx, bookingId);
  return ensureCoreOpenFolio(ctx.admin, ctx.jwt.propertyId, bookingId, label);
}

export type AtomicChargeInput = {
  folioId: string;
  bookingId: string;
  idempotencyKey: string;
  description: string;
  /** Guest-facing total for the line (BTN), GST included when `gstBtn` > 0. */
  amountBtn: number;
  /** GST portion already inside `amountBtn` (journals to GST output). */
  gstBtn?: number;
  sourceType: string;
  sourceId?: string | null;
  qty?: number;
  businessDate?: string | null;
  billTo?: FolioBillTo;
};

export type AtomicChargeResult = {
  ok: true;
  folioLineId: string;
  folioId: string;
  amountBtn: number;
  gstBtn: number;
  description: string;
  alreadyExists: boolean;
};

/** Post a folio charge through the shared core (RPC + GL + round-off). */
export async function postChargeAtomic(
  ctx: AdapterCtx,
  input: AtomicChargeInput,
): Promise<AtomicChargeResult> {
  const total = roundBtn(input.amountBtn);
  const gst = roundBtn(Math.max(0, input.gstBtn ?? 0));
  if (gst > Math.abs(total)) {
    throw new Error("GST cannot exceed the charge amount.");
  }
  const net = roundBtn(total - gst);
  const qty = input.qty ?? 1;

  const posted = await postFolioCharge(ctx.admin, ctx.jwt.propertyId, {
    folio_id: input.folioId,
    booking_id: input.bookingId,
    source_type: input.sourceType,
    source_id: input.sourceId ?? null,
    description: input.description,
    qty,
    unit_price_btn: qty > 0 ? roundBtn(net / qty) : net,
    amount_btn: net,
    gst_applicable: gst > 0,
    gst_btn: gst,
    total_btn: total,
    business_date: input.businessDate ?? null,
    journal_date: input.businessDate ?? null,
    bill_to: input.billTo,
    tax_treatment: gst > 0 ? "inclusive" : "net",
    idempotency_key: input.idempotencyKey,
    period_guard: {
      propertyId: ctx.jwt.propertyId,
      actor: `v2:${ctx.jwt.staffId}`,
    },
  });

  return {
    ok: true,
    folioLineId: posted.lineId,
    folioId: input.folioId,
    amountBtn: posted.total_btn,
    gstBtn: posted.gst_btn,
    description: posted.description ?? input.description,
    alreadyExists: Boolean(posted.alreadyExists),
  };
}

/** v2 desk tender labels → `payments.method` values (same map as the v2 payment RPC). */
export function normalizePaymentMethod(method: string): string {
  const m = method.trim().toLowerCase();
  if (m === "transfer" || m === "other" || m === "bank_transfer") return "bank";
  if (m === "mbob") return "bank_qr";
  return m;
}

const LEDGER_METHODS = new Set(["cash", "bank", "card", "bank_qr", "pay_bt"]);

export type AtomicPaymentInput = {
  folioId: string;
  bookingId: string;
  idempotencyKey: string;
  amountBtn: number;
  method: string;
  notes?: string | null;
  reference?: string | null;
  kind?: "settlement" | "deposit";
};

export type AtomicPaymentResult = {
  ok: true;
  paymentId: string;
  folioId: string;
  folioLineId: string | null;
  amountBtn: number;
  alreadyExists: boolean;
};

/** Record a guest payment through the shared core (payments + folio credit + GL). */
export async function postPaymentAtomic(
  ctx: AdapterCtx,
  input: AtomicPaymentInput,
): Promise<AtomicPaymentResult> {
  const method = normalizePaymentMethod(input.method);
  if (method === "agent_credit") {
    throw new Error(
      "Agent credit settles through agent AR (credit limit + agent ledger). Use Innora Agents → settle until v2 agent AR ships.",
    );
  }
  if (!LEDGER_METHODS.has(method)) {
    throw new Error(`Unsupported payment method: ${input.method}`);
  }
  const amount = roundBtn(input.amountBtn);
  const kind = input.kind ?? "settlement";
  const key = input.idempotencyKey.trim().toLowerCase();

  const paid = await postFolioPaymentRecord(ctx.admin, {
    property_id: ctx.jwt.propertyId,
    folio_id: input.folioId,
    booking_id: input.bookingId,
    method,
    amount_btn: amount,
    kind,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    folio_line_source: kind === "deposit" ? "deposit" : "payment",
    idempotency_key: key,
    confirmation_status: "confirmed",
    period_guard: {
      propertyId: ctx.jwt.propertyId,
      actor: `v2:${ctx.jwt.staffId}`,
    },
  });

  const { data: line, error: lineErr } = await ctx.admin
    .from("folio_lines")
    .select("id")
    .eq("folio_id", input.folioId)
    .eq("source_id", paid.paymentId)
    .in("source_type", ["payment", "deposit"])
    .limit(1)
    .maybeSingle();
  if (lineErr) throw lineErr;

  return {
    ok: true,
    paymentId: paid.paymentId,
    folioId: input.folioId,
    folioLineId: (line?.id as string | undefined) ?? null,
    amountBtn: amount,
    alreadyExists: Boolean(paid.alreadyExists),
  };
}
