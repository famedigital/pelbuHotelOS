import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountClosing,
  buildCanonicalNumbers,
  buildRrcoStatements,
  expenditureMatrix,
  rrcoTreatmentForBank,
  suggestBankClass,
} from "./statement-model";

describe("suggestBankClass", () => {
  it("treats salary remarks as bank salary, not grocery", () => {
    const hit = suggestBankClass("Renuka August salary fund transfer", "debit");
    assert.equal(hit.treatment, "salary_bank");
    assert.equal(hit.category, "Salary");
  });

  it("leaves an unmatched credit out of room income", () => {
    const hit = suggestBankClass("Inward transfer RRN-1", "credit");
    assert.equal(hit.treatment, "unmatched");
  });

  it("classifies a loan credit as a loan", () => {
    const hit = suggestBankClass("Salary loan from Pema", "credit");
    assert.equal(hit.treatment, "loan_in");
  });
});

describe("expenditureMatrix", () => {
  it("skips salary bank lines and sums expense by account", () => {
    const rows = expenditureMatrix(
      [
        { category: "Grocery", accountKey: "op", amount: 10, treatment: "expense" },
        { category: "Grocery", accountKey: "owner", amount: 5, treatment: "expense" },
        { category: "Salary", accountKey: "op", amount: 100, treatment: "salary_bank" },
      ],
      ["op", "owner"],
    );
    const grocery = rows.find((r) => r.category === "Grocery");
    assert.equal(grocery?.total, 15);
    assert.equal(grocery?.byAccount.op, 10);
    assert.equal(rows.every((r) => r.category !== "Salary" || r.total === 0), true);
  });
});

describe("buildCanonicalNumbers", () => {
  it("numbers invoices and bills by date and keeps the source", () => {
    const docs = buildCanonicalNumbers(2026, [
      {
        sourceKind: "folio",
        sourceId: "b",
        date: "2026-02-02",
        description: "Later room",
        amount: 20,
        category: "Room and guest receipts",
        originalRef: "FOL-2",
        docKind: "invoice",
      },
      {
        sourceKind: "folio",
        sourceId: "a",
        date: "2026-01-01",
        description: "Earlier room",
        amount: 10,
        category: "Room and guest receipts",
        originalRef: "FOL-1",
        docKind: "invoice",
      },
      {
        sourceKind: "bank",
        sourceId: "e",
        date: "2026-01-01",
        description: "Grocery",
        amount: 4,
        category: "Grocery",
        originalRef: "RRN-9",
        docKind: "bill",
      },
    ]);
    assert.deepEqual(
      docs.map((d) => d.docNo),
      ["RRCO-INV-2026-0001", "RRCO-BILL-2026-0001", "RRCO-INV-2026-0002"],
    );
    assert.equal(docs[0].originalRef, "FOL-1");
  });
});

describe("buildRrcoStatements", () => {
  it("balances the trial after an opening plug", () => {
    const pack = buildRrcoStatements({
      docs: [
        { docKind: "invoice", category: "Room and guest receipts", amount: 1000 },
        { docKind: "bill", category: "Grocery", amount: 400 },
      ],
      cashInHand: 100,
      bank: 500,
      agentAr: 200,
      loans: 50,
      deposits: 30,
      ownerFunds: 100,
      capital: 80,
    });
    assert.equal(pack.net, 600);
    assert.equal(pack.balanced, true);
    assert.equal(pack.trialDebit, pack.trialCredit);
  });
});

describe("rrcoTreatmentForBank", () => {
  it("does not turn a bank receipt or a salary transfer into a second document", () => {
    assert.equal(rrcoTreatmentForBank("room_receipt"), null);
    assert.equal(rrcoTreatmentForBank("salary_bank"), null);
    assert.equal(rrcoTreatmentForBank("agent_settlement"), "agent_settlement");
    assert.equal(rrcoTreatmentForBank("expense"), "include_expense");
  });
});

describe("accountClosing", () => {
  it("checks opening plus received minus paid", () => {
    assert.equal(accountClosing(0, 1347664.85, 1340266.63), 7398.22);
  });
});
