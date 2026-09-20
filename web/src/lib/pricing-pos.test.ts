import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateOrderTotals } from "./pricing";

describe("POS ticket totals (set meal + GST/SC)", () => {
  it("bills covers × set price plus a la carte dishes", () => {
    const totals = calculateOrderTotals(
      [
        { qty: 2, unitPriceBtn: 650, gstApplicable: true },
        { qty: 1, unitPriceBtn: 180, gstApplicable: true },
        { qty: 1, unitPriceBtn: 90, gstApplicable: true },
      ],
      { gstRate: 0.07, applyServiceCharge: false },
    );
    assert.equal(totals.subtotalBtn, 1570);
    assert.equal(totals.serviceChargeBtn, 0);
    assert.equal(totals.gstBtn, 109.9);
    assert.equal(totals.totalBtn, 1679.9);
  });

  it("zeros GST when applyGst is false", () => {
    const totals = calculateOrderTotals(
      [
        { qty: 2, unitPriceBtn: 600, gstApplicable: true },
        { qty: 1, unitPriceBtn: 120, gstApplicable: true },
      ],
      {
        gstRate: 0.07,
        serviceChargeRate: 0.1,
        applyServiceCharge: true,
        applyGst: false,
      },
    );
    assert.equal(totals.subtotalBtn, 1320);
    assert.equal(totals.serviceChargeBtn, 132);
    assert.equal(totals.gstBtn, 0);
    assert.equal(totals.totalBtn, 1452);
  });

  it("can waive service charge while keeping GST", () => {
    const totals = calculateOrderTotals(
      [{ qty: 1, unitPriceBtn: 650, gstApplicable: true }],
      {
        gstRate: 0.07,
        serviceChargeRate: 0.1,
        applyServiceCharge: false,
        applyGst: true,
      },
    );
    assert.equal(totals.serviceChargeBtn, 0);
    assert.equal(totals.gstBtn, 45.5);
    assert.equal(totals.totalBtn, 695.5);
  });
});
