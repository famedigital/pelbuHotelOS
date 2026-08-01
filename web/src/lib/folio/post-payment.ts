import "server-only";
import { reverseJournal } from "@/lib/accounting/journals";
import { postPayment } from "@/lib/accounting/posting";
import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";
import { assertOpenPeriodForDate } from "@/lib/accounting/period-guard";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type FolioPaymentInput = {
  property_id: string;
  folio_id?: string | null;
  booking_id?: string | null;
  method: string;
  amount_btn: number;
  kind?: string | null;
  reference?: string | null;
  notes?: string | null;
  /** When set with folio_id, also posts a payment/deposit folio line. */
  folio_line_source?: "payment" | "deposit" | null;
  idempotency_key?: string | null;
  period_guard?: PeriodGuardOptions;
};

export type FolioPaymentResult = {
  ok: true;
  paymentId: string;
  alreadyExists?: boolean;
};

/**
 * Insert a payment (+ optional folio credit line) and journal it.
 * Rolls back payment and folio line if GL posting fails.
 */
export async function postFolioPaymentRecord(
  admin: Admin,
  input: FolioPaymentInput,
): Promise<FolioPaymentResult> {
  const amountBtn = Number(input.amount_btn);
  if (!Number.isFinite(amountBtn) || amountBtn <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  await assertOpenPeriodForDate(admin, input.property_id, null, {
    propertyId: input.property_id,
    ...input.period_guard,
  });

  const row: Record<string, unknown> = {
    property_id: input.property_id,
    folio_id: input.folio_id ?? null,
    booking_id: input.booking_id ?? null,
    method: input.method,
    kind: input.kind ?? "settlement",
    amount_btn: amountBtn,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
  };
  if (input.idempotency_key) {
    row.idempotency_key = input.idempotency_key;
  }

  const { data: payment, error: payError } = await admin
    .from("payments")
    .insert(row)
    .select("id")
    .single();

  if (payError) {
    // Unique idempotency collision — treat as success if row exists.
    if (payError.code === "23505" && input.idempotency_key) {
      const { data: existing } = await admin
        .from("payments")
        .select("id")
        .eq("property_id", input.property_id)
        .eq("idempotency_key", input.idempotency_key)
        .maybeSingle();
      if (existing?.id) {
        return {
          ok: true,
          paymentId: existing.id as string,
          alreadyExists: true,
        };
      }
    }
    throw new Error(payError.message ?? "Could not save payment.");
  }
  if (!payment) throw new Error("Could not save payment.");

  const paymentId = payment.id as string;
  const lineSource = input.folio_line_source ?? null;

  if (input.folio_id && lineSource) {
    const { error: lineError } = await admin.from("folio_lines").insert({
      folio_id: input.folio_id,
      booking_id: input.booking_id ?? null,
      source_type: lineSource,
      source_id: paymentId,
      description: `${lineSource === "deposit" ? "Deposit" : "Payment"} · ${input.method}${input.reference ? ` · ${input.reference}` : ""}`,
      qty: 1,
      unit_price_btn: -amountBtn,
      amount_btn: -amountBtn,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: -amountBtn,
      status: "posted",
    });
    if (lineError) {
      await admin.from("payments").delete().eq("id", paymentId);
      throw new Error("Could not post payment to folio.");
    }
  }

  const gl = await postPayment(admin, input.property_id, {
    id: paymentId,
    method: input.method,
    kind: input.kind ?? "settlement",
    amount_btn: amountBtn,
    notes: input.notes ?? null,
    period_guard: input.period_guard,
  });

  if (!gl.ok) {
    if (input.folio_id && lineSource) {
      await admin
        .from("folio_lines")
        .delete()
        .eq("source_type", lineSource)
        .eq("source_id", paymentId);
    }
    await admin.from("payments").delete().eq("id", paymentId);
    throw new Error(gl.error ?? "Could not post payment to ledger.");
  }

  return { ok: true, paymentId };
}

/**
 * Undo a posted folio payment when a downstream step fails (e.g. agent credit update).
 * Reverses the GL journal when present, then removes folio line + payment row.
 */
export async function rollbackFolioPaymentRecord(
  admin: Admin,
  propertyId: string,
  paymentId: string,
  lineSource?: "payment" | "deposit" | null,
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

  if (lineSource) {
    await admin
      .from("folio_lines")
      .delete()
      .eq("source_type", lineSource)
      .eq("source_id", paymentId);
  }

  await admin.from("payments").delete().eq("id", paymentId);
}
