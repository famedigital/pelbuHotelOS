import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bankFingerprint,
  resolveReceiptTax,
  validateExpenseDraft,
} from "@/lib/finance-import/validation";

describe("resolveReceiptTax", () => {
  it("keeps printed GST", () => {
    const r = resolveReceiptTax({
      amountBtn: 107,
      gstBtn: 7,
      gstPrinted: true,
      tpn: "123",
    });
    assert.equal(r.gstBtn, 7);
    assert.equal(r.netBtn, 100);
    assert.deepEqual(r.warnings, []);
  });

  it("never invents GST from TPN alone", () => {
    const r = resolveReceiptTax({
      amountBtn: 100,
      gstBtn: null,
      gstPrinted: false,
      tpn: "TPN-999",
    });
    assert.equal(r.gstBtn, 0);
    assert.ok(r.warnings.includes("gst_not_printed_review_required"));
    assert.ok(r.warnings.includes("tpn_present_gst_unconfirmed"));
  });
});

describe("validateExpenseDraft", () => {
  it("flags missing fields", () => {
    assert.ok(validateExpenseDraft({}).length > 0);
  });

  it("accepts a valid draft", () => {
    assert.deepEqual(
      validateExpenseDraft({
        expense_date: "2026-07-01",
        description: "Supplies",
        amount_btn: 50,
        gst_btn: 0,
        category: "supplies",
      }),
      [],
    );
  });
});

describe("bankFingerprint", () => {
  it("is stable", () => {
    const a = bankFingerprint({
      bankCode: "bob",
      txnDate: "2026-07-01",
      description: "POS SALE",
      debit: 10,
      credit: 0,
      reference: "x",
    });
    const b = bankFingerprint({
      bankCode: "bob",
      txnDate: "2026-07-01",
      description: "POS SALE",
      debit: 10,
      credit: 0,
      reference: "x",
    });
    assert.equal(a, b);
    assert.equal(a.length, 40);
  });
});
