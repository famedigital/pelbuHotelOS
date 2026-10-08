/** Pure hotel-statement and RRCO maths. No database. */

export const EXPENSE_HEADS = [
  "Grocery",
  "Veg",
  "Meat",
  "Office",
  "Misc",
  "Gas",
  "Electric",
  "Water and sewerage",
  "Repair",
  "Maintenance",
  "AMC",
  "Taxi",
  "Driver",
  "Guides",
  "Rent",
  "Others",
] as const;

export const BANK_TREATMENTS = [
  "unmatched",
  "room_receipt",
  "walkin_receipt",
  "pos_receipt",
  "agent_settlement",
  "early_collection",
  "owner_transfer",
  "loan_in",
  "loan_out",
  "cash_deposit",
  "expense",
  "salary_bank",
  "not_income",
] as const;

export type BankTreatment = (typeof BANK_TREATMENTS)[number];

export const RRCO_TREATMENTS = [
  "include_income",
  "include_expense",
  "comp",
  "owner_transfer",
  "loan",
  "deposit",
  "capital",
  "personal",
  "duplicate",
  "sdf_passthrough",
  "agent_settlement",
  "salary_sheet",
] as const;

export type RrcoTreatment = (typeof RRCO_TREATMENTS)[number];

const TURNOVER_TENDERS = new Set([
  "cash",
  "bank",
  "card",
  "bank_qr",
  "pay_bt",
  "mbob",
  "mpay",
  "deposit",
]);

const COMP_TENDERS = new Set(["comp", "staff_meal", "owner_meal", "nc"]);

export function roundBtn(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function accountClosing(
  opening: number,
  credits: number,
  debits: number,
): number {
  return roundBtn(opening + credits - debits);
}

type Rule = { test: RegExp; category: string; treatment: BankTreatment };

const DEBIT_RULES: Rule[] = [
  { test: /salary|payroll|\bwage/i, category: "Salary", treatment: "salary_bank" },
  { test: /\bveg\b|vegetable/i, category: "Veg", treatment: "expense" },
  { test: /meat|chicken|pork|beef|mutton/i, category: "Meat", treatment: "expense" },
  { test: /grocery|mart|bakery|\brice\b|\boil\b/i, category: "Grocery", treatment: "expense" },
  { test: /\bgas\b|\blpg\b|fuel/i, category: "Gas", treatment: "expense" },
  { test: /electric|\bbpc\b|\bpower\b/i, category: "Electric", treatment: "expense" },
  { test: /water|sewer/i, category: "Water and sewerage", treatment: "expense" },
  { test: /taxi/i, category: "Taxi", treatment: "expense" },
  { test: /guide/i, category: "Guides", treatment: "expense" },
  { test: /driver/i, category: "Driver", treatment: "expense" },
  { test: /repair/i, category: "Repair", treatment: "expense" },
  { test: /maintain/i, category: "Maintenance", treatment: "expense" },
  { test: /\bamc\b/i, category: "AMC", treatment: "expense" },
  { test: /office|internet|recharge|stationery/i, category: "Office", treatment: "expense" },
  { test: /\brent\b/i, category: "Rent", treatment: "expense" },
  { test: /loan/i, category: "Loans given", treatment: "loan_out" },
  { test: /misc/i, category: "Misc", treatment: "expense" },
];

const CREDIT_RULES: Rule[] = [
  { test: /loan/i, category: "Loans received", treatment: "loan_in" },
  { test: /cash deposit|\batm\b/i, category: "Cash deposits", treatment: "cash_deposit" },
  { test: /salary loan/i, category: "Salary loan", treatment: "loan_in" },
];

export function suggestBankClass(
  description: string,
  side: "credit" | "debit",
): { category: string; treatment: BankTreatment } {
  const rules = side === "debit" ? DEBIT_RULES : CREDIT_RULES;
  for (const rule of rules) {
    if (rule.test.test(description)) {
      return { category: rule.category, treatment: rule.treatment };
    }
  }
  if (side === "debit") return { category: "Others", treatment: "expense" };
  return { category: "Transfers and receipts in", treatment: "unmatched" };
}

export function isTurnoverTender(method: string | null | undefined): boolean {
  return TURNOVER_TENDERS.has((method ?? "").toLowerCase());
}

export function isCompTender(method: string | null | undefined): boolean {
  return COMP_TENDERS.has((method ?? "").toLowerCase());
}

export type MatrixLine = {
  category: string;
  accountKey: string;
  amount: number;
  treatment: string;
};

export function expenditureMatrix(
  lines: MatrixLine[],
  accountKeys: string[],
): { category: string; byAccount: Record<string, number>; total: number; count: number }[] {
  const cats = new Map<string, { byAccount: Record<string, number>; total: number; count: number }>();
  for (const head of EXPENSE_HEADS) {
    const byAccount: Record<string, number> = {};
    for (const key of accountKeys) byAccount[key] = 0;
    cats.set(head, { byAccount, total: 0, count: 0 });
  }
  for (const line of lines) {
    if (line.treatment !== "expense") continue;
    const head = EXPENSE_HEADS.includes(line.category as (typeof EXPENSE_HEADS)[number])
      ? line.category
      : "Others";
    const row = cats.get(head)!;
    const key = accountKeys.includes(line.accountKey) ? line.accountKey : accountKeys[0];
    if (key) row.byAccount[key] = roundBtn((row.byAccount[key] ?? 0) + line.amount);
    row.total = roundBtn(row.total + line.amount);
    row.count += 1;
  }
  return [...cats.entries()].map(([category, row]) => ({ category, ...row }));
}

export type CanonSource = {
  sourceKind: string;
  sourceId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  originalRef: string;
  docKind: "invoice" | "bill";
};

export type CanonDoc = CanonSource & { seq: number; docNo: string };

export function buildCanonicalNumbers(year: number, sources: CanonSource[]): CanonDoc[] {
  const sorted = [...sources].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.docKind !== b.docKind) return a.docKind === "invoice" ? -1 : 1;
    return a.description.localeCompare(b.description);
  });
  let inv = 0;
  let bill = 0;
  return sorted.map((src) => {
    const seq = src.docKind === "invoice" ? ++inv : ++bill;
    const prefix = src.docKind === "invoice" ? "RRCO-INV" : "RRCO-BILL";
    return {
      ...src,
      seq,
      docNo: `${prefix}-${year}-${String(seq).padStart(4, "0")}`,
    };
  });
}

