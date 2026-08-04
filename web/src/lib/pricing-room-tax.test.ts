import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateRoomNightTax, roundBtn } from "./pricing";

describe("calculateRoomNightTax exclusive", () => {
  it("adds SC then GST on (net + SC)", () => {
    const t = calculateRoomNightTax(10000, {
      gstRate: 0.07,
      serviceChargeRate: 0.1,
      applyServiceCharge: true,
      inclusiveOfGstSc: false,
    });
    assert.equal(t.amountBtn, 10000);
    assert.equal(t.serviceChargeBtn, 1000);
    // GST on 11000 @ 7% = 770
    assert.equal(t.gstBtn, 770);
    assert.equal(t.totalBtn, 11770);
    assert.equal(t.serviceChargeApplied, true);
    assert.equal(t.inclusiveOfGstSc, false);
  });

  it("skips SC when applyServiceCharge is false", () => {
    const t = calculateRoomNightTax(10000, {
      gstRate: 0.07,
      serviceChargeRate: 0.1,
      applyServiceCharge: false,
      inclusiveOfGstSc: false,
    });
    assert.equal(t.serviceChargeBtn, 0);
    assert.equal(t.gstBtn, 700);
    assert.equal(t.totalBtn, 10700);
    assert.equal(t.serviceChargeApplied, false);
  });
});

describe("calculateRoomNightTax inclusive", () => {
  it("reverse-outs net / SC / GST so parts sum to listed total", () => {
    // forward exclusive: 10000 -> SC 1000, GST 770, total 11770
    const t = calculateRoomNightTax(11770, {
      gstRate: 0.07,
      serviceChargeRate: 0.1,
      applyServiceCharge: true,
      inclusiveOfGstSc: true,
    });
    assert.equal(t.totalBtn, 11770);
    assert.equal(t.amountBtn, 10000);
    assert.equal(t.serviceChargeBtn, 1000);
    assert.equal(t.gstBtn, 770);
    assert.equal(
      roundBtn(t.amountBtn + t.serviceChargeBtn + t.gstBtn),
      t.totalBtn,
    );
  });

  it("GST-only reverse when SC off", () => {
    const t = calculateRoomNightTax(10700, {
      gstRate: 0.07,
      serviceChargeRate: 0.1,
      applyServiceCharge: false,
      inclusiveOfGstSc: true,
    });
    assert.equal(t.totalBtn, 10700);
    assert.equal(t.serviceChargeBtn, 0);
    assert.equal(t.amountBtn, 10000);
    assert.equal(t.gstBtn, 700);
  });

  it("zero rates leave amount equal to listed total", () => {
    const t = calculateRoomNightTax(5500, {
      gstRate: 0,
      serviceChargeRate: 0,
      applyServiceCharge: true,
      inclusiveOfGstSc: true,
    });
    assert.equal(t.amountBtn, 5500);
    assert.equal(t.serviceChargeBtn, 0);
    assert.equal(t.gstBtn, 0);
    assert.equal(t.totalBtn, 5500);
  });

  it("components always sum to total after rounding", () => {
    // Awkward total that won't divide cleanly
    const t = calculateRoomNightTax(9999, {
      gstRate: 0.07,
      serviceChargeRate: 0.1,
      applyServiceCharge: true,
      inclusiveOfGstSc: true,
    });
    assert.equal(
      roundBtn(t.amountBtn + t.serviceChargeBtn + t.gstBtn),
      t.totalBtn,
    );
  });
});
