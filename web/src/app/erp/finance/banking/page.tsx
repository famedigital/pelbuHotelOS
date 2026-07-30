import {
  AutoMatchButton,
  UnmatchedTxnRow,
  type FinanceExpenseOption,
  type FinancePaymentOption,
  type UnmatchedBankTxn,
} from "@/components/erp/FinanceForms";
import { BankingImportWorkbench } from "@/components/erp/finance/BankingImportWorkbench";
import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Banking | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FinanceBankingPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const from = monthStart();
  const to = new Date().toISOString().slice(0, 10);

  const [unmatchedRes, statementsRes, matchesRes, paymentsRes, expensesRes] =
    await Promise.all([
      admin
        .from("bank_transactions")
        .select(
          "id, bank_code, txn_date, description, debit_btn, credit_btn, reference, match_status",
        )
        .eq("property_id", propertyId)
        .eq("match_status", "unmatched")
        .order("txn_date", { ascending: false })
        .limit(100),
      admin
        .from("bank_statements")
        .select(
          "id, bank_code, account_label, period_start, period_end, source_filename, status, created_at, parser_version_id, import_batch_id",
        )
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("bank_recon_matches")
        .select("id, matched_amount_btn, match_kind, matched_at, bank_txn_id")
        .eq("property_id", propertyId)
        .order("matched_at", { ascending: false })
        .limit(50),
      admin
        .from("payments")
        .select("id, amount_btn, method, reference, created_at")
        .eq("property_id", propertyId)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("expenses")
        .select("id, amount_btn, description, expense_date, reference")
        .eq("property_id", propertyId)
        .order("expense_date", { ascending: false })
        .limit(100),
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

  return (
    <FinanceShell
      title="Banking & reconciliation"
      description="Upload bank PDFs with approved parsers, review staged rows, then match payments and expenses."
      actions={<ExportButtons report="bank_recon" from={from} to={to} />}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpi label="Unmatched lines" value={String(unmatched.length)} />
        <FinanceKpi
          label="Matched (recent)"
          value={String((matchesRes.data ?? []).length)}
        />
        <FinanceKpi
          label="Statements imported"
          value={String((statementsRes.data ?? []).length)}
        />
      </div>

      <BankingImportWorkbench
        payments={paymentOptions}
        expenses={expenseOptions}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Imported statements</CardTitle>
        </CardHeader>
        <CardContent>
          {(statementsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No statements yet. Upload a PDF above or paste offline JSON.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {(statementsRes.data ?? []).map((s) => (
                <li key={s.id as string} className="py-2">
                  <p className="font-medium">
                    {(s.bank_code as string).toUpperCase()} ·{" "}
                    {(s.account_label as string) ?? "Account"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.period_start as string} → {s.period_end as string} ·{" "}
                    {s.status as string} · {s.source_filename as string}
                    {s.import_batch_id
                      ? ` · batch ${String(s.import_batch_id).slice(0, 8)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Unmatched queue</CardTitle>
          {unmatched.length > 0 ? <AutoMatchButton /> : null}
        </CardHeader>
        <CardContent>
          {unmatched.length === 0 ? (
            <p className="text-sm text-muted-foreground">All clear.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent matches</CardTitle>
        </CardHeader>
        <CardContent>
          {(matchesRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(matchesRes.data ?? []).map((m) => (
                <li
                  key={m.id as string}
                  className="flex justify-between gap-3 py-2"
                >
                  <span>
                    {(m.match_kind as string) === "auto" ? "Auto" : "Manual"} ·{" "}
                    {String(m.matched_at).slice(0, 16).replace("T", " ")}
                  </span>
                  <span className="tabular-nums">
                    {formatBtn(Number(m.matched_amount_btn))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </FinanceShell>
  );
}
