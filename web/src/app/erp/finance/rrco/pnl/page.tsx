import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { loadRrcoView } from "@/lib/finance/rrco-pack";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RRCO profit and loss", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RrcoPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = Number((await searchParams).year) || new Date().getFullYear();
  const admin = createSupabaseAdminClient();
  const view = await loadRrcoView(admin, await resolveActivePropertyId(admin), year);
  const st = view.statements;
  return (
    <FinanceShell showTax title="RRCO profit and loss" description={`Income year ${year}. Built from canonical invoices and bills.`}>
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Income</h2>
          <ul className="text-sm">
            {st.income.map((r) => (
              <li key={r.category} className="flex justify-between gap-4 border-b py-1">
                <span>{r.category}</span>
                <span className="tabular-nums">{formatBtn(r.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 font-medium">
              <span>Total income</span>
              <span className="tabular-nums">{formatBtn(st.totalIncome)}</span>
            </li>
          </ul>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Expenses</h2>
          <ul className="text-sm">
            {st.expenses.map((r) => (
              <li key={r.category} className="flex justify-between gap-4 border-b py-1">
                <span>{r.category}</span>
                <span className="tabular-nums">{formatBtn(r.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 font-medium">
              <span>Total expenses</span>
              <span className="tabular-nums">{formatBtn(st.totalExpense)}</span>
            </li>
          </ul>
        </section>
      </div>
      <p className="text-lg font-semibold">Net {formatBtn(st.net)}</p>
    </FinanceShell>
  );
}
