import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
} from "@/lib/accounting/reports";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Reports",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const params = await searchParams;
  const from = params.from || monthStart();
  const to = params.to || new Date().toISOString().slice(0, 10);
  const report = params.report || "pnl";

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [pnl, trial, balance] = await Promise.all([
    buildProfitAndLoss(admin, propertyId, from, to),
    buildTrialBalance(admin, propertyId, from, to),
    buildBalanceSheet(admin, propertyId, to),
  ]);

  const reports = [
    { id: "pnl", label: "Profit & loss" },
    { id: "trial", label: "Trial balance" },
    { id: "balance", label: "Balance sheet" },
    { id: "income", label: "Income register" },
    { id: "expenses", label: "Expense register" },
    { id: "gst", label: "GST" },
    { id: "journals", label: "Journal register" },
    { id: "month_pack", label: "Month-end pack" },
  ];

  return (
    <FinanceShell
      title="Financial statements"
      description="Ledger-backed P&L, trial balance, balance sheet, and operational registers — all Excel-downloadable."
      actions={<ExportButtons report={report} from={from} to={to} />}
    >
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="from">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-9 rounded-md border px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="to">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="h-9 rounded-md border px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="report">
            Report
          </label>
          <select
            id="report"
            name="report"
            defaultValue={report}
            className="h-9 rounded-md border px-2 text-sm"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground"
        >
          Run
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpi label="Net income" value={formatBtn(pnl.netIncome)} />
        <FinanceKpi label="Total assets" value={formatBtn(balance.totalAssets)} />
        <FinanceKpi
          label="Liabilities + equity"
          value={formatBtn(balance.totalLiabilitiesEquity)}
          note={
            Math.abs(balance.totalAssets - balance.totalLiabilitiesEquity) < 0.02
              ? "In balance"
              : "Check opening balances / postings"
          }
        />
      </div>

      {report === "pnl" || report === "month_pack" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Income</CardTitle>
            </CardHeader>
            <CardContent>
              <StatementTable rows={pnl.income} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Expenses & COGS</CardTitle>
            </CardHeader>
            <CardContent>
              <StatementTable rows={pnl.expenses} />
              <p className="mt-4 border-t pt-3 text-sm font-medium">
                Net income: {formatBtn(pnl.netIncome)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {report === "trial" || report === "month_pack" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trial balance</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3 text-right">Open Dr</th>
                  <th className="py-2 pr-3 text-right">Open Cr</th>
                  <th className="py-2 pr-3 text-right">Period Dr</th>
                  <th className="py-2 pr-3 text-right">Period Cr</th>
                  <th className="py-2 pr-3 text-right">Close Dr</th>
                  <th className="py-2 text-right">Close Cr</th>
                </tr>
              </thead>
              <tbody>
                {trial.map((row) => (
                  <tr key={row.accountId} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{row.code}</td>
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.openingDebit ? formatBtn(row.openingDebit) : ""}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.openingCredit ? formatBtn(row.openingCredit) : ""}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.periodDebit ? formatBtn(row.periodDebit) : ""}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.periodCredit ? formatBtn(row.periodCredit) : ""}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.closingDebit ? formatBtn(row.closingDebit) : ""}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.closingCredit ? formatBtn(row.closingCredit) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {report === "balance" || report === "month_pack" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <StatementTable rows={balance.assets} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Liabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <StatementTable rows={balance.liabilities} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <StatementTable rows={balance.equity} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Also available</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>General ledger / account ledger (via journals export)</p>
          <p>Cash book & bank book (banking export)</p>
          <p>AR / AP aging (guest, agent, vendor)</p>
          <p>Department / outlet profitability</p>
          <p>Room revenue, ADR, RevPAR (sellable only)</p>
          <p>Budget vs actual, payroll cost, inventory valuation</p>
          <p>Fixed-asset depreciation schedule</p>
          <p>Night-audit financial pack & audit trail</p>
          <p>Cash flow statement & statement of changes in equity</p>
          <p>Outstanding deposits / refunds</p>
        </CardContent>
      </Card>
    </FinanceShell>
  );
}

function StatementTable({
  rows,
}: {
  rows: { code: string; name: string; amount: number }[];
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">No movements in this range.</p>
    );
  }
  return (
    <ul className="divide-y text-sm">
      {rows.map((row) => (
        <li key={row.code + row.name} className="flex justify-between gap-3 py-2">
          <span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.code}
            </span>{" "}
            {row.name}
          </span>
          <span className="tabular-nums">{formatBtn(row.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
