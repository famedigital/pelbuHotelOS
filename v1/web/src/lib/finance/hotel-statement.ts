import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  accountClosing,
  expenditureMatrix,
  isCompTender,
  isTurnoverTender,
  roundBtn,
  suggestBankClass,
  type BankTreatment,
} from "@/lib/finance/statement-model";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type StatementAccount = {
  id: string;
  label: string;
  bankCode: string;
  accountNo: string | null;
  role: "operating" | "owner" | "related";
  opening: number;
};

export type LedgerRow = {
  id: string;
  date: string;
  accountId: string | null;
  accountLabel: string;
  party: string;
  category: string;
  detail: string;
  income: number;
  expense: number;
  treatment: BankTreatment;
  saved: boolean;
};

export type HotelStatement = {
  from: string;
  to: string;
  accounts: StatementAccount[];
  ledger: LedgerRow[];
  transfersIn: { party: string; date: string; amount: number; detail: string }[];
  loans: { party: string; date: string; amount: number; side: "in" | "out"; detail: string }[];
  salarySheets: { label: string; net: number }[];
  salarySheetTotal: number;
  salaryBankTotal: number;
  matrix: ReturnType<typeof expenditureMatrix>;
  matrixAccounts: { key: string; label: string }[];
  otherSpend: number;
  hotelSpend: number;
  perAccount: {
    id: string;
    label: string;
    opening: number;
    received: number;
    paid: number;
    closing: number;
    check: number;
  }[];
  cityLedger: { agent: string; balance: number }[];
  cityLedgerTotal: number;
  earlyCollections: { date: string; party: string; amount: number; detail: string }[];
  earlyTotal: number;
  walkInPos: {
    sourceId: string;
    date: string;
    party: string;
    method: string;
    amount: number;
    ref: string;
    onFolio: boolean;
  }[];
  walkInTotal: number;
  comps: {
    sourceId: string;
    date: string;
    party: string;
    method: string;
    amount: number;
  }[];
  statements: {
    id: string;
    label: string;
    bankCode: string;
    financeAccountId: string | null;
  }[];
};

function num(v: unknown): number {
  return roundBtn(Number(v ?? 0));
}

function day(v: unknown): string {
  return String(v ?? "").slice(0, 10);
}

