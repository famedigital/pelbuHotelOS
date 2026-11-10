import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { loadRrcoView } from "@/lib/finance/rrco-pack";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RRCO balance sheet", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RrcoBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = Number((await searchParams).year) || new Date().getFullYear();
  const admin = createSupabaseAdminClient();
  const view = await loadRrcoView(admin, await resolveActivePropertyId(admin), year);
  const st = view.statements;
  return (
    <FinanceShell showTax title="RRCO balance sheet" description="Agent city ledger sits with the bank. Opening and unclassified is the plug so the sheet still shows what is not yet named.">
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Assets</h2>
          {st.assets.map((r) => (
            <p key={r.label} className="flex justify-between border-b py-1 text-sm">
              <span>{r.label}</span>
              <span className="tabular-nums">{formatBtn(r.amount)}</span>
            </p>
          ))}
          <p className="flex justify-between py-2 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatBtn(st.assetTotal)}</span>
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Liabilities and equity</h2>
          {[...st.liabilities, ...st.equity].map((r) => (
            <p key={r.label} className="flex justify-between border-b py-1 text-sm">
              <span>{r.label}</span>
              <span className="tabular-nums">{formatBtn(r.amount)}</span>
            </p>
          ))}
          <p className="flex justify-between py-2 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatBtn(st.rightTotal)}</span>
          </p>
        </section>
      </div>
    </FinanceShell>
  );
}
