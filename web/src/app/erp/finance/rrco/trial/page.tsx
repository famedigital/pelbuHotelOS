import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { loadRrcoView } from "@/lib/finance/rrco-pack";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RRCO trial balance", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RrcoTrialPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = Number((await searchParams).year) || new Date().getFullYear();
  const admin = createSupabaseAdminClient();
  const view = await loadRrcoView(admin, await resolveActivePropertyId(admin), year);
  const st = view.statements;
  return (
    <FinanceShell showTax title="RRCO trial balance" description={st.balanced ? "Debits equal credits." : "Out of balance — review unclassified lines."}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
            <th className="py-2">Account</th>
            <th className="py-2 text-right">Debit</th>
            <th className="py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {st.trial.map((row) => (
            <tr key={row.label} className="border-b border-border/60">
              <td className="py-1">{row.label}</td>
              <td className="py-1 text-right tabular-nums">{row.debit ? formatBtn(row.debit) : ""}</td>
              <td className="py-1 text-right tabular-nums">{row.credit ? formatBtn(row.credit) : ""}</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-2">Total</td>
            <td className="py-2 text-right tabular-nums">{formatBtn(st.trialDebit)}</td>
            <td className="py-2 text-right tabular-nums">{formatBtn(st.trialCredit)}</td>
          </tr>
        </tbody>
      </table>
    </FinanceShell>
  );
}
