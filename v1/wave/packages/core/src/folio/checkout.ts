import { createHash } from "node:crypto";
import type { Admin } from "../admin.ts";
import type { PeriodGuardOptions } from "../accounting/period-guard.ts";
import {
  guideEvidenceAllowsLeave,
  guideEvidenceBlockMessage,
} from "../agents/guide-checkout.ts";
import { writeAuditEvent } from "../audit.ts";
import { roundBtn } from "../pricing.ts";
import { effectiveGstRate } from "../tax.ts";
import { guestVisibleBalanceLines, netFolioBalance } from "./balance.ts";
import { postFolioCharge } from "./post-charge.ts";

export type StayCheckoutInput = {
  bookingId: string;
  /** Desk-generated UUID; replays return the first result (money_idempotency). */
  idempotencyKey: string;
  /** Checkout with an open balance (desk tick). */
  allowBalance?: boolean;
  /** Early checkout policy fee (net, GST added at property rate). */
  earlyCheckoutFeeBtn?: number | null;
  /** Late checkout policy fee (net, GST added at property rate). */
  lateCheckoutFeeBtn?: number | null;
  actor?: string;
  period_guard?: PeriodGuardOptions;
};

export type StayCheckoutResult = {
  ok: true;
  bookingId: string;
  folioId: string | null;
  balanceBtn: number;
  roomsDirtied: number;
  alreadyExists: boolean;
};

