import { reverseJournal } from "../accounting/journals.ts";
import { postPayment } from "../accounting/posting.ts";
import type { PeriodGuardOptions } from "../accounting/period-guard.ts";
import { assertOpenPeriodForDate } from "../accounting/period-guard.ts";
import type { PostingResult } from "../accounting/types.ts";
import type { Admin } from "../admin.ts";

export type FolioPaymentAtomicInput = {
  propertyId: string;
  folioId: string;
  bookingId: string;
  idempotencyKey: string;
  amountBtn: number;
  method: string;
  staffId?: string | null;
  notes?: string | null;
  kind?: string | null;
  period_guard?: PeriodGuardOptions;
};

export type FolioPaymentAtomicResult = {
  ok: true;
  paymentId: string;
  folioId: string;
  folioLineId: string | null;
  amountBtn: number;
  method: string;
  alreadyExists: boolean;
};

type PaymentRpcRow = {
  ok?: boolean;
  payment_id?: string;
  folio_id?: string;
  folio_line_id?: string;
  amount_btn?: number;
  method?: string;
  already_exists?: boolean;
};

async function clearPaymentMoneyIdempotency(
  admin: Admin,
  propertyId: string,
  idempotencyKey: string,
): Promise<void> {
  const { error } = await admin
    .from("money_idempotency")
    .delete()
    .eq("property_id", propertyId)
    .eq("idempotency_key", idempotencyKey)
    .eq("action", "post_folio_payment");
  if (error) {
    console.error("money_idempotency cleanup (payment) failed", error.message, {
      idempotencyKey,
    });
  }
}

async function deletePaymentPostingArtifacts(
  admin: Admin,
  propertyId: string,
  paymentId: string,
): Promise<void> {
  const { data: event } = await admin
    .from("accounting_posting_events")
    .select("journal_id, status")
    .eq("property_id", propertyId)
    .eq("source_table", "payments")
    .eq("source_id", paymentId)
    .maybeSingle();

  if (event?.status === "posted" && event.journal_id) {
    await reverseJournal(admin, propertyId, event.journal_id as string);
  }

  await admin
    .from("accounting_posting_events")
    .delete()
    .eq("property_id", propertyId)
    .eq("source_table", "payments")
    .eq("source_id", paymentId);
}

/**
 * Desk path: `post_folio_payment_atomic` (folio lock + line + payment) then GL journal.
 * Matches Innora money integrity: period lock + posting rules; rolls back RPC side on GL failure.
 */
export async function postFolioPaymentAtomic(
  admin: Admin,
  input: FolioPaymentAtomicInput,
): Promise<FolioPaymentAtomicResult> {
  await assertOpenPeriodForDate(admin, input.propertyId, null, {
    propertyId: input.propertyId,
    ...input.period_guard,
  });

  const key = input.idempotencyKey.trim().toLowerCase();
  const amount = Math.round(input.amountBtn * 100) / 100;

  const { data: rpcRaw, error: rpcError } = await admin.rpc(
    "post_folio_payment_atomic",
    {
      p_property_id: input.propertyId,
      p_folio_id: input.folioId,
      p_booking_id: input.bookingId,
      p_idempotency_key: key,
      p_amount_btn: amount,
      p_method: input.method,
      p_staff_id: input.staffId ?? null,
      p_notes: input.notes ?? null,
      p_kind: input.kind ?? "settlement",
    },
  );

  if (rpcError) {
    const code = rpcError.code ? ` [${rpcError.code}]` : "";
    throw new Error(
      `${rpcError.message ?? "Could not record payment."}${code}`,
    );
  }

  const rpc = (rpcRaw ?? {}) as PaymentRpcRow;

  if (!rpc.payment_id) {
    throw new Error("post_folio_payment_atomic returned no payment_id");
  }

  const paymentId = rpc.payment_id as string;
  const folioLineId = rpc.folio_line_id ?? null;

  if (rpc.already_exists) {
    return {
      ok: true,
      paymentId,
      folioId: (rpc.folio_id as string) || input.folioId,
      folioLineId,
      amountBtn: Number(rpc.amount_btn ?? amount),
      method: String(rpc.method ?? input.method),
      alreadyExists: true,
    };
  }

  const { data: payRow, error: payReadErr } = await admin
    .from("payments")
    .select(
      "id, method, kind, amount_btn, notes, created_at, confirmed_at",
    )
    .eq("id", paymentId)
    .eq("property_id", input.propertyId)
    .maybeSingle();

  if (payReadErr || !payRow) {
    console.error("[postFolioPaymentAtomic] payment row missing after RPC", {
      paymentId,
      payReadErr,
    });
    throw new Error("Payment row missing after atomic post.");
  }

  const gl: PostingResult = await postPayment(admin, input.propertyId, {
    id: paymentId,
    method: payRow.method as string,
    kind: (payRow.kind as string | null) ?? "settlement",
    amount_btn: Number(payRow.amount_btn ?? amount),
    notes: (payRow.notes as string | null) ?? null,
    created_at:
      (payRow.confirmed_at as string | null) ??
      (payRow.created_at as string | undefined) ??
      new Date().toISOString(),
    period_guard: input.period_guard,
  });

  if (!gl.ok) {
    if (folioLineId) {
      await admin.from("folio_lines").delete().eq("id", folioLineId);
    }
    await deletePaymentPostingArtifacts(admin, input.propertyId, paymentId);
    await admin.from("payments").delete().eq("id", paymentId);
    await clearPaymentMoneyIdempotency(admin, input.propertyId, key);
    throw new Error(gl.error ?? "Could not post payment to ledger.");
  }

  return {
    ok: true,
    paymentId,
    folioId: (rpc.folio_id as string) || input.folioId,
    folioLineId,
    amountBtn: Number(rpc.amount_btn ?? payRow.amount_btn ?? amount),
    method: String(rpc.method ?? payRow.method ?? input.method),
    alreadyExists: false,
  };
}
