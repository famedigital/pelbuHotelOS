"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { Resend } from "resend";

export type FiscalDocEmailState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function resendFrom(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Pelbu Suites <onboarding@resend.dev>"
  );
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Email a fiscal invoice (INV) or folio receipt summary via Resend.
 * Form fields: doc_kind (`invoice`|`receipt`), optional `fiscal_doc_id`,
 * `folio_id`, `to` (email), optional override `recipient_name`.
 */
export async function emailFiscalDocument(
  _prev: FiscalDocEmailState,
  formData: FormData,
): Promise<FiscalDocEmailState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requireMoneyDesk();

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Email is not configured (RESEND_API_KEY).");
    }

    const kindRaw = String(formData.get("doc_kind") ?? "invoice").trim();
    const kind = kindRaw === "receipt" ? "receipt" : "invoice";
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const fiscalDocId = optionalTrim(formData.get("fiscal_doc_id"));
    let to = optionalTrim(formData.get("to"));
    const recipientName = optionalTrim(formData.get("recipient_name"));

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: folio } = await admin
      .from("folios")
      .select(
        "id, label, property_id, booking_id, folio_lines(description, total_btn, gst_btn, status, source_type)",
      )
      .eq("id", folioId)
      .maybeSingle();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");

    if (!to) {
      const bookingId = folio.booking_id as string | null;
      if (bookingId) {
        const { data: booking } = await admin
          .from("bookings")
          .select("contact_email, contact_name")
          .eq("id", bookingId)
          .maybeSingle();
        to = (booking?.contact_email as string | null)?.trim() || null;
      }
    }
    if (!to || !isEmail(to)) {
      throw new Error("Enter a valid guest email address.");
    }

    const { data: property } = await admin
      .from("properties")
      .select("name, legal_name, address, phone, email, tax_id")
      .eq("id", propertyId)
      .maybeSingle();

    // fiscal_documents has no amount columns — totals come from folio lines below.
    let docNo: string | null = null;
    let issuedAt: string | null = null;
    let docId: string | null = fiscalDocId;

    if (fiscalDocId) {
      const { data: doc, error: docError } = await admin
        .from("fiscal_documents")
        .select("id, doc_no, doc_kind, status, issued_at, folio_id")
        .eq("id", fiscalDocId)
        .maybeSingle();
      if (docError) throw new Error(docError.message);
      if (!doc || doc.folio_id !== folioId) {
        throw new Error("Fiscal document not found for this folio.");
      }
      if ((doc.doc_kind as string) !== kind) {
        throw new Error("Document kind does not match.");
      }
      if ((doc.status as string) !== "issued") {
        throw new Error("Only issued documents can be emailed.");
      }
      docNo = doc.doc_no as string;
      issuedAt = doc.issued_at as string;
      docId = doc.id as string;
    } else {
      const { data: latest } = await admin
        .from("fiscal_documents")
        .select("id, doc_no, issued_at")
        .eq("folio_id", folioId)
        .eq("doc_kind", kind)
        .eq("status", "issued")
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        docId = latest.id as string;
        docNo = latest.doc_no as string;
        issuedAt = latest.issued_at as string;
      }
    }

    const lines = (
      (folio.folio_lines as
        | {
            description: string;
            total_btn: number;
            gst_btn: number;
            status: string;
            source_type: string;
          }[]
        | null) ?? []
    ).filter((l) => l.status === "posted");

    const chargeLines = lines.filter(
      (l) => l.source_type !== "payment" && l.source_type !== "deposit",
    );
    const paymentLines = lines.filter(
      (l) => l.source_type === "payment" || l.source_type === "deposit",
    );
    const chargesSum = chargeLines.reduce(
      (s, l) => s + Number(l.total_btn ?? 0),
      0,
    );
    const gstSum = chargeLines.reduce(
      (s, l) => s + Number(l.gst_btn ?? 0),
      0,
    );
    const paidSum = paymentLines.reduce(
      (s, l) => s + Math.abs(Number(l.total_btn ?? 0)),
      0,
    );

    const title =
      kind === "invoice" ? "TAX INVOICE" : "GUEST FOLIO RECEIPT";
    const brand = property?.name ?? "Pelbu Suites";
    const greeting = recipientName
      ? `Dear ${recipientName},`
      : "Dear guest,";

    const body = [
      brand,
      property?.legal_name && property.legal_name !== brand
        ? property.legal_name
        : null,
      property?.address ?? null,
      property?.tax_id ? `TPN / Tax ID: ${property.tax_id}` : null,
      property?.phone ? `Phone: ${property.phone}` : null,
      "",
      title,
      docNo ? `Document no.: ${docNo}` : "Document no.: (provisional desk copy)",
      issuedAt ? `Issued: ${String(issuedAt).slice(0, 16).replace("T", " ")}` : null,
      `Folio: ${(folio.label as string) ?? "Guest folio"}`,
      `Ref: ${(folio.id as string).slice(0, 8)}`,
      "",
      greeting,
      "",
      "Lines:",
      ...chargeLines.map(
        (l) =>
          `  ${l.description}  ${formatBtn(Number(l.total_btn))}${
            Number(l.gst_btn) > 0
              ? ` (GST ${formatBtn(Number(l.gst_btn))})`
              : ""
          }`,
      ),
      chargeLines.length === 0 ? "  (no posted charges)" : null,
      "",
      `Charges: ${formatBtn(chargesSum)}`,
      `GST (lines): ${formatBtn(gstSum)}`,
      paidSum > 0 ? `Payments: ${formatBtn(paidSum)}` : null,
      kind === "receipt"
        ? `Balance (approx): ${formatBtn(Math.max(chargesSum - paidSum, 0))}`
        : null,
      "",
      "This message is an office copy. For formal print, ask the desk for a PDF.",
      property?.email ? `Queries: ${property.email}` : null,
      brand,
    ]
      .filter((line) => line !== null && line !== undefined)
      .join("\n");

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: resendFrom(),
      to: [to],
      subject: `${title} · ${docNo ?? folioId.slice(0, 8)} · ${brand}`,
      text: body,
    });
    if (error) throw new Error(error.message || "Could not send email.");

    await writeAuditEvent(admin, {
      propertyId,
      action:
        kind === "invoice"
          ? "fiscal.invoice.email"
          : "fiscal.receipt.email",
      entityType: docId ? "fiscal_documents" : "folios",
      entityId: docId ?? folioId,
      summary: `${kind} emailed to ${to}`,
      meta: { to, doc_no: docNo, folio_id: folioId },
    });

    return { ok: true, message: `Sent to ${to}.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send email.",
    };
  }
}
