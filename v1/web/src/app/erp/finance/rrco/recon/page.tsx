import { RrcoLineForm, RrcoPullForm } from "@/components/erp/finance/StatementForms";
import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { loadRrcoView } from "@/lib/finance/rrco-pack";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RRCO reconcile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RrcoReconPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; treatment?: string }>;
}) {
  const sp = await searchParams;
  const year = Number(sp.year) || new Date().getFullYear();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const view = await loadRrcoView(admin, propertyId, year);
  const lines = view.lines.filter((l) => !sp.treatment || l.treatment === sp.treatment);
  return (
    <FinanceShell
      showTax
      title="Reconcile for RRCO"
      description="Folio and POS sales are included. Cash stays in. No-charge and complimentary lines need a reason. Agent settlements are not income again."
    >
      <RrcoPullForm year={year} />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="year" value={year} />
        <label className="text-xs font-medium">
          Treatment
          <select className="mt-1 block h-9 rounded-md border px-2 text-sm" name="treatment" defaultValue={sp.treatment ?? ""}>
            <option value="">All</option>
            <option value="include_income">Included income</option>
            <option value="include_expense">Included expense</option>
            <option value="comp">Complimentary</option>
            <option value="agent_settlement">Agent settlement</option>
            <option value="deposit">Early collection</option>
            <option value="owner_transfer">Owner transfer</option>
            <option value="loan">Loan</option>
            <option value="salary_sheet">Salary sheet</option>
          </select>
        </label>
        <button className="h-9 rounded-md border px-3 text-sm" type="submit">
          Filter
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Showing {Math.min(lines.length, 150)} of {lines.length}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Date</th>
              <th className="py-2">Source</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {lines.slice(0, 150).map((line) => (
              <tr key={line.id} className="border-b border-border/60 align-top">
                <td className="py-1 whitespace-nowrap">{line.date}</td>
                <td className="py-1">
                  {line.sourceKind}
                  <span className="block max-w-md truncate text-xs text-muted-foreground">{line.description}</span>
                </td>
                <td className="py-1 text-right tabular-nums">{formatBtn(line.amount)}</td>
                <td className="py-1">
                  <RrcoLineForm
                    id={line.id}
                    category={line.category}
                    treatment={line.treatment}
                    reason={line.reason}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FinanceShell>
  );
}
