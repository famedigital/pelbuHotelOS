import "server-only";
import { reverseJournal } from "@/lib/accounting/journals";
import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";
import { assertOpenPeriodForDate } from "@/lib/accounting/period-guard";
import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type VoidFolioLineInput = {
  lineId: string;
  reason: string;
  voidedBy?: string;
  period_guard?: PeriodGuardOptions;
};

export type VoidFolioLineResult = {
  folioId: string;
  originalLineId: string;
  reversalLineId: string | null;
  journalReversed: boolean;
};

async function findPostedJournalId(
  admin: Admin,
  propertyId: string,
  lineId: string,
): Promise<string | null> {
  const { data: events } = await admin
    .from("accounting_posting_events")
    .select("journal_id, event_type, status")
    .eq("property_id", propertyId)
    .eq("source_table", "folio_lines")
    .eq("source_id", lineId)
    .eq("status", "posted")
    .not("journal_id", "is", null);

  const event = (events ?? []).find((row) => row.journal_id);
  return (event?.journal_id as string | undefined) ?? null;
}

/**
 * Void a posted folio charge: mark original voided, insert reversing credit line,
 * and reverse the GL journal when one exists.
 */
export async function voidFolioLineWithReversal(
  admin: Admin,
  propertyId: string,
  input: VoidFolioLineInput,
): Promise<VoidFolioLineResult> {
  const { data: line, error } = await admin
    .from("folio_lines")
    .select(
      "id, folio_id, booking_id, status, description, qty, unit_price_btn, amount_btn, gst_applicable, gst_btn, total_btn, service_charge_rate, service_charge_btn, service_charge_applied, service_charge_reason, source_type, source_id, created_at",
    )
    .eq("id", input.lineId)
    .single();
  if (error || !line) throw new Error("Folio line not found.");

  const { data: folio } = await admin
    .from("folios")
    .select("id, property_id, status")
    .eq("id", line.folio_id)
    .single();
  if (!folio || (folio.property_id as string) !== propertyId) {
    throw new Error("Folio line not found.");
  }
  if ((folio.status as string) !== "open") throw new Error("Folio is not open.");
  if ((line.status as string) === "voided") throw new Error("Already voided.");
  if ((line.source_type as string) === "payment") {
    throw new Error("Void payments via a refund adjustment — not line void.");
  }

  await assertOpenPeriodForDate(
    admin,
    propertyId,
    (line.created_at as string) ?? null,
    {
      propertyId,
      ...input.period_guard,
      actor: input.voidedBy ?? "desk",
    },
  );

  const journalId = await findPostedJournalId(admin, propertyId, input.lineId);
  let journalReversed = false;
  if (journalId) {
    await reverseJournal(
      admin,
      propertyId,
      journalId,
      input.voidedBy ?? "desk",
      input.period_guard,
    );
    journalReversed = true;
  }

  const now = new Date().toISOString();
  const neg = (value: number) => roundBtn(-Math.abs(Number(value)));

  const { data: reversal, error: reversalError } = await admin
    .from("folio_lines")
    .insert({
      folio_id: line.folio_id,
      booking_id: line.booking_id,
      source_type: "adjustment",
      source_id: line.source_id,
      description: `Reversal · ${line.description}`,
      qty: line.qty,
      unit_price_btn: neg(line.unit_price_btn),
      amount_btn: neg(line.amount_btn),
      service_charge_rate: line.service_charge_rate,
      service_charge_btn: neg(line.service_charge_btn),
      service_charge_applied: line.service_charge_applied,
      service_charge_reason: line.service_charge_reason,
      gst_applicable: line.gst_applicable,
      gst_btn: neg(line.gst_btn),
      total_btn: neg(line.total_btn),
      status: "posted",
      reverses_line_id: input.lineId,
    })
    .select("id, source_type, description, total_btn, gst_btn, created_at")
    .single();

  if (reversalError || !reversal) {
    throw new Error("Could not create reversing folio line.");
  }

  const { error: voidError } = await admin
    .from("folio_lines")
    .update({
      status: "voided",
      void_reason: input.reason,
      voided_at: now,
      voided_by: input.voidedBy ?? "desk",
    })
    .eq("id", input.lineId)
    .eq("status", "posted");
  if (voidError) throw new Error("Could not void folio line.");

  return {
    folioId: line.folio_id as string,
    originalLineId: input.lineId,
    reversalLineId: reversal.id as string,
    journalReversed,
  };
}
