import {
  AutoMatchButton,
  ExpenseForm,
  ImportStatementForm,
  UnmatchedTxnRow,
  type FinanceExpenseOption,
  type FinancePaymentOption,
  type UnmatchedBankTxn,
} from "@/components/erp/FinanceForms";
import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildGstReport,
  buildProfitAndLoss,
} from "@/lib/accounting/reports";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ErpFinanceOverviewPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const since = monthStartIso();
  const to = todayIso();

  const [
    paymentsRes,
    expensesRes,
    unmatchedRes,
    postingErrorsRes,
    openingRes,
    periodRes,
  ] = await Promise.all([
    admin
      .from("payments")
      .select("id, amount_btn, method, reference, notes, created_at, folio_id")
      .eq("property_id", propertyId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("expenses")
      .select(
        "id, category, description, amount_btn, gst_btn, expense_date, vendor, payment_method, reference, created_at",
      )
      .eq("property_id", propertyId)
      .order("expense_date", { ascending: false })
      .limit(50),
    admin
      .from("bank_transactions")
      .select(
        "id, bank_code, txn_date, description, debit_btn, credit_btn, reference, match_status",
      )
      .eq("property_id", propertyId)
      .eq("match_status", "unmatched")
      .order("txn_date", { ascending: false })
      .limit(20),
    admin
      .from("accounting_posting_events")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "error"),
    admin
      .from("accounting_opening_balances")
      .select("status, effective_date")
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("accounting_periods")
      .select("id, label, status")
      .eq("property_id", propertyId)
      .lte("starts_on", to)
      .gte("ends_on", to)
      .maybeSingle(),
  ]);

  const [pnl, gst] = await Promise.all([
    buildProfitAndLoss(admin, propertyId, since, to),
    buildGstReport(admin, propertyId, since, to),
  ]);

  const monthPayments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const unmatched = (unmatchedRes.data ?? []) as UnmatchedBankTxn[];
  const paymentsTotal = monthPayments.reduce(
    (s, p) => s + Number(p.amount_btn ?? 0),
    0,
  );
  const expensesTotal = expenses
    .filter((e) => String(e.expense_date) >= since)
    .reduce((s, e) => s + Number(e.amount_btn ?? 0), 0);

  const paymentOptions: FinancePaymentOption[] = monthPayments.map((p) => ({
    id: p.id as string,
    amount_btn: Number(p.amount_btn),
    method: p.method as string,
    reference: (p.reference as string | null) ?? null,
    created_at: p.created_at as string,
    label: `${String(p.created_at).slice(0, 10)} · ${formatBtn(Number(p.amount_btn))} · ${p.method}`,
  }));
  const expenseOptions: FinanceExpenseOption[] = expenses.map((e) => ({
    id: e.id as string,
    amount_btn: Number(e.amount_btn),
    description: e.description as string,
    expense_date: e.expense_date as string,
    reference: (e.reference as string | null) ?? null,
  }));

  return (
    <FinanceShell
      title="Finance overview"
      description="Double-entry hotel ledger with income, expenses, bank recon, GST, and downloadable statements."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/finance/setup">Opening balances</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/erp/finance/reports">Statements</Link>
          </Button>
        </>
      }
    >
      {!deskPinConfigured() ? (
        <Alert variant="warning">
          <AlertTitle>Dev mode</AlertTitle>
          <AlertDescription>
            Desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </AlertDescription>
        </Alert>
      ) : null}

      {openingRes.data?.status !== "posted" ? (
        <Alert>
          <AlertTitle>Opening balances required</AlertTitle>
          <AlertDescription>
            Set and post opening balances as of a go-live date before relying on
            trial balance and balance sheet.{" "}
            <Link href="/erp/finance/setup" className="underline">
              Open setup
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceKpi
          label="Net income (MTD)"
          value={formatBtn(pnl.netIncome)}
          note="From posted ledger"
        />
        <FinanceKpi label="Cash & receipts (MTD)" value={formatBtn(paymentsTotal)} />
        <FinanceKpi label="Expenses (MTD)" value={formatBtn(expensesTotal)} />
        <FinanceKpi
          label="GST net payable"
          value={formatBtn(gst.netPayable)}
          note={`Output ${formatBtn(gst.output)} − input ${formatBtn(gst.input)}`}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="text-sm text-muted-foreground">
          Period: <span className="text-foreground">{periodRes.data?.label ?? "—"}</span>
          {" · "}
          Status:{" "}
          <span className="text-foreground">
            {periodRes.data?.status ?? "n/a"}
          </span>
          {" · "}
          Posting errors: {postingErrorsRes.count ?? 0}
          {" · "}
          Unmatched bank: {unmatched.length}
        </div>
        <ExportButtons report="month_pack" from={since} to={to} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ExpenseForm />
        <ImportStatementForm />
      </div>

      <Card>
        <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-3">
          <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Unmatched bank transactions
          </CardTitle>
          <div className="flex items-center gap-3">
            <Link
              href="/erp/finance/banking"
              className="text-xs text-muted-foreground underline"
            >
              Full banking
            </Link>
            {unmatched.length > 0 ? <AutoMatchButton /> : null}
          </div>
        </CardHeader>
        <CardContent>
          {unmatched.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Queue empty — import a statement on Banking.
            </p>
          ) : (
            <ul className="divide-y">
              {unmatched.map((txn) => (
                <UnmatchedTxnRow
                  key={txn.id}
                  txn={txn}
                  payments={paymentOptions}
                  expenses={expenseOptions}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            href: "/erp/finance/reports?report=pnl",
            title: "Profit & loss",
            body: "Departmental income statement with Excel download.",
          },
          {
            href: "/erp/finance/reports?report=trial",
            title: "Trial balance",
            body: "Opening, period movement, and closing balances.",
          },
          {
            href: "/erp/finance/reports?report=balance",
            title: "Balance sheet",
            body: "Assets, liabilities, and equity as of today.",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border bg-card p-5 transition-colors hover:border-accent/50"
          >
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          </Link>
        ))}
      </div>
    </FinanceShell>
  );
}
