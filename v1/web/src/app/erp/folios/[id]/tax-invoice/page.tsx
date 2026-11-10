import {
  FiscalLetterhead,
  FiscalPayBlock,
} from "@/components/erp/print/FiscalLetterhead";
import { FolioBillArticle, folioLetterheadProperty } from "@/components/erp/print/FolioBillArticle";
import { FolioPreviewFit } from "@/components/erp/print/FolioPreviewFit";
import { formatExactAmount } from "@/components/erp/print/RoomTaxInvoice";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadFolioBillView } from "@/lib/folio/load-folio-bill-view";
import { amountInWordsPayable } from "@/lib/print/amount-in-words";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Room tax invoice",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RoomTaxInvoiceAndReceiptPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const view = await loadFolioBillView(admin, propertyId, id, "master");
  if (!view) notFound();

  const { data: payments } = await admin
    .from("payments")
    .select("id, amount_btn, method, reference, confirmation_status, created_at")
    .eq("property_id", propertyId)
    .eq("folio_id", id)
    .order("created_at", { ascending: true });
  const received = (payments ?? []).filter((row) => {
    const status = (row.confirmation_status as string | null) ?? "confirmed";
    return status !== "pending_bank" && status !== "rejected" && status !== "void";
  });

  return (
    <FolioPreviewFit
      backHref={`/erp/folios/${id}/bill`}
      backLabel="Back to folio"
      printLabel="Print both"
      initialMode="continuous"
    >
      {view.taxInvoiceNo ? (
        <FolioBillArticle view={view} paper="tax" paperNo={view.taxInvoiceNo} />
      ) : (
        <article className="folio-a4 flex w-[210mm] min-h-[80mm] items-center justify-center bg-white p-8 text-sm">
          The room tax invoice is generated from the folio after the master bill is paid.
        </article>
      )}
      {view.receiptNo ? (
        <article className="folio-a4 fiscal-invoice-sheet doc-print-sheet flex w-[210mm] min-h-[297mm] flex-col bg-white px-[12mm] py-[8mm] text-[#1a1410]">
          <FiscalLetterhead
            compact
            property={folioLetterheadProperty(view)}
            kind="Receipt"
            title={view.receiptNo}
            meta={[
              { label: "Date", value: view.issueDate || "—" },
              { label: "Folio", value: view.folioNo },
              { label: "Currency", value: "Nu (BTN)" },
            ]}
          />
          <p className="mt-2 text-[12px]">
            Received from <span className="font-medium">{view.guestName}</span>
            {view.agentName ? ` · ${view.agentName}` : ""} against folio {view.folioNo}
            {view.taxInvoiceNo ? ` · room tax invoice ${view.taxInvoiceNo}` : ""}.
          </p>
          <table className="mt-3 w-full border-collapse border border-[#1a1410] text-[12px]">
            <thead>
              <tr>
                <th className="border border-[#1a1410] px-1 py-1 text-left">Particulars</th>
                <th className="border border-[#1a1410] px-1 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {received.length ? (
                received.map((row) => (
                  <tr key={row.id as string}>
                    <td className="border border-[#1a1410] px-1 py-1">
                      {[row.method, row.reference].filter(Boolean).join(" · ") || "Payment"}
                    </td>
                    <td className="border border-[#1a1410] px-1 py-1 text-right tabular-nums">
                      {formatExactAmount(Number(row.amount_btn ?? 0))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border border-[#1a1410] px-1 py-1">Payment on folio</td>
                  <td className="border border-[#1a1410] px-1 py-1 text-right tabular-nums">
                    {formatExactAmount(view.receivedTotal)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-[#1a1410] px-1 py-1 text-right font-semibold">
                  Total received
                </td>
                <td className="border border-[#1a1410] px-1 py-1 text-right font-semibold tabular-nums">
                  {formatExactAmount(
                    received.length
                      ? received.reduce((sum, row) => sum + Number(row.amount_btn ?? 0), 0)
                      : view.receivedTotal,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-[11px] uppercase">
            {amountInWordsPayable(
              received.length
                ? received.reduce((sum, row) => sum + Number(row.amount_btn ?? 0), 0)
                : view.receivedTotal,
            )}
          </p>
          <FiscalPayBlock banks={view.banks} qrDataUrl={null} />
        </article>
      ) : (
        <article className="folio-a4 flex w-[210mm] min-h-[80mm] items-center justify-center bg-white p-8 text-sm">
          The receipt is generated with the room tax invoice.
        </article>
      )}
    </FolioPreviewFit>
  );
}
