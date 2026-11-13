/**
 * Finance Hub reports — income / expense / bank recon / P&L / BS / TB.
 * Derived from FO folios, fiscal docs, purchases, bank lines, and till.
 */
import { formatNu, folioTotals, type Stay } from "./front-office-store";
import type { Agent } from "./commercial-store";
import type { FiscalDoc } from "./extras-store";
import type { PurchaseBill } from "./fiscal-store";
import type { BankLine } from "./enterprise-ops-store";

export type MoneyFilter = {
  from: string;
  to: string;
  query: string;
  status: "all" | "open" | "matched" | "paid" | "unpaid";
  dept: "all" | "rooms" | "fnb" | "other" | "ops";
};

export type IncomeRow = {
  id: string;
  date: string;
  source: "room" | "fnb" | "fiscal" | "deposit";
  ref: string;
  party: string;
  dept: "rooms" | "fnb" | "other";
  amount: number;
  paid: number;
  balance: number;
  status: "paid" | "unpaid" | "partial";
};

export type ExpenseRow = {
  id: string;
  date: string;
  source: "purchase" | "petty" | "payroll" | "utility";
  ref: string;
  party: string;
  category: string;
  amount: number;
  paymentMode: string;
  status: "posted" | "paid";
};

export type CoaAccount = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  balance: number;
};

export type StatementLine = {
  account: string;
  code: string;
  debit: number;
  credit: number;
};

