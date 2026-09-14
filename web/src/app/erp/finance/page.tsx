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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildHotelAccountSnapshot } from "@/lib/accounting/hotel-account";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Hotel account | Hotel OS",
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

function SectionHeading({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
          {eyebrow}
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {hint ? (
          <p className="max-w-xl text-sm text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export default async function ErpFinanceOverviewPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const since = monthStartIso();
  const to = todayIso();

  const [snap, paymentsRes, expensesRes, unmatchedRes] = await Promise.all([
    buildHotelAccountSnapshot(admin, propertyId, since, to),
    admin
      .from("payments")
      .select("id, amount_btn, method, reference, notes, created_at, folio_id")
      .eq("property_id", propertyId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
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
  ]);

  const unmatched = (unmatchedRes.data ?? []) as UnmatchedBankTxn[];
  const paymentOptions: FinancePaymentOption[] = (paymentsRes.data ?? []).map(
    (p) => ({
      id: p.id as string,
      amount_btn: Number(p.amount_btn),
      method: p.method as string,
      reference: (p.reference as string | null) ?? null,
      created_at: p.created_at as string,
      label: `${String(p.created_at).slice(0, 10)} · ${formatBtn(Number(p.amount_btn))} · ${p.method}`,
    }),
  );
  const expenseOptions: FinanceExpenseOption[] = (expensesRes.data ?? []).map(
    (e) => ({
      id: e.id as string,
      amount_btn: Number(e.amount_btn),
      description: e.description as string,
      expense_date: e.expense_date as string,
      reference: (e.reference as string | null) ?? null,
    }),
  );

  const att = snap.attention;
  const vault = snap.vault;
  const openAttention = [
    {
      ok: att.unmatchedBank === 0,
      count: att.unmatchedBank,
      title: "Bank lines not matched",
      why: "Statement money that is not yet linked to a payment or expense — vault and bank may disagree.",
      cta: "Match bank",
      href: "/erp/finance/banking",
    },
    {
      ok: att.pendingBankProofs === 0,
      count: att.pendingBankProofs,
      title: "QR / NEFT proofs waiting",
      why: "Guests paid by transfer but staff has not confirmed the bank hit.",
      cta: "Confirm proofs",
      href: "/erp/finance/bank-proofs",
    },
    {
      ok: att.postingErrors === 0,
      count: att.postingErrors,
      title: "Ledger posting errors",
      why: "A charge or payment failed to post to the books. Fix before month close.",
      cta: "View diagnostics",
      href: "/erp/finance/setup",
    },
    {
      ok: att.openBills === 0,
      count: att.openBills,
      title: "Unpaid vendor bills",
      why: "Supplier invoices on AP — cash not yet left the hotel bank.",
      cta: "Vendors & bills",
      href: "/erp/finance/vendors",
    },
    {
      ok: att.unpaidPayslips === 0,
      count: att.unpaidPayslips,
      title: "Unpaid payslips",
      why: "Salaries accrued; bank not reduced until you mark paid.",
      cta: "Payroll",
      href: "/erp/hr/payroll",
    },
    {
      ok: att.openingBalancesPosted,
      count: att.openingBalancesPosted ? 0 : 1,
      title: "Opening balances",
      why: att.openingBalancesPosted
        ? "Starting cash/bank posted — vault numbers are trustworthy."
        : "Set opening cash and bank on go-live so balances make sense.",
      cta: "Setup",
      href: "/erp/finance/setup",
    },
  ];
  const needsWork = openAttention.filter((item) => !item.ok);
  const allClear = needsWork.length === 0;

  return (
    <FinanceShell
      title="Hotel account"
      description="Your single view of hotel money — what is in cash and bank, who still owes you, what you still owe, and what needs your attention before month close. You are the accountant; this screen is the daily book."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/finance/setup">Close month</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/erp/finance/reports">P&L · Balance sheet</Link>
          </Button>
        </>
      }
    >
      {/* Purpose: what this page is for */}
      <section
        aria-labelledby="finance-purpose"
        className="overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.07] via-card to-card"
      >
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 p-5 md:p-7">
            <p
              id="finance-purpose"
              className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase"
            >
              What this page is for
            </p>
            <h2 className="max-w-xl text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Know whether hotel money is real, matched, and ready for tax
              filing — without hiring an accountant.
            </h2>
            <ol className="max-w-xl space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  1
                </span>
                <span>
                  <strong className="font-medium text-foreground">Vault</strong>
                  {" — "}
                  Cash on hand, operating bank, and card clearing. This is
                  money the hotel holds today.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  2
                </span>
                <span>
                  <strong className="font-medium text-foreground">
                    Holding bays
                  </strong>
                  {" — "}
                  Not cash yet: guests/agents who still owe, deposits you keep,
                  bills and payroll you still owe, GST due to RRCO.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  3
                </span>
                <span>
                  <strong className="font-medium text-foreground">
                    Attention queue
                  </strong>
                  {" — "}
                  Fix unmatched bank lines, pending proofs, and posting errors
                  so books equal reality.
                </span>
              </li>
            </ol>
          </div>

          <div className="border-t border-accent/10 bg-background/40 p-5 md:border-t-0 md:border-l md:p-7">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              How money moves
            </p>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Money in",
                  body: "Guest pays, deposit link, POS cash → vault goes up. Charges first sit on AR until paid.",
                  href: "/erp/finance/income",
                },
                {
                  label: "Money out",
                  body: "Expenses, vendor bill payment, payroll paid → vault goes down.",
                  href: "/erp/finance/expenses",
                },
                {
                  label: "Bank truth",
                  body: "Import statement and match until the unmatched queue is zero.",
                  href: "/erp/finance/banking",
                },
              ].map((step) => (
                <Link
                  key={step.href}
                  href={step.href}
                  className="block rounded-xl border bg-card p-3 transition-colors hover:border-accent/40"
                >
                  <p className="text-sm font-medium text-foreground">
                    {step.label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!att.openingBalancesPosted ? (
        <Alert>
          <AlertTitle>Start here: opening balances</AlertTitle>
          <AlertDescription>
            Before you trust cash and bank numbers, post opening balances for
            go-live day (what was really in the vault on day one).{" "}
            <Link
              href="/erp/finance/setup"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Set opening balances
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Vault hero */}
      <section className="space-y-4" aria-labelledby="vault-heading">
        <SectionHeading
          eyebrow="Vault · liquid assets"
          title="Money the hotel holds now"
          hint="Every guest payment and cash sale eventually lands here. Every salary, vendor payment, and expense leaves from here."
          action={
            <p className="text-xs text-muted-foreground">
              Period:{" "}
              <span className="font-medium text-foreground">
                {att.periodLabel ?? "—"}
              </span>
              {att.periodStatus ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {att.periodStatus}
                </span>
              ) : null}
            </p>
          }
        />

        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="rounded-2xl border-2 border-accent/25 bg-card px-6 py-6 md:px-8 md:py-7">
            <p
              id="vault-heading"
              className="text-xs font-medium text-muted-foreground"
            >
              Total liquid (cash + bank + card clearing)
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground tabular-nums md:text-5xl">
              {formatBtn(vault.liquidBtn)}
            </p>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              This is the hotel&apos;s available money per the ledger. Prove it
              against your bank statement in Banking.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/erp/finance/banking">Match bank statement</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/erp/finance/income">See money in</Link>
              </Button>
            </div>
          </div>
          <FinanceKpi
            label="Cash drawer"
            value={formatBtn(vault.cashBtn)}
            note="Physical cash on property"
            href="/erp/pos"
          />
          <FinanceKpi
            label="Bank operating"
            value={formatBtn(vault.bankBtn)}
            note="BoB / BNB / TBank / DrukPNB"
            href="/erp/finance/banking"
          />
          <FinanceKpi
            label="Card clearing"
            value={formatBtn(vault.cardClearingBtn)}
            note="Settled cards not yet banked"
            href="/erp/finance/banking"
          />
        </div>
      </section>

      {/* Month movement */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Month to date">
        <FinanceKpi
          label="Receipts this month"
          value={formatBtn(snap.mtd.receiptsBtn)}
          note="Payments confirmed into vault"
          href="/erp/payments"
          tone="good"
        />
        <FinanceKpi
          label="Expenses this month"
          value={formatBtn(snap.mtd.expensesBtn)}
          note="Cash / bank already spent"
          href="/erp/finance/expenses"
          tone="warn"
        />
        <FinanceKpi
          label="Net receipts − expenses"
          value={formatBtn(snap.mtd.netIncomeBtn)}
          note="Operational cash movement (not full P&L)"
          href="/erp/finance/reports"
        />
      </section>

      {/* Holding bays */}
      <section className="space-y-4" aria-labelledby="holding-heading">
        <SectionHeading
          eyebrow="Holding bays · not vault yet"
          title="Money waiting or owed"
          hint="These balances are intentional. They turn into vault movements when someone pays, you pay a bill, or you file GST."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FinanceKpi
            label="Guests still owe (AR)"
            value={formatBtn(vault.arGuestBtn)}
            note="In-house or checkout balance unpaid"
            href="/erp/folios"
          />
          <FinanceKpi
            label="Agents still owe (AR)"
            value={formatBtn(vault.arAgentBtn)}
            note="Agent credit / agency settlement"
            href="/erp/agents"
          />
          <FinanceKpi
            label="Guest deposits held"
            value={formatBtn(vault.depositsBtn)}
            note="Prepayments not fully applied"
            href="/erp/payments"
          />
          <FinanceKpi
            label="You owe suppliers (AP)"
            value={formatBtn(vault.apBtn)}
            note="Vendor bills not paid from bank"
            href="/erp/finance/vendors"
            tone={vault.apBtn > 0 ? "warn" : "default"}
          />
          <FinanceKpi
            label="You owe staff (payroll)"
            value={formatBtn(vault.payrollPayableBtn)}
            note="Payslips not marked paid"
            href="/erp/hr/payroll"
            tone={vault.payrollPayableBtn > 0 ? "warn" : "default"}
          />
          <FinanceKpi
            label="GST net to RRCO"
            value={formatBtn(vault.gstNetBtn)}
            note="Output tax − input credit"
            href="/erp/finance/gst"
          />
        </div>
      </section>

      {/* Attention */}
      <section className="space-y-4" aria-labelledby="attention-heading">
        <SectionHeading
          eyebrow="Attention queue"
          title={
            allClear
              ? "Nothing blocking you"
              : `${needsWork.length} item${needsWork.length === 1 ? "" : "s"} need your action`
          }
          hint={
            allClear
              ? "Bank matched, proofs clear, no posting errors. You can review P&L or close the month when ready."
              : "Work top to bottom. Clear these so vault numbers and bank statement agree."
          }
          action={
            <ExportButtons report="month_pack" from={since} to={to} />
          }
        />

        {allClear ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-6">
            <p
              id="attention-heading"
              className="text-base font-semibold text-foreground"
            >
              Books look clean for today
            </p>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Optional next steps: download the month pack, check GST pack
              fields, or walk the close checklist.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/erp/finance/gst">Review GST pack</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/erp/finance/setup">Month close checklist</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/erp/finance/reports">View reports</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" id="attention-heading">
            {openAttention.map((item) => (
              <li
                key={item.href + item.title}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-4",
                  item.ok
                    ? "border-border/60 opacity-70"
                    : "border-amber-500/35 bg-amber-500/[0.04]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.ok ? "Clear · " : ""}
                      {item.title}
                      {!item.ok && item.count > 0 ? (
                        <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium tabular-nums text-amber-900 dark:text-amber-200">
                          {item.count}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.why}
                    </p>
                  </div>
                </div>
                <div className="mt-auto pt-3">
                  <Link
                    href={item.href}
                    className={cn(
                      "text-sm font-medium underline-offset-2 hover:underline",
                      item.ok ? "text-muted-foreground" : "text-accent",
                    )}
                  >
                    {item.cta} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Unmatched bank — primary workbench */}
      <section className="space-y-4" aria-labelledby="bank-queue-heading">
        <SectionHeading
          eyebrow="Bank workbench"
          title="Unmatched bank transactions"
          hint="Every bank line should link to a payment (money in) or an expense/bill (money out). Create a record if none exists."
          action={
            <div className="flex flex-wrap items-center gap-2">
              {unmatched.length > 0 ? <AutoMatchButton /> : null}
              <Button asChild size="sm" variant="outline">
                <Link href="/erp/finance/banking">Full banking</Link>
              </Button>
            </div>
          }
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle
              id="bank-queue-heading"
              className="text-sm font-medium text-foreground"
            >
              {unmatched.length === 0
                ? "Queue empty"
                : `${unmatched.length} line${unmatched.length === 1 ? "" : "s"} waiting`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unmatched.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bank statement lines are matched to the hotel account. Import
                the next statement when it arrives.
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
      </section>

      {/* Quick capture — secondary */}
      <section className="space-y-4" aria-labelledby="quick-heading">
        <SectionHeading
          eyebrow="Quick capture"
          title="Record a one-off expense or import a bank file"
          hint="Day-to-day guest money is posted from folio, POS, and check-out — use these only for invoices you paid or bank statement JSON."
        />
        <div className="grid gap-6 lg:grid-cols-2" id="quick-heading">
          <ExpenseForm />
          <ImportStatementForm />
        </div>
      </section>

      {/* Guide map */}
      <section
        aria-label="Where to go next"
        className="rounded-2xl border bg-muted/30 p-5 md:p-6"
      >
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Map of the finance module
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/erp/finance/income",
              title: "Money in",
              body: "Sales and receipts — who paid and what was charged.",
            },
            {
              href: "/erp/finance/expenses",
              title: "Money out",
              body: "Expenses and costs that already left cash or bank.",
            },
            {
              href: "/erp/finance/gst",
              title: "GST pack",
              body: "Monthly A–E totals for BITS / RRCO filing.",
            },
            {
              href: "/erp/finance/setup",
              title: "Close the month",
              body: "Checklist, opening balances, lock the period.",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-accent/40"
            >
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </FinanceShell>
  );
}
