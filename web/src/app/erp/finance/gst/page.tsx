import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildGstReport } from "@/lib/accounting/reports";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · GST | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FinanceGstPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const from = monthStart();
  const to = new Date().toISOString().slice(0, 10);
  const gst = await buildGstReport(admin, propertyId, from, to);

  return (
    <FinanceShell
      title="GST returns"
      description="Output tax from sales, input credit from expenses, and net payable for the month."
      actions={
        <>
          <ExportButtons report="gst" from={from} to={to} />
          <Link
            href="/erp/gst"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Classic GST page
          </Link>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpi label="GST output" value={formatBtn(gst.output)} />
        <FinanceKpi label="GST input" value={formatBtn(gst.input)} />
        <FinanceKpi label="Net payable" value={formatBtn(gst.netPayable)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Output detail</CardTitle>
          </CardHeader>
          <CardContent>
            {gst.outputRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No GST output posted in the ledger this month.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {gst.outputRows.map((row, i) => (
                  <li key={`${row.accountId}-${i}`} className="flex justify-between py-2">
                    <span>
                      {row.code} · {row.name}
                    </span>
                    <span className="tabular-nums">{formatBtn(row.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Input detail</CardTitle>
          </CardHeader>
          <CardContent>
            {gst.inputRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No GST input posted in the ledger this month.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {gst.inputRows.map((row, i) => (
                  <li key={`${row.accountId}-${i}`} className="flex justify-between py-2">
                    <span>
                      {row.code} · {row.name}
                    </span>
                    <span className="tabular-nums">{formatBtn(row.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </FinanceShell>
  );
}
