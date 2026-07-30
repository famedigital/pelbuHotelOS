import "server-only";
import type {
  StatementRow,
  TrialBalanceRow,
  AccountType,
} from "@/lib/accounting/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { roundBtn } from "@/lib/pricing";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type LineJoin = {
  debit_btn: number;
  credit_btn: number;
  account_id: string;
  department_id: string | null;
  accounting_journals: {
    journal_date: string;
    status: string;
    property_id: string;
  } | null;
  accounting_accounts: {
    id: string;
    code: string;
    name: string;
    account_type: AccountType;
  } | null;
};

async function loadPostedLines(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<LineJoin[]> {
  const { data } = await admin
    .from("accounting_journal_lines")
    .select(
      "debit_btn, credit_btn, account_id, department_id, accounting_journals!inner(journal_date, status, property_id), accounting_accounts!inner(id, code, name, account_type)",
    )
    .eq("property_id", propertyId)
    .eq("accounting_journals.status", "posted")
    .gte("accounting_journals.journal_date", from)
    .lte("accounting_journals.journal_date", to);

  return (data ?? []) as unknown as LineJoin[];
}

async function loadLinesThrough(
  admin: Admin,
  propertyId: string,
  through: string,
): Promise<LineJoin[]> {
  const { data } = await admin
    .from("accounting_journal_lines")
    .select(
      "debit_btn, credit_btn, account_id, department_id, accounting_journals!inner(journal_date, status, property_id), accounting_accounts!inner(id, code, name, account_type)",
    )
    .eq("property_id", propertyId)
    .eq("accounting_journals.status", "posted")
    .lte("accounting_journals.journal_date", through);

  return (data ?? []) as unknown as LineJoin[];
}

function netForType(
  accountType: AccountType,
  debit: number,
  credit: number,
): number {
  if (
    accountType === "asset" ||
    accountType === "expense" ||
    accountType === "cogs"
  ) {
    return roundBtn(debit - credit);
  }
  return roundBtn(credit - debit);
}

export async function buildTrialBalance(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<TrialBalanceRow[]> {
  const openingCutoff = new Date(from);
  openingCutoff.setDate(openingCutoff.getDate() - 1);
  const openingTo = openingCutoff.toISOString().slice(0, 10);

  const [openingLines, periodLines] = await Promise.all([
    from > "1900-01-01" ? loadLinesThrough(admin, propertyId, openingTo) : Promise.resolve([]),
    loadPostedLines(admin, propertyId, from, to),
  ]);

  const map = new Map<
    string,
    TrialBalanceRow & { _od: number; _oc: number; _pd: number; _pc: number }
  >();

  function ensure(line: LineJoin) {
    const acc = line.accounting_accounts;
    if (!acc) return null;
    let row = map.get(acc.id);
    if (!row) {
      row = {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
        _od: 0,
        _oc: 0,
        _pd: 0,
        _pc: 0,
      };
      map.set(acc.id, row);
    }
    return row;
  }

  for (const line of openingLines) {
    const row = ensure(line);
    if (!row) continue;
    row._od += Number(line.debit_btn);
    row._oc += Number(line.credit_btn);
  }
  for (const line of periodLines) {
    const row = ensure(line);
    if (!row) continue;
    row._pd += Number(line.debit_btn);
    row._pc += Number(line.credit_btn);
  }

  return [...map.values()]
    .map((row) => {
      const openNet = netForType(row.accountType, row._od, row._oc);
      const closeNet = netForType(
        row.accountType,
        row._od + row._pd,
        row._oc + row._pc,
      );
      const isDebitNormal =
        row.accountType === "asset" ||
        row.accountType === "expense" ||
        row.accountType === "cogs";
      return {
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        accountType: row.accountType,
        openingDebit: isDebitNormal ? Math.max(openNet, 0) : 0,
        openingCredit: isDebitNormal ? 0 : Math.max(openNet, 0),
        periodDebit: roundBtn(row._pd),
        periodCredit: roundBtn(row._pc),
        closingDebit: isDebitNormal ? Math.max(closeNet, 0) : 0,
        closingCredit: isDebitNormal ? 0 : Math.max(closeNet, 0),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function buildProfitAndLoss(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<{ income: StatementRow[]; expenses: StatementRow[]; netIncome: number }> {
  const lines = await loadPostedLines(admin, propertyId, from, to);
  const map = new Map<string, StatementRow & { debit: number; credit: number }>();

  for (const line of lines) {
    const acc = line.accounting_accounts;
    if (!acc) continue;
    if (!["revenue", "expense", "cogs"].includes(acc.account_type)) continue;
    let row = map.get(acc.id);
    if (!row) {
      row = {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        amount: 0,
        debit: 0,
        credit: 0,
      };
      map.set(acc.id, row);
    }
    row.debit += Number(line.debit_btn);
    row.credit += Number(line.credit_btn);
  }

  const rows = [...map.values()].map((row) => ({
    accountId: row.accountId,
    code: row.code,
    name: row.name,
    accountType: row.accountType,
    amount: netForType(row.accountType, row.debit, row.credit),
  }));

  const income = rows
    .filter((r) => r.accountType === "revenue")
    .sort((a, b) => a.code.localeCompare(b.code));
  const expenses = rows
    .filter((r) => r.accountType === "expense" || r.accountType === "cogs")
    .sort((a, b) => a.code.localeCompare(b.code));

  const netIncome = roundBtn(
    income.reduce((s, r) => s + r.amount, 0) -
      expenses.reduce((s, r) => s + r.amount, 0),
  );

  return { income, expenses, netIncome };
}

export async function buildBalanceSheet(
  admin: Admin,
  propertyId: string,
  asOf: string,
): Promise<{
  assets: StatementRow[];
  liabilities: StatementRow[];
  equity: StatementRow[];
  totalAssets: number;
  totalLiabilitiesEquity: number;
}> {
  const lines = await loadLinesThrough(admin, propertyId, asOf);
  const pnl = await buildProfitAndLoss(admin, propertyId, "1900-01-01", asOf);

  const map = new Map<string, StatementRow & { debit: number; credit: number }>();
  for (const line of lines) {
    const acc = line.accounting_accounts;
    if (!acc) continue;
    if (!["asset", "liability", "equity"].includes(acc.account_type)) continue;
    let row = map.get(acc.id);
    if (!row) {
      row = {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        amount: 0,
        debit: 0,
        credit: 0,
      };
      map.set(acc.id, row);
    }
    row.debit += Number(line.debit_btn);
    row.credit += Number(line.credit_btn);
  }

  const rows = [...map.values()].map((row) => ({
    accountId: row.accountId,
    code: row.code,
    name: row.name,
    accountType: row.accountType,
    amount: netForType(row.accountType, row.debit, row.credit),
  }));

  const assets = rows
    .filter((r) => r.accountType === "asset")
    .sort((a, b) => a.code.localeCompare(b.code));
  const liabilities = rows
    .filter((r) => r.accountType === "liability")
    .sort((a, b) => a.code.localeCompare(b.code));
  const equity = rows
    .filter((r) => r.accountType === "equity")
    .sort((a, b) => a.code.localeCompare(b.code));

  if (pnl.netIncome !== 0) {
    equity.push({
      accountId: "current-earnings",
      code: "3999",
      name: "Current Year Earnings",
      accountType: "equity",
      amount: pnl.netIncome,
    });
  }

  const totalAssets = roundBtn(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiabilitiesEquity = roundBtn(
    liabilities.reduce((s, r) => s + r.amount, 0) +
      equity.reduce((s, r) => s + r.amount, 0),
  );

  return { assets, liabilities, equity, totalAssets, totalLiabilitiesEquity };
}

export async function buildGstReport(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<{
  output: number;
  input: number;
  netPayable: number;
  outputRows: StatementRow[];
  inputRows: StatementRow[];
}> {
  const lines = await loadPostedLines(admin, propertyId, from, to);
  let output = 0;
  let input = 0;
  const outputRows: StatementRow[] = [];
  const inputRows: StatementRow[] = [];

  for (const line of lines) {
    const acc = line.accounting_accounts;
    if (!acc) continue;
    if (acc.code === "2200" || acc.name.toLowerCase().includes("gst output")) {
      const amt = roundBtn(Number(line.credit_btn) - Number(line.debit_btn));
      output = roundBtn(output + amt);
      outputRows.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        amount: amt,
      });
    }
    if (acc.code === "1300" || acc.name.toLowerCase().includes("gst input")) {
      const amt = roundBtn(Number(line.debit_btn) - Number(line.credit_btn));
      input = roundBtn(input + amt);
      inputRows.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        amount: amt,
      });
    }
  }

  return {
    output,
    input,
    netPayable: roundBtn(output - input),
    outputRows,
    inputRows,
  };
}
