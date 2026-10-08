import {
  AccountForm,
  AssignStatementForm,
  CategoryList,
  ClassifyLineForm,
} from "@/components/erp/finance/StatementForms";
import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { canSeeTaxPack, isDeskAuthenticated } from "@/lib/desk-auth";
import { loadHotelStatement } from "@/lib/finance/hotel-statement";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Statement",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function HotelStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; account?: string; category?: string; side?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : monthStart();
  const to =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : new Date().toISOString().slice(0, 10);
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const showTax = await canSeeTaxPack();
  const statement = await loadHotelStatement(admin, propertyId, from, to);

  const ledger = statement.ledger.filter((row) => {
    if (sp.account && row.accountId !== sp.account) return false;
    if (sp.category && row.category !== sp.category) return false;
    if (sp.side === "credit" && row.income <= 0) return false;
    if (sp.side === "debit" && row.expense <= 0) return false;
    return true;
  });
  const categories = [...new Set(statement.ledger.map((r) => r.category))].sort();

  return (
    <FinanceShell
      showTax={showTax}
      title="Hotel statement"
      description="Income is the folio and the POS ticket. A bank credit clears agent credit, an early collection, or a walk-in — it is not a second sale. Salary comes from the payroll sheets."
      actions={<ExportButtons report="hotel_statement" from={from} to={to} />}
    >
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="text-xs font-medium">
          From
          <input className="mt-1 block h-9 rounded-md border px-2 text-sm" type="date" name="from" defaultValue={from} />
        </label>
        <label className="text-xs font-medium">
          To
          <input className="mt-1 block h-9 rounded-md border px-2 text-sm" type="date" name="to" defaultValue={to} />
        </label>
        <label className="text-xs font-medium">
          Account
          <select className="mt-1 block h-9 rounded-md border px-2 text-sm" name="account" defaultValue={sp.account ?? ""}>
            <option value="">All</option>
            {statement.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Category
          <select className="mt-1 block h-9 rounded-md border px-2 text-sm" name="category" defaultValue={sp.category ?? ""}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Side
          <select className="mt-1 block h-9 rounded-md border px-2 text-sm" name="side" defaultValue={sp.side ?? ""}>
            <option value="">Both</option>
            <option value="credit">Income</option>
            <option value="debit">Expense</option>
          </select>
        </label>
        <button className="h-9 rounded-md border px-3 text-sm" type="submit">
          Apply
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceKpi label="Salary sheets" value={formatBtn(statement.salarySheetTotal)} note="Counted once" />
        <FinanceKpi label="Bank salary left out" value={formatBtn(statement.salaryBankTotal)} note="Linked, not added again" />
        <FinanceKpi label="Other expenditure" value={formatBtn(statement.otherSpend)} />
        <FinanceKpi label="City ledger" value={formatBtn(statement.cityLedgerTotal)} note="Open agent balance" emphasize />
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-base font-semibold">Accounts that pay hotel bills</h2>
        <AccountForm />
        <AssignStatementForm statements={statement.statements} accounts={statement.accounts} />
        {statement.perAccount.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Account</th>
                <th className="py-2 text-right">Opening</th>
                <th className="py-2 text-right">Received</th>
                <th className="py-2 text-right">Paid</th>
                <th className="py-2 text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {statement.perAccount.map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="py-1.5">{a.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatBtn(a.opening)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatBtn(a.received)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatBtn(a.paid)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatBtn(a.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Add the operating account, the owner account, and any related company that pays hotel bills.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Money sent in — not income</h2>
        <ul className="text-sm">
          {statement.transfersIn.length === 0 ? <li className="text-muted-foreground">None classified yet.</li> : null}
          {statement.transfersIn.map((r, i) => (
            <li key={`${r.date}-${i}`}>
              {r.date} · {r.party} · {formatBtn(r.amount)}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Loans</h2>
        <ul className="text-sm">
          {statement.loans.length === 0 ? <li className="text-muted-foreground">None classified yet.</li> : null}
          {statement.loans.map((r, i) => (
            <li key={`${r.date}-${i}`}>
              {r.date} · {r.side === "in" ? "Received" : "Repaid"} · {r.party} · {formatBtn(r.amount)}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Salary from the sheets</h2>
        <ul className="text-sm">
          {statement.salarySheets.map((r) => (
            <li key={r.label}>
              {r.label} · {formatBtn(r.net)}
            </li>
          ))}
          <li className="font-medium">Total {formatBtn(statement.salarySheetTotal)}</li>
        </ul>
      </section>

      <section className="overflow-x-auto">
        <h2 className="mb-2 text-base font-semibold">Expenditure by category and account</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2">Category</th>
              <th className="py-2 text-right">Lines</th>
              {statement.matrixAccounts.map((a) => (
                <th key={a.key} className="py-2 text-right">{a.label}</th>
              ))}
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {statement.matrix.map((row) => (
              <tr key={row.category} className="border-b border-border/60">
                <td className="py-1">{row.category}</td>
                <td className="py-1 text-right tabular-nums">{row.count}</td>
                {statement.matrixAccounts.map((a) => (
                  <td key={a.key} className="py-1 text-right tabular-nums">
                    {formatBtn(row.byAccount[a.key] ?? 0)}
                  </td>
                ))}
                <td className="py-1 text-right tabular-nums">{formatBtn(row.total)}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-2">Hotel expenditure with salary</td>
              <td />
              <td colSpan={statement.matrixAccounts.length} />
              <td className="py-2 text-right tabular-nums">{formatBtn(statement.hotelSpend)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-base font-semibold">City ledger</h2>
          <ul className="text-sm">
            {statement.cityLedger.map((r) => (
              <li key={r.agent}>
                {r.agent} · {formatBtn(r.balance)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-base font-semibold">Early collections not yet income</h2>
          <ul className="text-sm">
            {statement.earlyCollections.length === 0 ? <li className="text-muted-foreground">None classified yet.</li> : null}
            {statement.earlyCollections.map((r, i) => (
              <li key={`${r.date}-${i}`}>
                {r.date} · {r.party} · {formatBtn(r.amount)}
              </li>
            ))}
          </ul>
          <h2 className="mt-4 mb-2 text-base font-semibold">Walk-in and POS</h2>
          <p className="text-sm text-muted-foreground">
            Off the bank until a QR or transfer is matched. Total {formatBtn(statement.walkInTotal)}. Complimentary lines: {statement.comps.length}.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Ledger</h2>
        <p className="text-sm text-muted-foreground">
          Unmatched credits stay out of room income until you classify them. Showing {Math.min(ledger.length, 200)} of {ledger.length}.
        </p>
        <CategoryList />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Account</th>
                <th className="py-2">Category</th>
                <th className="py-2 text-right">Income</th>
                <th className="py-2 text-right">Expense</th>
                <th className="py-2">Classify</th>
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 200).map((row) => (
                <tr key={row.id} className="border-b border-border/60 align-top">
                  <td className="py-1 whitespace-nowrap">{row.date}</td>
                  <td className="py-1">
                    {row.accountLabel}
                    <span className="block max-w-xs truncate text-xs text-muted-foreground">{row.detail}</span>
                  </td>
                  <td className="py-1">{row.category}</td>
                  <td className="py-1 text-right tabular-nums">{row.income ? formatBtn(row.income) : ""}</td>
                  <td className="py-1 text-right tabular-nums">{row.expense ? formatBtn(row.expense) : ""}</td>
                  <td className="py-1">
                    <ClassifyLineForm
                      id={row.id}
                      category={row.category}
                      treatment={row.treatment}
                      party={row.party}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </FinanceShell>
  );
}
