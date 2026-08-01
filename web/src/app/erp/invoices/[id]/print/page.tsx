import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/erp/PrintButton";

export const metadata = {
  title: "Tax invoice | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Printable fiscal invoice (browser Print → PDF). */
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
  const { data: folio } = doc.folio_id
    ? await admin
        .from("folios")
        .select(
          "label, folio_lines(description, total_btn, gst_btn, status, source_type)",
        )
        .eq("id", doc.folio_id)
        .maybeSingle()
    : { data: null };

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

  return (
    <div className="erp mx-auto max-w-[720px] bg-white p-8 text-black print:p-4">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <h1 className="text-lg font-semibold">Tax invoice print</h1>
        <PrintButton />
      </div>
      <header className="border-b border-neutral-300 pb-4">
        <p className="text-xl font-semibold">{property?.name ?? "Hotel"}</p>
        <p className="text-sm text-neutral-600">{property?.legal_name}</p>
        <p className="text-sm text-neutral-600">{property?.address}</p>
        {property?.tax_id ? (
          <p className="text-sm">TPN / Tax ID: {property.tax_id}</p>
        ) : null}
      </header>
      <div className="mt-6 flex justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {(doc.doc_kind as string) === "receipt"
              ? "Receipt"
              : (doc.doc_kind as string) === "credit_note"
                ? "Credit note"
                : "Tax invoice"}
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
              <td className="py-2 text-right">{Number(line.gst_btn).toFixed(2)}</td>
              <td className="py-2 text-right">
                {Number(line.total_btn).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-right text-lg font-semibold">
        Total Nu {Number(doc.total_btn ?? 0).toFixed(2)}
      </p>
      {doc.memo ? (
        <p className="mt-4 text-sm text-neutral-600">{doc.memo as string}</p>
      ) : null}
      <p className="mt-10 text-xs text-neutral-500">
        Print this page to PDF for the guest / GST file. Sequence is gapless per
        property via property_sequences.
      </p>
    </div>
  );
}
