import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { FiscalDocEmailForm } from "@/components/erp/FiscalDocEmailForm";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { formatBtn } from "@/lib/pricing";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Tax invoice | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Printable fiscal invoice (browser Print → PDF) + email. */
export default async function FiscalInvoicePrintPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const activePropertyId = await resolveActivePropertyId(admin);

  const { data: doc } = await admin
    .from("fiscal_documents")
    .select(
      "id, doc_no, doc_kind, property_id, folio_id, issued_at, total_btn, gst_btn, memo",
    )
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();
  try {
    assertDeskProperty(activePropertyId, doc.property_id as string, "Document");
  } catch {
    notFound();
  }

  const property = await loadProperty(admin, activePropertyId);
  const folioId = doc.folio_id as string | null;
  const { data: folio } = folioId
    ? await admin
        .from("folios")
        .select(
          "label, booking_id, folio_lines(description, total_btn, gst_btn, status, source_type)",
        )
        .eq("id", folioId)
        .maybeSingle()
    : { data: null };

  let guestEmail: string | null = null;
  let guestName: string | null = null;
  const bookingId = folio?.booking_id as string | null | undefined;
  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select("contact_email, contact_name")
      .eq("id", bookingId)
      .maybeSingle();
    guestEmail = (booking?.contact_email as string | null) ?? null;
    guestName = (booking?.contact_name as string | null) ?? null;
  }

  const lines = (
    (folio?.folio_lines as
      | {
          description: string;
          total_btn: number;
          gst_btn: number;
          status: string;
          source_type: string;
        }[]
      | null) ?? []
  ).filter((l) => l.status === "posted");

  const kind = doc.doc_kind as string;
  const kindLabel =
    kind === "receipt"
      ? "Receipt"
      : kind === "credit_note"
        ? "Credit note"
        : "Tax invoice";

  return (
    <div className="erp mx-auto max-w-[820px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {kindLabel} print
          </p>
          <h1 className="mt-1 font-mono text-2xl font-semibold text-foreground">
            {doc.doc_no as string}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {folioId ? (
            <a
              href={`/erp/folios/${folioId}`}
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted"
            >
              Back to folio
            </a>
          ) : null}
          <a
            href="/erp/invoices"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted"
          >
            All invoices
          </a>
          <DocPrintControls defaultSize="a4" printLabel="Print / PDF" />
        </div>
      </div>

      {folioId && (kind === "invoice" || kind === "receipt") ? (
        <div className="print:hidden">
          <FiscalDocEmailForm
            folioId={folioId}
            fiscalDocId={doc.id as string}
            docKind={kind === "receipt" ? "receipt" : "invoice"}
            defaultEmail={guestEmail}
            defaultName={guestName}
          />
        </div>
      ) : null}

      <article className="doc-print-sheet mx-auto max-w-[720px] rounded-lg border bg-white p-8 text-black print:border-0 print:p-0">
        <header className="border-b border-neutral-300 pb-4">
          <p className="text-xl font-semibold">
            {property?.name ?? "Hotel"}
          </p>
          <p className="text-sm text-neutral-600">{property?.legal_name}</p>
          <p className="text-sm text-neutral-600">{property?.address}</p>
          {property?.tax_id ? (
            <p className="text-sm">TPN / Tax ID: {property.tax_id}</p>
          ) : null}
          {property?.phone ? (
            <p className="text-sm text-neutral-600">{property.phone}</p>
          ) : null}
        </header>
        <div className="mt-6 flex justify-between gap-4">
          <div>
            <p className="text-xs tracking-wide text-neutral-500 uppercase">
              {kindLabel}
            </p>
            <p className="text-2xl font-semibold">{doc.doc_no as string}</p>
          </div>
          <div className="text-right text-sm">
            <p>Issued {String(doc.issued_at).slice(0, 10)}</p>
            <p>{(folio?.label as string) ?? "Folio"}</p>
          </div>
        </div>
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">GST</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatBtn(Number(line.gst_btn))}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatBtn(Number(line.total_btn))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-right text-lg font-semibold tabular-nums">
          Total {formatBtn(Number(doc.total_btn ?? 0))}
        </p>
        {doc.memo ? (
          <p className="mt-4 text-sm text-neutral-600">{doc.memo as string}</p>
        ) : null}
        <p className="mt-10 text-xs text-neutral-500">
          Use Print → Save as PDF for the guest / GST file. Sequence is gapless
          per property via property_sequences.
        </p>
      </article>
    </div>
  );
}
