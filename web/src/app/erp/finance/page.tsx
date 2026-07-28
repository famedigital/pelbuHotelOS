import {
  AutoMatchButton,
  ExpenseForm,
  ImportStatementForm,
  UnmatchedTxnRow,
  type FinanceExpenseOption,
  type FinancePaymentOption,
  type UnmatchedBankTxn,
} from "@/components/erp/FinanceForms";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
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

export default async function ErpFinancePage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  const propertyId = property?.id as string | undefined;

  if (!propertyId) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Finance" />
        <main className="mx-auto max-w-[1200px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const since = monthStartIso();

  const [
    paymentsRes,
    expensesRes,
    folioGstRes,
    unmatchedRes,
    statementsRes,
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
      .from("folios")
      .select("id, folio_lines(gst_btn, total_btn, status, created_at)")
      .eq("property_id", propertyId)
      .limit(200),
    admin
      .from("bank_transactions")
      .select(
        "id, bank_code, txn_date, description, debit_btn, credit_btn, reference, match_status",
      )
      .eq("property_id", propertyId)
      .eq("match_status", "unmatched")
      .order("txn_date", { ascending: false })
      .limit(50),
    admin
      .from("bank_statements")
      .select("id, bank_code, account_label, period_start, period_end, source_filename, status, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const monthPayments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const unmatched = (unmatchedRes.data ?? []) as UnmatchedBankTxn[];
  const statements = statementsRes.data ?? [];

  const folioLines = (folioGstRes.data ?? []).flatMap((folio) => {
    const lines =
      (folio.folio_lines as
        | { gst_btn: number; total_btn: number; status: string; created_at: string }[]
        | null) ?? [];
    return lines.filter(
      (l) => l.status === "posted" && String(l.created_at) >= since,
    );
  });

  const paymentsTotal = monthPayments.reduce(
    (s, p) => s + Number(p.amount_btn ?? 0),
    0,
  );
  const expensesTotal = expenses
    .filter((e) => String(e.expense_date) >= since)
    .reduce((s, e) => s + Number(e.amount_btn ?? 0), 0);
  const gstCollected = folioLines.reduce((s, l) => s + Number(l.gst_btn ?? 0), 0);
  const salesPosted = folioLines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);

  const paymentOptions: FinancePaymentOption[] = monthPayments.map((p) => ({
    id: p.id as string,
    amount_btn: Number(p.amount_btn),
    method: p.method as string,
    reference: (p.reference as string | null) ?? null,
    created_at: p.created_at as string,
    label: `${String(p.created_at).slice(0, 10)} · ${formatBtn(Number(p.amount_btn))} · ${p.method}${
      p.reference ? ` · ${p.reference}` : ""
    }`,
  }));

  const expenseOptions: FinanceExpenseOption[] = expenses.map((e) => ({
    id: e.id as string,
    amount_btn: Number(e.amount_btn),
    description: e.description as string,
    expense_date: e.expense_date as string,
    reference: (e.reference as string | null) ?? null,
  }));

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Finance" />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </p>
        ) : null}

        <section>
          <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            This month
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Payments in" value={formatBtn(paymentsTotal)} />
            <Stat label="Folio sales posted" value={formatBtn(salesPosted)} />
            <Stat label="GST on folio lines" value={formatBtn(gstCollected)} />
            <Stat label="Expenses" value={formatBtn(expensesTotal)} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Unmatched bank lines: {unmatched.length}
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <ExpenseForm />
          <ImportStatementForm />
        </div>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Unmatched bank transactions
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted">{unmatched.length}</p>
              {unmatched.length > 0 ? <AutoMatchButton /> : null}
            </div>
          </div>
          {unmatched.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Queue empty — import a statement JSON from{" "}
              <code className="font-mono text-xs">scripts/bank-recon</code>.
            </p>
          ) : (
            <ul className="mt-2">
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
        </section>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Recent expenses
            </h2>
          </div>
          {expenses.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No expenses yet.</p>
          ) : (
            <ul className="mt-2">
              {expenses.map((e) => (
                <li
                  key={e.id as string}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-espresso/10 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-espresso">
                      {e.expense_date as string} · {e.description as string}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {e.category as string}
                      {e.vendor ? ` · ${e.vendor as string}` : ""} ·{" "}
                      {e.payment_method as string}
                    </p>
                  </div>
                  <p className="tabular-nums text-espresso">
                    {formatBtn(Number(e.amount_btn))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Imported statements
            </h2>
          </div>
          {statements.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No statements imported yet.</p>
          ) : (
            <ul className="mt-2">
              {statements.map((s) => (
                <li
                  key={s.id as string}
                  className="border-b border-espresso/10 py-3 text-sm"
                >
                  <p className="font-medium text-espresso">
                    {(s.bank_code as string).toUpperCase()} ·{" "}
                    {(s.source_filename as string) ?? "statement"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {(s.account_label as string) ?? "—"} · {s.status as string} ·{" "}
                    {s.period_start ? `${s.period_start} → ${s.period_end}` : "period n/a"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-espresso/10 bg-white px-4 py-4">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-gold uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg tabular-nums text-espresso">{value}</p>
    </div>
  );
}