export async function loadHotelStatement(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<HotelStatement> {
  const [accountsRes, txnRes, payrollRes, paymentsRes, ordersRes, ledgerRes, statementsRes] =
    await Promise.all([
      admin
        .from("finance_bank_accounts")
        .select("id, label, bank_code, account_no, account_role, opening_balance_btn, sort_order")
        .eq("property_id", propertyId)
        .eq("active", true)
        .order("sort_order"),
      admin
        .from("bank_transactions")
        .select(
          "id, txn_date, description, debit_btn, credit_btn, reference, statement_id, bank_statements(finance_account_id, bank_code, account_label), statement_line_classes(category, treatment, party, reason)",
        )
        .eq("property_id", propertyId)
        .gte("txn_date", from)
        .lte("txn_date", to)
        .order("txn_date", { ascending: true })
        .limit(5000),
      admin
        .from("payroll_runs")
        .select("id, net_total_btn, status, payroll_periods(label, period_start, period_end)")
        .eq("property_id", propertyId)
        .in("status", ["approved", "finalized"]),
      admin
        .from("payments")
        .select("id, amount_btn, method, reference, created_at, notes, folio_id")
        .eq("property_id", propertyId)
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .eq("method", "cash")
        .limit(2000),
      admin
        .from("orders")
        .select(
          "id, customer_name, total_btn, payment_method, payment_recorded_at, payment_journal_no, folio_id",
        )
        .eq("property_id", propertyId)
        .gte("payment_recorded_at", `${from}T00:00:00`)
        .lte("payment_recorded_at", `${to}T23:59:59`)
        .limit(2000),
      admin
        .from("agent_credit_ledger")
        .select("agent_id, balance_after_btn, created_at, agents(company_name)")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(2000),
      admin
        .from("bank_statements")
        .select("id, bank_code, account_label, source_filename, finance_account_id")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const accounts: StatementAccount[] = (accountsRes.data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    bankCode: row.bank_code as string,
    accountNo: (row.account_no as string | null) ?? null,
    role: row.account_role as StatementAccount["role"],
    opening: num(row.opening_balance_btn),
  }));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const ledger: LedgerRow[] = [];
  for (const raw of txnRes.data ?? []) {
    const stmt = raw.bank_statements as
      | { finance_account_id: string | null; bank_code: string; account_label: string | null }
      | { finance_account_id: string | null; bank_code: string; account_label: string | null }[]
      | null;
    const statement = Array.isArray(stmt) ? stmt[0] : stmt;
    const clsRaw = raw.statement_line_classes as
      | { category: string; treatment: string; party: string | null; reason: string | null }
      | { category: string; treatment: string; party: string | null; reason: string | null }[]
      | null;
    const cls = Array.isArray(clsRaw) ? clsRaw[0] : clsRaw;
    const debit = num(raw.debit_btn);
    const credit = num(raw.credit_btn);
    const side = credit > 0 ? "credit" : "debit";
    const suggestion = suggestBankClass(String(raw.description ?? ""), side);
    const treatment = (cls?.treatment ?? suggestion.treatment) as BankTreatment;
    const category = cls?.category ?? suggestion.category;
    const accountId = statement?.finance_account_id ?? null;
    const account = accountId ? accountById.get(accountId) : undefined;
    ledger.push({
      id: raw.id as string,
      date: day(raw.txn_date),
      accountId,
      accountLabel: account?.label ?? statement?.account_label ?? statement?.bank_code ?? "Bank",
      party: cls?.party ?? "",
      category,
      detail: String(raw.description ?? ""),
      income: credit,
      expense: debit,
      treatment,
      saved: Boolean(cls),
    });
  }

  const classified = ledger.filter((r) => r.saved);
  const transfersIn = classified
    .filter((r) => r.treatment === "owner_transfer" || r.treatment === "not_income")
    .filter((r) => r.income > 0)
    .map((r) => ({
      party: r.party || r.accountLabel,
      date: r.date,
      amount: r.income,
      detail: r.detail,
    }));

  const loans = classified
    .filter((r) => r.treatment === "loan_in" || r.treatment === "loan_out")
    .map((r) => ({
      party: r.party || r.detail.slice(0, 80),
      date: r.date,
      amount: r.income || r.expense,
      side: (r.treatment === "loan_in" ? "in" : "out") as "in" | "out",
      detail: r.detail,
    }));

  const salarySheets: { label: string; net: number }[] = [];
  for (const run of payrollRes.data ?? []) {
    const period = run.payroll_periods as
      | { label: string; period_start: string; period_end: string }
      | { label: string; period_start: string; period_end: string }[]
      | null;
    const p = Array.isArray(period) ? period[0] : period;
    if (!p) continue;
    const start = day(p.period_start);
    const end = day(p.period_end);
    if (end < from || start > to) continue;
    salarySheets.push({ label: p.label || `${start} – ${end}`, net: num(run.net_total_btn) });
  }
  const salarySheetTotal = roundBtn(salarySheets.reduce((s, r) => s + r.net, 0));
  const salaryBankTotal = roundBtn(
    classified.filter((r) => r.treatment === "salary_bank").reduce((s, r) => s + r.expense, 0),
  );

  const matrixAccounts = accounts.map((a) => ({ key: a.id, label: a.label }));
  const keys = matrixAccounts.map((a) => a.key);
  const matrix = expenditureMatrix(
    classified.map((r) => ({
      category: r.category,
      accountKey: r.accountId ?? "",
      amount: r.expense,
      treatment: r.treatment,
    })),
    keys.length ? keys : ["unassigned"],
  );
  const otherSpend = roundBtn(matrix.reduce((s, r) => s + r.total, 0));
  const hotelSpend = roundBtn(otherSpend + salarySheetTotal);

  const perAccount = accounts.map((a) => {
    const rows = ledger.filter((r) => r.accountId === a.id);
    const received = roundBtn(rows.reduce((s, r) => s + r.income, 0));
    const paid = roundBtn(rows.reduce((s, r) => s + r.expense, 0));
    const closing = accountClosing(a.opening, received, paid);
    return {
      id: a.id,
      label: a.label,
      opening: a.opening,
      received,
      paid,
      closing,
      check: closing,
    };
  });

  const seenAgent = new Set<string>();
  const cityLedger: { agent: string; balance: number }[] = [];
  for (const row of ledgerRes.data ?? []) {
    const id = row.agent_id as string;
    if (seenAgent.has(id)) continue;
    seenAgent.add(id);
    const agent = row.agents as { company_name: string } | { company_name: string }[] | null;
    const name = Array.isArray(agent) ? agent[0]?.company_name : agent?.company_name;
    const balance = num(row.balance_after_btn);
    if (balance === 0) continue;
    cityLedger.push({ agent: name || "Agent", balance });
  }
  const cityLedgerTotal = roundBtn(cityLedger.reduce((s, r) => s + r.balance, 0));

  const earlyCollections = classified
    .filter((r) => r.treatment === "early_collection")
    .map((r) => ({
      date: r.date,
      party: r.party || r.detail.slice(0, 80),
      amount: r.income,
      detail: r.detail,
    }));
  const earlyTotal = roundBtn(earlyCollections.reduce((s, r) => s + r.amount, 0));

  const walkInPos: HotelStatement["walkInPos"] = [];
  for (const pay of paymentsRes.data ?? []) {
    walkInPos.push({
      sourceId: pay.id as string,
      date: day(pay.created_at),
      party: "Cash desk",
      method: "cash",
      amount: num(pay.amount_btn),
      ref: String(pay.reference ?? pay.notes ?? pay.id),
      onFolio: Boolean(pay.folio_id),
    });
  }
  for (const order of ordersRes.data ?? []) {
    const method = String(order.payment_method ?? "");
    if (!isTurnoverTender(method) || order.folio_id) continue;
    walkInPos.push({
      sourceId: order.id as string,
      date: day(order.payment_recorded_at),
      party: String(order.customer_name ?? "Walk-in"),
      method,
      amount: num(order.total_btn),
      ref: String(order.payment_journal_no ?? order.id),
      onFolio: false,
    });
  }
  const walkInTotal = roundBtn(walkInPos.reduce((s, r) => s + r.amount, 0));

  const comps = (ordersRes.data ?? [])
    .filter((order) => isCompTender(String(order.payment_method ?? "")))
    .map((order) => ({
      sourceId: order.id as string,
      date: day(order.payment_recorded_at),
      party: String(order.customer_name ?? ""),
      method: String(order.payment_method),
      amount: num(order.total_btn),
    }));

  return {
    from,
    to,
    accounts,
    ledger,
    transfersIn,
    loans,
    salarySheets,
    salarySheetTotal,
    salaryBankTotal,
    matrix,
    matrixAccounts: matrixAccounts.length
      ? matrixAccounts
      : [{ key: "unassigned", label: "Unassigned" }],
    otherSpend,
    hotelSpend,
    perAccount,
    cityLedger,
    cityLedgerTotal,
    earlyCollections,
    earlyTotal,
    walkInPos,
    walkInTotal,
    comps,
    statements: (statementsRes.data ?? []).map((s) => ({
      id: s.id as string,
      label:
        (s.account_label as string | null) ||
        (s.source_filename as string | null) ||
        (s.bank_code as string),
      bankCode: s.bank_code as string,
      financeAccountId: (s.finance_account_id as string | null) ?? null,
    })),
  };
}
