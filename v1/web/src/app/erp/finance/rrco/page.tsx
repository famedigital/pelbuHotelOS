import { RrcoHeaderForm, RrcoPullForm } from "@/components/erp/finance/StatementForms";
import { ExportButtons, FinanceKpi, FinanceShell } from "@/components/erp/finance/FinanceShell";
import { loadRrcoView } from "@/lib/finance/rrco-pack";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RRCO filing", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function yearOf(raw: string | undefined): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 2000 && n <= 2100) return n;
  return new Date().getFullYear();
}

export default async function RrcoHomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = yearOf((await searchParams).year);
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const view = await loadRrcoView(admin, propertyId, year);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return (
    <FinanceShell
      showTax
      title={`RRCO ${year}`}
      description="Statutory pack for the income year. Taxable folio and POS sales stay in. Bank settlements of agent credit are not a second invoice."
      actions={<ExportButtons report="rrco_pack" from={from} to={to} />}
    >
      <form method="get" className="flex items-end gap-2">
        <label className="text-xs font-medium">
          Tax year
          <input className="mt-1 block h-9 w-28 rounded-md border px-2 text-sm" name="year" type="number" defaultValue={year} />
        </label>
        <button className="h-9 rounded-md border px-3 text-sm" type="submit">
          Open
        </button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpi label="Canonical income" value={formatBtn(view.statements.totalIncome)} />
        <FinanceKpi label="Canonical expenses" value={formatBtn(view.statements.totalExpense)} />
        <FinanceKpi label="Net" value={formatBtn(view.statements.net)} emphasize />
      </div>
      <RrcoHeaderForm
        year={year}
        cash={view.cashInHand}
        tds={view.tds}
        capital={view.capital}
        preparedBy={view.preparedBy}
      />
      <RrcoPullForm year={year} />
      <p className="text-sm text-muted-foreground">
        {view.lines.length} working lines · {view.docs.length} canonical documents · trial{" "}
        {view.statements.balanced ? "balanced" : "out of balance"}.
      </p>
    </FinanceShell>
  );
}
