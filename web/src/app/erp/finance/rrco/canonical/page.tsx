import { RrcoCanonicalForm } from "@/components/erp/finance/StatementForms";
import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { loadRrcoView } from "@/lib/finance/rrco-pack";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RRCO canonical", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RrcoCanonicalPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = Number((await searchParams).year) || new Date().getFullYear();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const view = await loadRrcoView(admin, propertyId, year);
  return (
    <FinanceShell
      showTax
      title="Canonical documents"
      description="Filing numbers follow the date. The original folio, POS, or expense reference stays on the line."
    >
      <RrcoCanonicalForm year={year} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Number</th>
              <th className="py-2">Date</th>
              <th className="py-2">Category</th>
              <th className="py-2">Original</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {view.docs.map((doc) => (
              <tr key={doc.docNo} className="border-b border-border/60">
                <td className="py-1 font-medium">{doc.docNo}</td>
                <td className="py-1 whitespace-nowrap">{doc.date}</td>
                <td className="py-1">
                  {doc.category}
                  <span className="block max-w-md truncate text-xs text-muted-foreground">{doc.description}</span>
                </td>
                <td className="py-1 text-xs">{doc.originalRef}</td>
                <td className="py-1 text-right tabular-nums">{formatBtn(doc.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FinanceShell>
  );
}
