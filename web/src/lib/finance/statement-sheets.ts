import type { HotelStatement } from "@/lib/finance/hotel-statement";
import type { RrcoView } from "@/lib/finance/rrco-pack";

type Sheet = {
  name: string;
  header: string[];
  rows: (string | number | null | undefined)[][];
};

export function hotelStatementSheets(s: HotelStatement): Sheet[] {
  const accountHeaders = s.matrixAccounts.map((a) => a.label);
  return [
    {
      name: "Summary",
      header: ["Item", "Amount_BTN"],
      rows: [
        ["Money sent in (not income)", s.transfersIn.reduce((n, r) => n + r.amount, 0)],
        ["Salary from payroll sheets", s.salarySheetTotal],
        ["Salary on bank (excluded)", s.salaryBankTotal],
        ["Other expenditure", s.otherSpend],
        ["Hotel expenditure", s.hotelSpend],
        ["City ledger", s.cityLedgerTotal],
        ["Early collections", s.earlyTotal],
        ["Walk-in and POS off folio", s.walkInTotal],
      ],
    },
    {
      name: "Expenditure",
      header: ["Category", "Lines", ...accountHeaders, "Total"],
      rows: [
        ...s.matrix.map((row) => [
          row.category,
          row.count,
          ...s.matrixAccounts.map((a) => row.byAccount[a.key] ?? 0),
          row.total,
        ]),
        [
          "Total",
          s.matrix.reduce((n, r) => n + r.count, 0),
          ...s.matrixAccounts.map((a) =>
            s.matrix.reduce((n, r) => n + (r.byAccount[a.key] ?? 0), 0),
          ),
          s.otherSpend,
        ],
      ],
    },
    {
      name: "Accounts",
      header: ["Account", "Opening", "Received", "Paid", "Closing"],
      rows: s.perAccount.map((a) => [a.label, a.opening, a.received, a.paid, a.closing]),
    },
    {
      name: "City ledger",
      header: ["Agent", "Balance_BTN"],
      rows: [
        ...s.cityLedger.map((r) => [r.agent, r.balance]),
        ["Total", s.cityLedgerTotal],
      ],
    },
    {
      name: "Early collections",
      header: ["Date", "Party", "Detail", "Amount_BTN"],
      rows: s.earlyCollections.map((r) => [r.date, r.party, r.detail, r.amount]),
    },
    {
      name: "Walk-in and POS",
      header: ["Date", "Party", "Method", "Reference", "Amount_BTN"],
      rows: s.walkInPos.map((r) => [r.date, r.party, r.method, r.ref, r.amount]),
    },
    {
      name: "Ledger",
      header: ["Date", "Account", "Party", "Category", "Treatment", "Detail", "Income", "Expense"],
      rows: s.ledger.map((r) => [
        r.date,
        r.accountLabel,
        r.party,
        r.category,
        r.treatment,
        r.detail,
        r.income || "",
        r.expense || "",
      ]),
    },
  ];
}

export function rrcoSheets(view: RrcoView): Sheet[] {
  const st = view.statements;
  return [
    {
      name: "RRCO invoices",
      header: ["Number", "Date", "Category", "Description", "Original ref", "Amount_BTN"],
      rows: view.docs
        .filter((d) => d.docKind === "invoice")
        .map((d) => [d.docNo, d.date, d.category, d.description, d.originalRef, d.amount]),
    },
    {
      name: "RRCO bills",
      header: ["Number", "Date", "Category", "Description", "Original ref", "Amount_BTN"],
      rows: view.docs
        .filter((d) => d.docKind === "bill")
        .map((d) => [d.docNo, d.date, d.category, d.description, d.originalRef, d.amount]),
    },
    {
      name: "RRCO P and L",
      header: ["Section", "Category", "Amount_BTN"],
      rows: [
        ...st.income.map((r) => ["Income", r.category, r.amount]),
        ["Income", "Total", st.totalIncome],
        ...st.expenses.map((r) => ["Expense", r.category, r.amount]),
        ["Expense", "Total", st.totalExpense],
        ["Net", "Net income", st.net],
      ],
    },
    {
      name: "RRCO balance sheet",
      header: ["Side", "Label", "Amount_BTN"],
      rows: [
        ...st.assets.map((r) => ["Asset", r.label, r.amount]),
        ["Asset", "Total", st.assetTotal],
        ...st.liabilities.map((r) => ["Liability", r.label, r.amount]),
        ...st.equity.map((r) => ["Equity", r.label, r.amount]),
        ["Equity", "Total", st.rightTotal],
      ],
    },
    {
      name: "RRCO trial balance",
      header: ["Label", "Debit", "Credit"],
      rows: [
        ...st.trial.map((r) => [r.label, r.debit, r.credit]),
        ["Total", st.trialDebit, st.trialCredit],
      ],
    },
    {
      name: "Comp schedule",
      header: ["Date", "Party", "Description", "Amount_BTN", "Reason"],
      rows: view.comps.map((r) => [r.date, r.party, r.description, r.amount, r.reason]),
    },
    {
      name: "Reason schedule",
      header: ["Date", "Treatment", "Category", "Description", "Amount_BTN", "Reason"],
      rows: view.reasons.map((r) => [
        r.date,
        r.treatment,
        r.category,
        r.description,
        r.amount,
        r.reason,
      ]),
    },
  ];
}