function inRange(date: string, from: string, to: string): boolean {
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

function qMatch(hay: string, q: string): boolean {
  if (!q) return true;
  return hay.toLowerCase().includes(q.toLowerCase());
}

export function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, "0")}` };
}

export function buildIncomeRows(input: {
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  filter: MoneyFilter;
}): IncomeRow[] {
  const rows: IncomeRow[] = [];
  for (const s of input.stays) {
    if (["cancelled", "no_show"].includes(s.status)) continue;
    const t = folioTotals(s);
    if (t.charged <= 0) continue;
    const date = s.checkOut || s.checkIn;
    if (!inRange(date, input.filter.from, input.filter.to)) continue;
    const paid = t.paid;
    const balance = Math.max(0, t.balance);
    const status: IncomeRow["status"] =
      balance <= 0.5 ? "paid" : paid > 0 ? "partial" : "unpaid";
    rows.push({
      id: `stay-${s.id}`,
      date,
      source: "room",
      ref: s.confirmationNo,
      party: s.agencyName || s.guestName,
      dept: "rooms",
      amount: t.charged,
      paid,
      balance,
      status,
    });
  }
  for (const d of input.fiscalDocs) {
    if (!inRange(d.at, input.filter.from, input.filter.to)) continue;
    if (d.status === "void") continue;
    rows.push({
      id: d.id,
      date: d.at.slice(0, 10),
      source: "fiscal",
      ref: d.docNo,
      party: d.party,
      dept: d.kind === "INV" ? "rooms" : "other",
      amount: d.amount,
      paid: d.status === "paid" ? d.amount : 0,
      balance: d.status === "paid" ? 0 : d.amount,
      status: d.status === "paid" ? "paid" : "unpaid",
    });
  }
  return rows
    .filter((r) => {
      if (input.filter.dept !== "all" && r.dept !== input.filter.dept) return false;
      if (input.filter.status === "paid" && r.status !== "paid") return false;
      if (
        input.filter.status === "unpaid" &&
        !(r.status === "unpaid" || r.status === "partial")
      ) {
        return false;
      }
      return qMatch(`${r.ref} ${r.party} ${r.source}`, input.filter.query);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
}

export function buildExpenseRows(input: {
  purchases: PurchaseBill[];
  filter: MoneyFilter;
}): ExpenseRow[] {
  return input.purchases
    .filter((p) => inRange(p.billDate, input.filter.from, input.filter.to))
    .filter((p) =>
      qMatch(
        `${p.billNo} ${p.supplierName} ${p.category} ${p.journalNo}`,
        input.filter.query,
      ),
    )
    .map((p) => ({
      id: p.id,
      date: p.billDate,
      source: "purchase" as const,
      ref: p.journalNo || p.billNo,
      party: p.supplierName,
      category: p.category,
      amount: p.grandTotalBtn,
      paymentMode: p.paymentMode,
      status: "posted" as const,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function buildBankReconSummary(lines: BankLine[]) {
  const openIn = lines
    .filter((l) => l.status === "open" && l.direction === "in")
    .reduce((s, l) => s + l.amountBtn, 0);
  const openOut = lines
    .filter((l) => l.status === "open" && l.direction === "out")
    .reduce((s, l) => s + l.amountBtn, 0);
  const matched = lines.filter((l) => l.status === "matched").length;
  const open = lines.filter((l) => l.status === "open").length;
  return {
    totalLines: lines.length,
    matched,
    open,
    openIn,
    openOut,
    matchPct: lines.length ? Math.round((matched / lines.length) * 100) : 100,
  };
}

export function buildChartOfAccounts(input: {
  income: IncomeRow[];
  expenses: ExpenseRow[];
  guestAr: number;
  agentAr: number;
  tillBalance: number;
  bankOpenIn: number;
}): CoaAccount[] {
  const roomRev = input.income
    .filter((r) => r.dept === "rooms")
    .reduce((s, r) => s + r.amount, 0);
  const fnbRev = input.income
    .filter((r) => r.dept === "fnb")
    .reduce((s, r) => s + r.amount, 0);
  const otherRev = input.income
    .filter((r) => r.dept === "other")
    .reduce((s, r) => s + r.amount, 0);
  const cogs = input.expenses
    .filter((e) => ["veg_dairy", "meat", "beverage", "dry"].includes(e.category))
    .reduce((s, e) => s + e.amount, 0);
  const opex = input.expenses
    .filter((e) => !["veg_dairy", "meat", "beverage", "dry"].includes(e.category))
    .reduce((s, e) => s + e.amount, 0);
  const cash = Math.max(0, input.tillBalance);
  const ar = Math.max(0, input.guestAr + input.agentAr);
  const bank = Math.max(0, input.bankOpenIn);
  const ap = Math.round(opex * 0.35 * 100) / 100;
  const gst = Math.round((roomRev + fnbRev) * 0.1);
  const assets = cash + ar + bank;
  const liabilities = ap + gst;
  const retained = Math.max(0, assets - liabilities);

  return [
    { code: "1000", name: "Cash & till", type: "asset", balance: cash },
    { code: "1100", name: "Accounts receivable", type: "asset", balance: ar },
    { code: "1200", name: "Bank (unmatched inflows)", type: "asset", balance: bank },
    { code: "2000", name: "Accounts payable", type: "liability", balance: ap },
    { code: "2100", name: "GST payable (est.)", type: "liability", balance: gst },
    { code: "3000", name: "Owner equity / retained", type: "equity", balance: retained },
    { code: "4000", name: "Room revenue", type: "income", balance: roomRev },
    { code: "4100", name: "F&B revenue", type: "income", balance: fnbRev },
    { code: "4900", name: "Other income", type: "income", balance: otherRev },
    { code: "5000", name: "Cost of goods", type: "expense", balance: cogs },
    { code: "5100", name: "Operating expenses", type: "expense", balance: opex },
  ];
}

export function buildProfitAndLoss(accounts: CoaAccount[]) {
  const income = accounts.filter((a) => a.type === "income");
  const expense = accounts.filter((a) => a.type === "expense");
  const totalIncome = income.reduce((s, a) => s + a.balance, 0);
  const totalExpense = expense.reduce((s, a) => s + a.balance, 0);
  return {
    income,
    expense,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    lines: [
      ...income.map((a) => ({
        label: a.name,
        code: a.code,
        amount: a.balance,
        side: "income" as const,
      })),
      ...expense.map((a) => ({
        label: a.name,
        code: a.code,
        amount: a.balance,
        side: "expense" as const,
      })),
    ],
  };
}

export function buildBalanceSheet(accounts: CoaAccount[]) {
  const assets = accounts.filter((a) => a.type === "asset");
  const liabilities = accounts.filter((a) => a.type === "liability");
  const equity = accounts.filter((a) => a.type === "equity");
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiab = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEq = equity.reduce((s, a) => s + a.balance, 0);
  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabEq: totalLiab + totalEq,
    balanced: Math.abs(totalAssets - (totalLiab + totalEq)) < 1,
  };
}

export function buildTrialBalance(accounts: CoaAccount[]): StatementLine[] {
  return accounts.map((a) => {
    if (a.type === "asset" || a.type === "expense") {
      return { account: a.name, code: a.code, debit: a.balance, credit: 0 };
    }
    return { account: a.name, code: a.code, debit: 0, credit: a.balance };
  });
}

export function exportCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): { filename: string; rows: number } {
  const esc = (c: string) =>
    /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join(
    "\n",
  );
  /* UTF-8 BOM so Excel opens Nu. amounts / Bhutanese names cleanly */
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename, rows: rows.length };
}

export function moneyLabel(n: number): string {
  return formatNu(n);
}

export function agentArTotal(agents: Agent[]): number {
  return agents.reduce((s, a) => s + a.usedCredit, 0);
}

export type MonthBucket = {
  key: string;
  label: string;
  amount: number;
  paid: number;
  dues: number;
  count: number;
};

export type IncomeGlance = {
  bookings: number;
  income: number;
  collected: number;
  dues: number;
  months: MonthBucket[];
};

export type ExpenseGlance = {
  expense: number;
  count: number;
  months: MonthBucket[];
  categories: { category: string; amount: number; count: number }[];
};

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

/** Period glance for Income tab — totals + monthwise chips. */
export function buildIncomeGlance(rows: IncomeRow[]): IncomeGlance {
  const byMonth = new Map<string, MonthBucket>();
  let income = 0;
  let collected = 0;
  let dues = 0;
  for (const r of rows) {
    income += r.amount;
    collected += r.paid;
    dues += r.balance;
    const key = monthKey(r.date);
    const cur = byMonth.get(key) ?? {
      key,
      label: monthLabel(key),
      amount: 0,
      paid: 0,
      dues: 0,
      count: 0,
    };
    cur.amount += r.amount;
    cur.paid += r.paid;
    cur.dues += r.balance;
    cur.count += 1;
    byMonth.set(key, cur);
  }
  return {
    bookings: rows.length,
    income,
    collected,
    dues,
    months: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

/** Period glance for Expense tab — totals + monthwise + category. */
export function buildExpenseGlance(rows: ExpenseRow[]): ExpenseGlance {
  const byMonth = new Map<string, MonthBucket>();
  const byCat = new Map<string, { category: string; amount: number; count: number }>();
  let expense = 0;
  for (const r of rows) {
    expense += r.amount;
    const key = monthKey(r.date);
    const cur = byMonth.get(key) ?? {
      key,
      label: monthLabel(key),
      amount: 0,
      paid: 0,
      dues: 0,
      count: 0,
    };
    cur.amount += r.amount;
    cur.count += 1;
    byMonth.set(key, cur);
    const cat = byCat.get(r.category) ?? {
      category: r.category,
      amount: 0,
      count: 0,
    };
    cat.amount += r.amount;
    cat.count += 1;
    byCat.set(r.category, cat);
  }
  return {
    expense,
    count: rows.length,
    months: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    categories: [...byCat.values()].sort((a, b) => b.amount - a.amount),
  };
}

/** Green (paid) / red (unpaid) share of total — zero-safe. */
export function paidUnpaidPct(paid: number, unpaid: number): {
  paidPct: number;
  unpaidPct: number;
} {
  const p = Math.max(0, paid);
  const u = Math.max(0, unpaid);
  const t = p + u;
  if (t <= 0) return { paidPct: 0, unpaidPct: 0 };
  const paidPct = Math.round((p / t) * 100);
  return { paidPct, unpaidPct: 100 - paidPct };
}
