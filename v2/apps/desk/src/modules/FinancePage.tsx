import { useEffect, useMemo, useState, useTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Download,
  Printer,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  GlassTiltCard,
  ModuleFrame,
  MorphTabs,
  StatusLegend,
} from "@hos-v2/ui";
import {
  folioTotals,
  formatNu,
  useFrontOfficeStore,
} from "../lib/front-office-store";
import { useCommercialStore } from "../lib/commercial-store";
import { useExtrasStore } from "../lib/extras-store";
import { useSettingsStore } from "../lib/settings-store";
import { useFiscalStore } from "../lib/fiscal-store";
import { useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import {
  agentArTotal,
  buildBalanceSheet,
  buildBankReconSummary,
  buildChartOfAccounts,
  buildExpenseGlance,
  buildExpenseRows,
  buildIncomeGlance,
  buildIncomeRows,
  buildProfitAndLoss,
  buildTrialBalance,
  defaultPeriod,
  exportCsv,
  type MoneyFilter,
} from "../lib/finance-reports";
import { PaidUnpaidBar } from "./PaidUnpaidBar";

type FinTab =
  | "overview"
  | "income"
  | "expense"
  | "recon"
  | "pl"
  | "bs"
  | "tb"
  | "fiscal"
  | "till";

const FIN_TABS: readonly FinTab[] = [
  "overview",
  "income",
  "expense",
  "recon",
  "pl",
  "bs",
  "tb",
  "fiscal",
  "till",
] as const;

function parseFinTab(raw: string | null): FinTab {
  if (raw && (FIN_TABS as readonly string[]).includes(raw)) return raw as FinTab;
  return "overview";
}

export function FinancePage() {
  const [, start] = useTransition();
  const [searchParams, setSearchParams] = useSearchParams();
  const period0 = defaultPeriod();
  const [tab, setTabState] = useState<FinTab>(() =>
    parseFinTab(searchParams.get("tab")),
  );
  const [from, setFrom] = useState(period0.from);
  const [to, setTo] = useState(period0.to);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MoneyFilter["status"]>("all");
  const [dept, setDept] = useState<MoneyFilter["dept"]>("all");

  const setTab = (next: FinTab) => {
    setTabState(next);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "overview") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    const fromUrl = parseFinTab(searchParams.get("tab"));
    setTabState((cur) => (cur === fromUrl ? cur : fromUrl));
  }, [searchParams]);

  const docs = useExtrasStore((s) => s.fiscalDocs);
  const shifts = useExtrasStore((s) => s.tillShifts);
  const deposits = useExtrasStore((s) => s.bankDeposits);
  const issueFiscal = useExtrasStore((s) => s.issueFiscal);
  const markFiscalPaid = useExtrasStore((s) => s.markFiscalPaid);
  const peekGaplessDocNo = useExtrasStore((s) => s.peekGaplessDocNo);
  const closeTillShift = useExtrasStore((s) => s.closeTillShift);
  const matchDeposit = useExtrasStore((s) => s.matchDeposit);
  const agents = useCommercialStore((s) => s.agents);
  const stays = useFrontOfficeStore((s) => s.stays);
  const purchases = useFiscalStore((s) => s.purchases);
  const tillBalance = useFiscalStore((s) => s.tillBalance);
  const bankLines = useEnterpriseOpsStore((s) => s.bankLines);
  const tpn = useSettingsStore((s) => s.tpn);
  const drcEinvoiceStatus = useSettingsStore((s) => s.drcEinvoiceStatus);

  const [count, setCount] = useState(48250);
  const [depAmt, setDepAmt] = useState(40000);
  const [depRef, setDepRef] = useState("BNB-WIRE-9921");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filter: MoneyFilter = useMemo(
    () => ({ from, to, query, status, dept }),
    [from, to, query, status, dept],
  );

  const income = useMemo(
    () => buildIncomeRows({ stays, fiscalDocs: docs, filter }),
    [stays, docs, filter],
  );
  const expenses = useMemo(
    () => buildExpenseRows({ purchases, filter }),
    [purchases, filter],
  );

  const guestAr = stays
    .filter((s) => s.status === "checked_in")
    .reduce((sum, s) => sum + Math.max(0, folioTotals(s).balance), 0);
  const agentAr = agentArTotal(agents);
  const recon = buildBankReconSummary(bankLines);

  const accounts = useMemo(
    () =>
      buildChartOfAccounts({
        income,
        expenses,
        guestAr,
        agentAr,
        tillBalance,
        bankOpenIn: recon.openIn,
      }),
    [income, expenses, guestAr, agentAr, tillBalance, recon.openIn],
  );
  const pl = useMemo(() => buildProfitAndLoss(accounts), [accounts]);
  const bs = useMemo(() => buildBalanceSheet(accounts), [accounts]);
  const tb = useMemo(() => buildTrialBalance(accounts), [accounts]);

  const incomeTotal = income.reduce((s, r) => s + r.amount, 0);
  const incomePaid = income.reduce((s, r) => s + r.paid, 0);
  const expenseTotal = expenses.reduce((s, r) => s + r.amount, 0);
  const incomeGlance = useMemo(() => buildIncomeGlance(income), [income]);
  const expenseGlance = useMemo(() => buildExpenseGlance(expenses), [expenses]);

  const openShift = shifts.find((s) => !s.closedAt);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (status === "paid" && d.status !== "paid") return false;
      if (status === "unpaid" && d.status === "paid") return false;
      const d0 = d.at.slice(0, 10);
      if (d0 < from || d0 > to) return false;
      if (!q) return true;
      return (
        d.docNo.toLowerCase().includes(q) ||
        d.party.toLowerCase().includes(q) ||
        d.kind.toLowerCase().includes(q)
      );
    });
  }, [docs, query, status, from, to]);

  function exportIncome() {
    const res = exportCsv(
      `income-${from}_${to}.csv`,
      ["Date", "Source", "Ref", "Party", "Dept", "Amount", "Paid", "Balance", "Status"],
      income.map((r) => [
        r.date,
        r.source,
        r.ref,
        r.party,
        r.dept,
        String(r.amount),
        String(r.paid),
        String(r.balance),
        r.status,
      ]),
    );
    toast.success(`Exported ${res.rows} income rows`, { description: res.filename });
  }

  function exportExpenses() {
    const res = exportCsv(
      `expenses-${from}_${to}.csv`,
      ["Date", "Ref", "Party", "Category", "Amount", "Mode", "Status"],
      expenses.map((r) => [
        r.date,
        r.ref,
        r.party,
        r.category,
        String(r.amount),
        r.paymentMode,
        r.status,
      ]),
    );
    toast.success(`Exported ${res.rows} expense rows`, { description: res.filename });
  }

  function exportStatement(kind: "pl" | "bs" | "tb") {
    if (kind === "pl") {
      const res = exportCsv(
        `profit-loss-${from}_${to}.csv`,
        ["Code", "Account", "Side", "Amount"],
        pl.lines.map((l) => [l.code, l.label, l.side, String(l.amount)]),
      );
      toast.success(`P&L exported · ${res.rows} lines`);
      return;
    }
    if (kind === "bs") {
      const rows = [
        ...bs.assets.map((a) => ["asset", a.code, a.name, String(a.balance)]),
        ...bs.liabilities.map((a) => [
          "liability",
          a.code,
          a.name,
          String(a.balance),
        ]),
        ...bs.equity.map((a) => ["equity", a.code, a.name, String(a.balance)]),
      ];
      const res = exportCsv(
        `balance-sheet-${from}_${to}.csv`,
        ["Type", "Code", "Account", "Balance"],
        rows,
      );
      toast.success(`Balance sheet exported · ${res.rows} lines`);
      return;
    }
    const res = exportCsv(
      `trial-balance-${from}_${to}.csv`,
      ["Code", "Account", "Debit", "Credit"],
      tb.map((l) => [l.code, l.account, String(l.debit), String(l.credit)]),
    );
    toast.success(`Trial balance exported · ${res.rows} lines`);
  }

  return (
    <ModuleFrame
      title="Finance Hub"
      description="Income · expense · bank recon · P&L · balance sheet · trial balance · fiscal"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "cash", label: "Cash", swatch: "var(--hos-emerald)" },
              { id: "ar", label: "AR", swatch: "var(--hos-brass)" },
              { id: "tax", label: "Tax", swatch: "var(--hos-primary)" },
            ]}
          />
          <Badge tone="default" className="border border-[var(--hos-primary)]">
            {from} → {to}
          </Badge>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="hos-glass-card flex flex-wrap items-end gap-2 p-3">
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs text-[var(--hos-ink)]"
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs text-[var(--hos-ink)]"
            />
          </label>
          <div className="hos-search-field min-w-[180px] flex-1">
            <Search className="hos-search-icon" strokeWidth={1.75} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search party · ref · journal"
              className="hos-search-input w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] py-2 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "paid", "unpaid"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize ${
                  status === s
                    ? "border-[var(--hos-primary)] text-[var(--hos-primary)]"
                    : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "rooms", "fnb", "other"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDept(d)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize ${
                  dept === d
                    ? "border-[var(--hos-primary)] text-[var(--hos-primary)]"
                    : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <GlassTiltCard className="p-3.5" glowColor="emerald">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Income</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{formatNu(incomeTotal)}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="brass">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Collected</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{formatNu(incomePaid)}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="brand">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Expenses</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{formatNu(expenseTotal)}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="emerald">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Net (P&L)</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{formatNu(pl.netProfit)}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="brand">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Bank open</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{formatNu(recon.openIn + recon.openOut)}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="brass">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">AR total</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{formatNu(guestAr + agentAr)}</div>
          </GlassTiltCard>
        </div>

        <MorphTabs
          glowId="finHubTab"
          value={tab}
          onChange={(id) => setTab(parseFinTab(id))}
          size="md"
          items={[
            { id: "overview", label: "Overview" },
            { id: "income", label: "Income", count: income.length },
            { id: "expense", label: "Expense", count: expenses.length },
            { id: "recon", label: "Bank recon", count: recon.open },
            { id: "pl", label: "P&L" },
            { id: "bs", label: "Balance sheet" },
            { id: "tb", label: "Trial balance" },
            { id: "fiscal", label: "Fiscal", count: docs.length },
            { id: "till", label: "Till" },
          ]}
        />

        {tab === "overview" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-4">
              <h3 className="m-0 text-sm font-bold">Period snapshot</h3>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <dt className="text-[var(--hos-ink-3)]">Room + fiscal income</dt>
                <dd className="text-right font-mono font-semibold">{formatNu(incomeTotal)}</dd>
                <dt className="text-[var(--hos-ink-3)]">Purchase expenses</dt>
                <dd className="text-right font-mono font-semibold">{formatNu(expenseTotal)}</dd>
                <dt className="text-[var(--hos-ink-3)]">Guest AR</dt>
                <dd className="text-right font-mono">{formatNu(guestAr)}</dd>
                <dt className="text-[var(--hos-ink-3)]">Agent AR</dt>
                <dd className="text-right font-mono">{formatNu(agentAr)}</dd>
                <dt className="text-[var(--hos-ink-3)]">Bank match %</dt>
                <dd className="text-right font-mono">{recon.matchPct}%</dd>
                <dt className="text-[var(--hos-ink-3)]">Till balance</dt>
                <dd className="text-right font-mono">{formatNu(tillBalance)}</dd>
              </dl>
            </GlassPanel>
            <GlassPanel className="p-4">
              <h3 className="m-0 text-sm font-bold">Quick actions</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setTab("income")}>
                  Income detail
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setTab("expense")}>
                  Expense detail
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/bank-recon" className="inline-flex items-center gap-1">
                    <Wallet className="size-3.5" /> Full bank recon
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => exportStatement("pl")}>
                  <Download className="mr-1 size-3.5" /> Export P&L
                </Button>
              </div>
              <p className="mt-3 text-[11px] text-[var(--hos-ink-3)]">
                TPN {tpn} · DRC {drcEinvoiceStatus} · Next {peekGaplessDocNo("INV")}
              </p>
            </GlassPanel>
          </div>
        ) : null}

        {tab === "income" ? (
          <div className="flex flex-col gap-3">
            <GlassPanel className="p-3.5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Bookings</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{incomeGlance.bookings}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Income</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{formatNu(incomeGlance.income)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Collected</div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-[var(--hos-emerald)]">
                    {formatNu(incomeGlance.collected)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Dues</div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-[var(--hos-ruby)]">
                    {formatNu(incomeGlance.dues)}
                  </div>
                </div>
              </div>
              <PaidUnpaidBar
                className="mt-3"
                paid={incomeGlance.collected}
                unpaid={incomeGlance.dues}
              />
              {incomeGlance.months.length > 0 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
                  {incomeGlance.months.map((m) => (
                    <div
                      key={m.key}
                      className="shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2"
                    >
                      <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                        {m.label}
                      </div>
                      <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums">
                        {formatNu(m.amount)}
                      </div>
                      <div className="text-[10px] text-[var(--hos-ink-3)]">
                        {m.count} · dues {formatNu(m.dues)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </GlassPanel>
            <GlassPanel className="p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-sm font-bold">Income register</h3>
                  <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                    Folio charges + fiscal docs · reconcile to bank inflows
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={exportIncome}>
                  <Download className="mr-1 size-3.5" /> CSV
                </Button>
              </div>
              {income.length === 0 ? (
                <EmptyState title="No income in period" description="Widen dates or clear filters." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                  <table className="w-full min-w-[820px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Ref</th>
                        <th className="px-3 py-2">Party</th>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hos-line)]">
                      {income.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-[11px]">{r.date}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-[var(--hos-primary)]">
                            {r.ref}
                          </td>
                          <td className="px-3 py-2 font-semibold">{r.party}</td>
                          <td className="px-3 py-2">
                            <Badge tone="muted">{r.source}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{formatNu(r.amount)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatNu(r.paid)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {formatNu(r.balance)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              tone={
                                r.status === "paid"
                                  ? "success"
                                  : r.status === "partial"
                                    ? "vip"
                                    : "danger"
                              }
                            >
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          </div>
        ) : null}

        {tab === "expense" ? (
          <div className="flex flex-col gap-3">
            <GlassPanel className="p-3.5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Expenses</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {formatNu(expenseGlance.expense)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Bills</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{expenseGlance.count}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Categories</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {expenseGlance.categories.length}
                  </div>
                </div>
              </div>
              {expenseGlance.months.length > 0 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
                  {expenseGlance.months.map((m) => (
                    <div
                      key={m.key}
                      className="shrink-0 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2"
                    >
                      <div className="text-[10px] font-bold uppercase text-[var(--hos-ink-3)]">
                        {m.label}
                      </div>
                      <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums">
                        {formatNu(m.amount)}
                      </div>
                      <div className="text-[10px] text-[var(--hos-ink-3)]">{m.count} bills</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {expenseGlance.categories.length > 0 ? (
                <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
                  {expenseGlance.categories.slice(0, 6).map((c) => {
                    const pct = expenseGlance.expense
                      ? Math.round((c.amount / expenseGlance.expense) * 100)
                      : 0;
                    return (
                      <li key={c.category} className="text-xs">
                        <div className="mb-0.5 flex justify-between gap-2">
                          <span className="capitalize text-[var(--hos-ink-2)]">
                            {c.category.replaceAll("_", " ")}
                          </span>
                          <span className="font-mono tabular-nums">{formatNu(c.amount)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                          <div
                            className="h-full bg-[var(--hos-brass)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </GlassPanel>
            <GlassPanel className="p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-sm font-bold">Expense register</h3>
                  <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                    Purchase bills · journal nos · payment mode
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/purchases">Purchases</Link>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportExpenses}>
                    <Download className="mr-1 size-3.5" /> CSV
                  </Button>
                </div>
              </div>
              {expenses.length === 0 ? (
                <EmptyState title="No expenses in period" description="Post purchase bills or widen dates." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Journal / bill</th>
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Mode</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hos-line)]">
                      {expenses.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-[11px]">{r.date}</td>
                          <td className="px-3 py-2 font-mono font-semibold">{r.ref}</td>
                          <td className="px-3 py-2 font-semibold">{r.party}</td>
                          <td className="px-3 py-2 capitalize">{r.category.replaceAll("_", " ")}</td>
                          <td className="px-3 py-2">
                            <Badge tone="muted">{r.paymentMode}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {formatNu(r.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          </div>
        ) : null}

        {tab === "recon" ? (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <GlassPanel className="p-4">
              <h3 className="m-0 text-sm font-bold">Bank recon summary</h3>
              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[var(--hos-ink-3)]">Lines</dt>
                  <dd className="font-mono font-semibold">{recon.totalLines}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--hos-ink-3)]">Matched</dt>
                  <dd className="font-mono text-[var(--hos-emerald)]">{recon.matched}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--hos-ink-3)]">Open</dt>
                  <dd className="font-mono text-[var(--hos-ruby)]">{recon.open}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--hos-ink-3)]">Open in</dt>
                  <dd className="font-mono">{formatNu(recon.openIn)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--hos-ink-3)]">Open out</dt>
                  <dd className="font-mono">{formatNu(recon.openOut)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--hos-ink-3)]">Match %</dt>
                  <dd className="font-mono font-bold">{recon.matchPct}%</dd>
                </div>
              </dl>
              <Button className="mt-4 w-full" size="sm" asChild>
                <Link to="/bank-recon">Open full recon workspace</Link>
              </Button>
            </GlassPanel>
            <GlassPanel className="p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="m-0 text-sm font-bold">Statement lines</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const res = exportCsv(
                      `bank-recon-${from}_${to}.csv`,
                      ["Date", "Bank", "Description", "Dir", "Amount", "Status"],
                      bankLines.map((l) => [
                        l.txnDate,
                        l.bankCode,
                        l.description,
                        l.direction,
                        String(l.amountBtn),
                        l.status,
                      ]),
                    );
                    toast.success(`Exported ${res.rows} bank lines`);
                  }}
                >
                  <Download className="mr-1 size-3.5" /> CSV
                </Button>
              </div>
              {bankLines.length === 0 ? (
                <EmptyState title="No bank lines" description="Paste a statement on Bank Recon." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Bank</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hos-line)]">
                      {bankLines.map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 font-mono text-[11px]">{l.txnDate}</td>
                          <td className="px-3 py-2 uppercase">{l.bankCode}</td>
                          <td className="px-3 py-2">{l.description}</td>
                          <td
                            className={`px-3 py-2 text-right font-mono font-semibold ${
                              l.direction === "in"
                                ? "text-[var(--hos-emerald)]"
                                : "text-[var(--hos-ruby)]"
                            }`}
                          >
                            {l.direction === "in" ? "+" : "−"}
                            {formatNu(l.amountBtn)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={l.status === "matched" ? "success" : "vip"}>
                              {l.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          </div>
        ) : null}

        {tab === "pl" ? (
          <GlassPanel className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-bold">Profit &amp; loss</h3>
              <Button size="sm" variant="secondary" onClick={() => exportStatement("pl")}>
                <Download className="mr-1 size-3.5" /> CSV
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {pl.income.map((a) => (
                    <tr key={a.code}>
                      <td className="px-3 py-2 font-mono">{a.code}</td>
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--hos-emerald)]">
                        {formatNu(a.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[rgba(16,185,129,0.08)] font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total income
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatNu(pl.totalIncome)}</td>
                  </tr>
                  {pl.expense.map((a) => (
                    <tr key={a.code}>
                      <td className="px-3 py-2 font-mono">{a.code}</td>
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--hos-ruby)]">
                        {formatNu(a.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[rgba(239,68,68,0.08)] font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total expense
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatNu(pl.totalExpense)}</td>
                  </tr>
                  <tr className="bg-[var(--hos-ink)] text-white font-bold">
                    <td className="px-3 py-2.5" colSpan={2}>
                      Net profit / (loss)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {formatNu(pl.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassPanel>
        ) : null}

        {tab === "bs" ? (
          <GlassPanel className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-sm font-bold">Balance sheet</h3>
                <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                  {bs.balanced ? "Assets = liabilities + equity" : "Out of balance — review AR / bank open"}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => exportStatement("bs")}>
                <Download className="mr-1 size-3.5" /> CSV
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                <h4 className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                  Assets
                </h4>
                {bs.assets.map((a) => (
                  <div key={a.code} className="flex justify-between gap-2 border-b border-[var(--hos-line)] py-1.5 text-xs">
                    <span>
                      <span className="font-mono text-[var(--hos-ink-3)]">{a.code}</span> {a.name}
                    </span>
                    <span className="font-mono font-semibold">{formatNu(a.balance)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between text-xs font-bold">
                  <span>Total assets</span>
                  <span className="font-mono">{formatNu(bs.totalAssets)}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                <h4 className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                  Liabilities &amp; equity
                </h4>
                {[...bs.liabilities, ...bs.equity].map((a) => (
                  <div key={a.code} className="flex justify-between gap-2 border-b border-[var(--hos-line)] py-1.5 text-xs">
                    <span>
                      <span className="font-mono text-[var(--hos-ink-3)]">{a.code}</span> {a.name}
                    </span>
                    <span className="font-mono font-semibold">{formatNu(a.balance)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between text-xs font-bold">
                  <span>Total L+E</span>
                  <span className="font-mono">{formatNu(bs.totalLiabEq)}</span>
                </div>
              </div>
            </div>
          </GlassPanel>
        ) : null}

        {tab === "tb" ? (
          <GlassPanel className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-bold">Trial balance</h3>
              <Button size="sm" variant="secondary" onClick={() => exportStatement("tb")}>
                <Download className="mr-1 size-3.5" /> CSV
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {tb.map((l) => (
                    <tr key={l.code}>
                      <td className="px-3 py-2 font-mono">{l.code}</td>
                      <td className="px-3 py-2">{l.account}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {l.debit ? formatNu(l.debit) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {l.credit ? formatNu(l.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="px-3 py-2.5" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {formatNu(tb.reduce((s, l) => s + l.debit, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {formatNu(tb.reduce((s, l) => s + l.credit, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassPanel>
        ) : null}

        {tab === "fiscal" ? (
          <GlassPanel className="p-3.5">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const d = issueFiscal({
                    kind: "PSBN",
                    party: "Walk-in Guest",
                    partyType: "guest",
                    amount: 12100,
                  });
                  toast.success(`${d.docNo} issued`);
                }}
              >
                Issue PSBN
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const d = issueFiscal({
                    kind: "INV",
                    party: "Yangphel Adventure Travel",
                    partyType: "agent",
                    amount: 50000,
                  });
                  toast.success(`${d.docNo} issued`);
                }}
              >
                Issue INV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (selectedIds.size === 0) {
                    toast.error("Select fiscal rows first");
                    return;
                  }
                  toast.success(`Bulk print · ${selectedIds.size} docs`);
                  window.setTimeout(() => window.print(), 100);
                }}
              >
                <Printer className="mr-1 size-3.5" /> Print selected
              </Button>
            </div>
            {filteredDocs.length === 0 ? (
              <EmptyState title="No fiscal documents" description="Issue PSBN/INV or change filters." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                      <th className="w-8 px-2 py-2" />
                      <th className="px-3 py-2">Doc</th>
                      <th className="px-3 py-2">Party</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {filteredDocs.map((d) => (
                      <tr key={d.id}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() =>
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(d.id)) next.delete(d.id);
                                else next.add(d.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-[var(--hos-primary)]">
                          {d.docNo}
                        </td>
                        <td className="px-3 py-2 font-semibold">{d.party}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNu(d.amount)}</td>
                        <td className="px-3 py-2">
                          <Badge tone={d.status === "paid" ? "success" : "default"}>
                            {d.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {d.status === "issued" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const res = markFiscalPaid(d.id);
                                if (!res.ok) toast.error(res.error);
                                else toast.success(`${d.docNo} paid`);
                              }}
                            >
                              Mark paid
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassPanel>
        ) : null}

        {tab === "till" ? (
          <GlassPanel className="p-4">
            <h3 className="m-0 text-sm font-bold">Till &amp; deposits</h3>
            <p className="mt-1 text-[11px] text-[var(--hos-ink-3)]">
              Open shift {openShift ? openShift.cashier : "—"} · float{" "}
              {formatNu(openShift?.openingFloat ?? tillBalance)}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">
                Cash count
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 0)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono"
                />
              </label>
              <div className="flex items-end">
                <Button
                  size="sm"
                  onClick={() =>
                    start(() => {
                      const shift = closeTillShift(count);
                      toast.success("Shift closed", {
                        description: `Variance ${formatNu(shift.variance ?? 0)}`,
                      });
                    })
                  }
                >
                  Close shift
                </Button>
              </div>
              <label className="grid gap-1 text-xs font-medium">
                Deposit amount
                <input
                  type="number"
                  value={depAmt}
                  onChange={(e) => setDepAmt(Number(e.target.value) || 0)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Deposit ref
                <input
                  value={depRef}
                  onChange={(e) => setDepRef(e.target.value)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2"
                />
              </label>
            </div>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onClick={() => {
                const sid = openShift?.id ?? shifts[0]?.id;
                if (!sid) {
                  toast.error("No shift to match");
                  return;
                }
                matchDeposit(depAmt, depRef, sid);
                toast.success("Deposit matched to shift");
              }}
            >
              Match bank deposit
            </Button>
            <div className="mt-4 text-[11px] text-[var(--hos-ink-3)]">
              Deposits logged: {deposits.length}
            </div>
          </GlassPanel>
        ) : null}
      </div>
    </ModuleFrame>
  );
}