export type RrcoDoc = {
  docKind: "invoice" | "bill";
  category: string;
  amount: number;
};

export type RrcoStatements = {
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  totalIncome: number;
  totalExpense: number;
  net: number;
  assets: { label: string; amount: number }[];
  liabilities: { label: string; amount: number }[];
  equity: { label: string; amount: number }[];
  assetTotal: number;
  rightTotal: number;
  trial: { label: string; debit: number; credit: number }[];
  trialDebit: number;
  trialCredit: number;
  balanced: boolean;
};

export function buildRrcoStatements(input: {
  docs: RrcoDoc[];
  cashInHand: number;
  bank: number;
  agentAr: number;
  loans: number;
  deposits: number;
  ownerFunds: number;
  capital: number;
}): RrcoStatements {
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  for (const doc of input.docs) {
    const map = doc.docKind === "invoice" ? incomeMap : expenseMap;
    map.set(doc.category, roundBtn((map.get(doc.category) ?? 0) + doc.amount));
  }
  const income = [...incomeMap.entries()].map(([category, amount]) => ({ category, amount }));
  const expenses = [...expenseMap.entries()].map(([category, amount]) => ({ category, amount }));
  const totalIncome = roundBtn(income.reduce((s, r) => s + r.amount, 0));
  const totalExpense = roundBtn(expenses.reduce((s, r) => s + r.amount, 0));
  const net = roundBtn(totalIncome - totalExpense);

  const assetBase = roundBtn(input.cashInHand + input.bank + input.agentAr);
  const loans = roundBtn(Math.max(input.loans, 0));
  const rightBase = roundBtn(loans + input.deposits + input.capital + input.ownerFunds + net);
  const gap = roundBtn(assetBase - rightBase);

  const assets: { label: string; amount: number }[] = [
    { label: "Cash in hand", amount: roundBtn(input.cashInHand) },
    { label: "Bank", amount: roundBtn(input.bank) },
    { label: "Agent city ledger", amount: roundBtn(input.agentAr) },
  ];
  const liabilities: { label: string; amount: number }[] = [
    { label: "Loans", amount: loans },
    { label: "Unearned collections", amount: roundBtn(input.deposits) },
  ];
  const equity: { label: string; amount: number }[] = [
    { label: "Capital", amount: roundBtn(input.capital) },
    { label: "Owner funds sent in", amount: roundBtn(input.ownerFunds) },
    { label: "Net income", amount: net },
  ];
  if (gap > 0) {
    equity.push({ label: "Opening and unclassified", amount: gap });
  } else if (gap < 0) {
    assets.push({ label: "Opening and unclassified", amount: roundBtn(-gap) });
  }

  const assetTotal = roundBtn(assets.reduce((s, r) => s + r.amount, 0));
  const rightTotal = roundBtn(
    [...liabilities, ...equity].reduce((s, r) => s + r.amount, 0),
  );

  const trial: { label: string; debit: number; credit: number }[] = [
    ...assets.map((r) => ({ label: r.label, debit: r.amount, credit: 0 })),
    ...expenses.map((r) => ({ label: r.category, debit: r.amount, credit: 0 })),
    ...liabilities.map((r) => ({ label: r.label, debit: 0, credit: r.amount })),
    ...equity
      .filter((r) => r.label !== "Net income")
      .map((r) => ({ label: r.label, debit: 0, credit: r.amount })),
    ...income.map((r) => ({ label: r.category, debit: 0, credit: r.amount })),
  ];
  const trialDebit = roundBtn(trial.reduce((s, r) => s + r.debit, 0));
  const trialCredit = roundBtn(trial.reduce((s, r) => s + r.credit, 0));

  return {
    income,
    expenses,
    totalIncome,
    totalExpense,
    net,
    assets,
    liabilities,
    equity,
    assetTotal,
    rightTotal,
    trial,
    trialDebit,
    trialCredit,
    balanced: trialDebit === trialCredit && assetTotal === rightTotal,
  };
}

/** Bank-line treatment → RRCO line. Salary paid through the bank is not an expense line. */
export function rrcoTreatmentForBank(
  treatment: BankTreatment,
): RrcoTreatment | null {
  switch (treatment) {
    case "room_receipt":
    case "walkin_receipt":
    case "pos_receipt":
    case "cash_deposit":
      return null;
    case "expense":
      return "include_expense";
    case "salary_bank":
      return null;
    case "agent_settlement":
      return "agent_settlement";
    case "early_collection":
      return "deposit";
    case "owner_transfer":
    case "not_income":
      return "owner_transfer";
    case "loan_in":
    case "loan_out":
      return "loan";
    default:
      return null;
  }
}
