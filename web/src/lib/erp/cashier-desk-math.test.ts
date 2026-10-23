import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bucketTender, folioMoney } from "./cashier-desk-math";

describe("cashier desk math", () => {
  it("buckets till methods", () => {
    assert.equal(bucketTender("cash"), "cash");
    assert.equal(bucketTender("card"), "bank");
    assert.equal(bucketTender("bank_qr"), "qr");
    assert.equal(bucketTender("agent_credit"), "other");
  });

  it("splits charges and payments and ignores a voided pair", () => {
    const money = folioMoney([
      {
        id: "room",
        status: "posted",
        total_btn: 5143,
        source_type: "room",
      },
      {
        id: "pay",
        status: "posted",
        total_btn: -2000,
        source_type: "payment",
      },
      {
        id: "old",
        status: "voided",
        total_btn: 3450,
        source_type: "room",
      },
      {
        id: "rev",
        status: "posted",
        total_btn: -3450,
        source_type: "adjustment",
        reverses_line_id: "old",
      },
    ]);
    assert.equal(money.chargesBtn, 5143);
    assert.equal(money.paidBtn, 2000);
    assert.equal(money.dueBtn, 3143);
  });
});