type FolioLineRow = {
  id: string;
  total_btn: number;
  status: string;
  bill_to: string | null;
  source_type: string | null;
  reverses_line_id: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable UUID (v5-shaped, SHA-1) for a sub-operation of an idempotent request. */
export function deriveIdempotencyKey(parentKey: string, purpose: string): string {
  const hex = createHash("sha1")
    .update(`${parentKey.trim().toLowerCase()}:${purpose}`)
    .digest("hex");
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function feeAmount(raw: number | null | undefined, label: string): number {
  if (raw == null) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative amount.`);
  }
  return n;
}

/** Mark the stay's assigned rooms dirty (skips out-of-order units). */
export async function markAssignedRoomsDirty(
  admin: Admin,
  propertyId: string,
  bookingId: string,
): Promise<number> {
  const { data: assignments, error } = await admin
    .from("room_assignments")
    .select("room_unit_id")
    .eq("property_id", propertyId)
    .eq("booking_id", bookingId);
  if (error) throw new Error(error.message);
  const unitIds = [
    ...new Set(
      (assignments ?? [])
        .map((row) => row.room_unit_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (unitIds.length === 0) return 0;
  const { data: updated, error: updateError } = await admin
    .from("room_units")
    .update({
      hk_status: "dirty",
      updated_at: new Date().toISOString(),
    })
    .eq("property_id", propertyId)
    .in("id", unitIds)
    .neq("hk_status", "ooo")
    .select("id");
  if (updateError) throw new Error(updateError.message);
  return updated?.length ?? 0;
}

async function postPolicyFee(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId: string;
    description: string;
    feeBtn: number;
    idempotencyKey: string;
    periodGuard?: PeriodGuardOptions;
  },
): Promise<void> {
  const { data: prop, error } = await admin
    .from("properties")
    .select("gst_enabled, gst_rate")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const gstRate = effectiveGstRate(prop);
  const amountBtn = roundBtn(args.feeBtn);
  const gstBtn = gstRate > 0 ? roundBtn(amountBtn * gstRate) : 0;
  await postFolioCharge(admin, propertyId, {
    folio_id: args.folioId,
    booking_id: args.bookingId,
    source_type: "service",
    description: args.description,
    qty: 1,
    unit_price_btn: amountBtn,
    amount_btn: amountBtn,
    gst_applicable: gstBtn > 0,
    gst_btn: gstBtn,
    total_btn: roundBtn(amountBtn + gstBtn),
    idempotency_key: args.idempotencyKey,
    period_guard: args.periodGuard,
  });
}

/**
 * Desk checkout — same rules as Innora `confirmCheckOut`:
 * guide-evidence gate, optional early/late fee through the GL charge path,
 * balance check (agent on-credit residual allowed), master-bill folio close,
 * then `settle_checkout_atomic` (row locks + money_idempotency), dirty rooms,
 * and an audit event.
 */
export async function settleStayCheckout(
  admin: Admin,
  propertyId: string,
  input: StayCheckoutInput,
): Promise<StayCheckoutResult> {
  const key = input.idempotencyKey.trim().toLowerCase();
  if (!UUID_RE.test(key)) {
    throw new Error("Checkout idempotency key must be a UUID.");
  }

  const { data: cached, error: cacheErr } = await admin
    .from("money_idempotency")
    .select("result")
    .eq("property_id", propertyId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (cacheErr) throw new Error(cacheErr.message);
  if (cached?.result) {
    const prior = cached.result as {
      booking_id?: string;
      folio_id?: string | null;
      balance?: number;
    };
    if (prior.booking_id && prior.booking_id !== input.bookingId) {
      throw new Error("Idempotency key was already used for another booking.");
    }
    return {
      ok: true,
      bookingId: input.bookingId,
      folioId: prior.folio_id ?? null,
      balanceBtn: roundBtn(Number(prior.balance ?? 0)),
      roomsDirtied: 0,
      alreadyExists: true,
    };
  }

  const earlyFee = feeAmount(input.earlyCheckoutFeeBtn, "Early checkout fee");
  const lateFee = feeAmount(input.lateCheckoutFeeBtn, "Late checkout fee");
  if (earlyFee > 0.009 && lateFee > 0.009) {
    throw new Error(
      "Post either early or late checkout fee, not both. Clear one field and try again.",
    );
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, status, contact_name, property_id, agent_id, payment_mode, guide_sign_status",
    )
    .eq("id", input.bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (bookingError) throw new Error(bookingError.message);
  if (!booking) throw new Error("Booking not found.");
  if ((booking.status as string) !== "checked_in") {
    throw new Error("Only checked-in bookings can be checked out.");
  }
  if (
    !guideEvidenceAllowsLeave({
      agentId: booking.agent_id as string | null,
      guideSignStatus: booking.guide_sign_status as string | null,
    })
  ) {
    throw new Error(guideEvidenceBlockMessage());
  }

  const { data: folio, error: folioErr } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", input.bookingId)
    .eq("property_id", propertyId)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (folioErr) throw new Error(folioErr.message);
  const folioId = (folio?.id as string | undefined) ?? null;

  for (const fee of [
    { amount: earlyFee, description: "Early checkout fee", purpose: "early_fee" },
    { amount: lateFee, description: "Late checkout fee", purpose: "late_fee" },
  ]) {
    if (!(fee.amount > 0.009)) continue;
    if (!folioId) {
      throw new Error(
        `Open a folio before posting a ${fee.description.toLowerCase()}.`,
      );
    }
    await postPolicyFee(admin, propertyId, {
      folioId,
      bookingId: input.bookingId,
      description: fee.description,
      feeBtn: fee.amount,
      idempotencyKey: deriveIdempotencyKey(key, fee.purpose),
      periodGuard: input.period_guard,
    });
  }

  let balance = 0;
  if (folioId) {
    const { data: lineRows, error: linesErr } = await admin
      .from("folio_lines")
      .select("id, total_btn, status, bill_to, source_type, reverses_line_id")
      .eq("folio_id", folioId);
    if (linesErr) throw new Error(linesErr.message);
    const lines: FolioLineRow[] = (lineRows ?? []).map((l) => ({
      id: l.id as string,
      total_btn: Number(l.total_btn ?? 0),
      status: (l.status as string | null) ?? "posted",
      bill_to: (l.bill_to as string | null) ?? null,
      source_type: (l.source_type as string | null) ?? null,
      reverses_line_id: (l.reverses_line_id as string | null) ?? null,
    }));
    balance = netFolioBalance(lines);
    const guestVisibleBalance = guestVisibleBalanceLines(lines).reduce(
      (sum, l) => {
        const st = (l.source_type ?? "").toLowerCase();
        if (st === "payment" || st === "deposit") return sum + l.total_btn;
        if ((l.bill_to ?? "guest") === "agent") return sum;
        return sum + l.total_btn;
      },
      0,
    );

    const paymentMode = String(booking.payment_mode ?? "").toLowerCase();
    const agentResidualOk =
      Boolean(booking.agent_id) &&
      (paymentMode === "on_credit" || paymentMode === "partial") &&
      Math.abs(guestVisibleBalance) <= 0.5 &&
      Math.abs(balance) > 0.009;

    if (Math.abs(balance) > 0.009 && !input.allowBalance && !agentResidualOk) {
      throw new Error(
        `Folio balance is Nu ${balance.toFixed(2)}. Settle guest payment, use agent credit, or tick allow balance to checkout.`,
      );
    }

    const { data: masterBill, error: billErr } = await admin
      .from("fiscal_documents")
      .select("id")
      .eq("folio_id", folioId)
      .eq("doc_kind", "invoice")
      .eq("status", "issued")
      .limit(1)
      .maybeSingle();
    if (billErr) throw new Error(billErr.message);
    if (masterBill?.id) {
      const { error: closeErr } = await admin
        .from("folios")
        .update({
          status: Math.abs(balance) <= 0.009 ? "settled" : "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", folioId);
      if (closeErr) throw new Error(closeErr.message);
    }
  }

  // Balance / allow-balance / agent residual already validated above (v1 parity).
  const { data: rpcRaw, error: rpcError } = await admin.rpc(
    "settle_checkout_atomic",
    {
      p_property_id: propertyId,
      p_booking_id: input.bookingId,
      p_idempotency_key: key,
      p_allow_balance: true,
    },
  );
  if (rpcError) {
    throw new Error(rpcError.message || "Could not check out booking.");
  }
  const rpc = (rpcRaw ?? {}) as {
    ok?: boolean;
    folio_id?: string | null;
    already_exists?: boolean;
  };
  if (!rpc.ok) throw new Error("Could not check out booking.");

  const roomsDirtied = await markAssignedRoomsDirty(
    admin,
    propertyId,
    input.bookingId,
  );

  await writeAuditEvent(admin, {
    propertyId,
    action: "booking.check_out",
    entityType: "bookings",
    entityId: input.bookingId,
    summary: `Checked out ${(booking.contact_name as string | null) ?? "guest"}`,
    meta: {
      folioBalance: roundBtn(balance),
      allowBalance: Boolean(input.allowBalance),
      earlyCheckoutFee: earlyFee > 0 ? earlyFee : undefined,
      lateCheckoutFee: lateFee > 0 ? lateFee : undefined,
    },
    actor: input.actor,
  });

  return {
    ok: true,
    bookingId: input.bookingId,
    folioId: rpc.folio_id ?? folioId,
    balanceBtn: roundBtn(balance),
    roomsDirtied,
    alreadyExists: Boolean(rpc.already_exists),
  };
}
