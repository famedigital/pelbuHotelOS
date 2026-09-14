export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "cogs";

export type JournalKind =
  | "general"
  | "opening"
  | "sales"
  | "payment"
  | "expense"
  | "payroll"
  | "inventory"
  | "bank"
  | "gst"
  | "depreciation"
  | "closing"
  | "reversal";

export type JournalLineInput = {
  accountId: string;
  departmentId?: string | null;
  description?: string;
  debitBtn: number;
  creditBtn: number;
};

export type JournalDraft = {
  journalDate: string;
  journalKind: JournalKind;
  memo?: string;
  sourceTable?: string;
  sourceId?: string;
  sourceEvent?: string;
  lines: JournalLineInput[];
  createdBy?: string;
};

export type AccountingAccount = {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  normal_balance: "debit" | "credit";
  system_key: string | null;
  is_active: boolean;
  is_postable: boolean;
};

export type AccountingPeriod = {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  status: "open" | "soft_closed" | "closed";
  fiscal_year_id: string;
};

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

export type StatementRow = {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  department?: string | null;
  amount: number;
};

export type PostingResult =
  | { ok: true; journalId: string; skipped?: boolean }
  | { ok: false; error: string };
