import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateRoomNightTax,
  guestNightFromTypedRate,
  nightBasisFromToggles,
  roundBtn,
  sheetAmountFromTypedRate,
} from "./pricing";

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

  it("reads a typed 5400 as service charge in, GST out, or GST removed", () => {
    const rates = { serviceChargeRate: 0.1, gstRate: 0.05 };
    const insideSc = guestNightFromTypedRate(5400, "sc_in", rates);
    assert.equal(insideSc.totalBtn, 5400);
    assert.equal(insideSc.gstBtn, 0);
    assert.equal(insideSc.serviceChargeBtn, 490.91);

    const both = guestNightFromTypedRate(5400, "sc_gst_in", rates);
    assert.equal(both.totalBtn, 5400);
    assert.ok(both.gstBtn > 0);

    const stripped = guestNightFromTypedRate(5400, "strip_gst", rates);
    assert.equal(stripped.totalBtn, 5142.86);
    assert.equal(stripped.gstBtn, 0);

    const addSc = guestNightFromTypedRate(5400, "add_sc", rates);
    assert.equal(addSc.totalBtn, 5940);
    assert.equal(addSc.gstBtn, 0);

    const addBoth = guestNightFromTypedRate(5400, "add_sc_gst", rates);
    assert.equal(addBoth.gstBtn, 297);
    assert.equal(addBoth.totalBtn, 6237);
  });

  it("stores an inclusive 5400 as typed when service charge is already inside", () => {
    const basis = nightBasisFromToggles({
      includesServiceCharge: true,
      includesGst: false,
      gstCharged: false,
    });
    assert.equal(basis, "sc_in");
    assert.equal(
      sheetAmountFromTypedRate(5400, basis, { serviceChargeRate: 0.1, gstRate: 0 }, true),
      5400,
    );
    assert.equal(
      sheetAmountFromTypedRate(5400, "add_sc", { serviceChargeRate: 0.1, gstRate: 0 }, true),
      5940,
    );
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
