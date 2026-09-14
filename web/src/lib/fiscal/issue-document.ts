import "server-only";
import {
  assertOpenPeriodForDate,
  type PeriodGuardOptions,
} from "@/lib/accounting/period-guard";
import { resolvePeriodForDate } from "@/lib/accounting/journals";
import { allocateFiscalDocNo } from "@/lib/accounting/sequences";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type FiscalDocKind = "invoice" | "receipt" | "credit_note";

export type IssueFiscalDocumentInput = {
  docKind: FiscalDocKind;
  folioId: string;
  paymentId?: string | null;
  issuedBy?: string;
  issueDate?: string | null;
  periodGuard?: PeriodGuardOptions;
};

export type IssuedFiscalDocument = {
  id: string;
  docNo: string;
  docKind: FiscalDocKind;
  fiscalYear: number;
  sequenceNo: number;
  folioId: string;
  paymentId: string | null;
  issuedAt: string;
};

function todayIso(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/**
 * Allocate a gapless fiscal number and persist the issued document.
 * Invoices: one active invoice per folio. Receipts: one per payment when paymentId set.
 */
export async function issueFiscalDocument(
  admin: Admin,
  propertyId: string,
  input: IssueFiscalDocumentInput,
): Promise<IssuedFiscalDocument> {
  const issueDate = todayIso(input.issueDate);
  const guardOpts: PeriodGuardOptions = {
    ...input.periodGuard,
    propertyId,
  };

  await assertOpenPeriodForDate(admin, propertyId, issueDate, guardOpts);

  const { data: folio, error: folioError } = await admin
    .from("folios")
    .select("id, property_id, booking_id, status")
    .eq("id", input.folioId)
    .maybeSingle();
  if (folioError || !folio) throw new Error("Folio not found.");
  assertDeskProperty(propertyId, folio.property_id as string, "Folio");

  if (input.docKind === "invoice") {
    const { data: existing } = await admin
      .from("fiscal_documents")
      .select("id, doc_no")
      .eq("property_id", propertyId)
      .eq("folio_id", input.folioId)
      .eq("doc_kind", "invoice")
      .eq("status", "issued")
      .maybeSingle();
    if (existing?.doc_no) {
      throw new Error(
        `Invoice ${existing.doc_no as string} is already issued for this folio.`,
      );
    }
  }

  let paymentId: string | null = input.paymentId ?? null;
  if (input.docKind === "receipt" && paymentId) {
    const { data: payment } = await admin
      .from("payments")
      .select("id, property_id, folio_id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment) throw new Error("Payment not found.");
    assertDeskProperty(propertyId, payment.property_id as string, "Payment");
    if ((payment.folio_id as string | null) !== input.folioId) {
      throw new Error("Payment does not belong to this folio.");
    }

    const { data: existingReceipt } = await admin
      .from("fiscal_documents")
      .select("id, doc_no")
      .eq("property_id", propertyId)
      .eq("payment_id", paymentId)
      .eq("doc_kind", "receipt")
      .eq("status", "issued")
      .maybeSingle();
    if (existingReceipt?.doc_no) {
      throw new Error(
        `Receipt ${existingReceipt.doc_no as string} already issued for this payment.`,
      );
    }
  }

  const allocated = await allocateFiscalDocNo(
    admin,
    propertyId,
    input.docKind,
    issueDate,
  );
  const period = await resolvePeriodForDate(admin, propertyId, issueDate);

  const { data: doc, error: insertError } = await admin
    .from("fiscal_documents")
    .insert({
      property_id: propertyId,
      doc_kind: input.docKind,
      doc_no: allocated.docNo,
      fiscal_year: allocated.fiscalYear,
      sequence_no: allocated.sequenceNo,
      folio_id: input.folioId,
      payment_id: paymentId,
      booking_id: (folio.booking_id as string | null) ?? null,
      period_id: period?.id ?? null,
      issued_by: input.issuedBy ?? "desk",
      meta: {
        folio_status: folio.status,
        issue_date: issueDate,
      },
    })
    .select("id, doc_no, issued_at")
    .single();

  if (insertError || !doc) {
    const code = insertError?.code ? ` [${insertError.code}]` : "";
    throw new Error(
      `${insertError?.message ?? "Could not issue fiscal document."}${code}`,
    );
  }

  return {
    id: doc.id as string,
    docNo: doc.doc_no as string,
    docKind: input.docKind,
    fiscalYear: allocated.fiscalYear,
    sequenceNo: allocated.sequenceNo,
    folioId: input.folioId,
    paymentId,
    issuedAt: doc.issued_at as string,
  };
}
