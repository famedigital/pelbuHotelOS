import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPromoBenefit,
  stayLevelPromoDiscountPct,
} from "@/lib/marketing/promo-math";
import { calculateOrderTotals } from "@/lib/pricing";

describe("calculateOrderTotals NC lines", () => {
  it("excludes NC from payable total but reports ncValueBtn", () => {
    const t = calculateOrderTotals(
      [
        {
          qty: 2,
          unitPriceBtn: 100,
          gstApplicable: true,
        },
        {
          qty: 1,
          unitPriceBtn: 50,
          gstApplicable: true,
          isNc: true,
        },
      ],
      { gstRate: 0, applyServiceCharge: false },
    );
    assert.equal(t.subtotalBtn, 200);
    assert.equal(t.ncValueBtn, 50);
    assert.equal(t.listSubtotalBtn, 250);
    assert.equal(t.totalBtn, 200);
  });
});

describe("applyPromoBenefit", () => {
  it("applies 50% for TikTok-style pct", () => {
    assert.equal(applyPromoBenefit(1000, "pct", 50), 500);
  });
  it("nightly_rate_btn is not a cash discount", () => {
    assert.equal(applyPromoBenefit(1000, "nightly_rate_btn", 2000), 0);
  });
});

describe("stayLevelPromoDiscountPct", () => {
  it("stores pct benefit as stay-level %", () => {
    assert.equal(
      stayLevelPromoDiscountPct({
        benefitType: "pct",
        benefitValue: 50,
        discountBtn: 500,
        preDiscountBtn: 1000,
      }),
      50,
    );
  });
  it("amortizes fixed_btn as equivalent % of stay quote", () => {
    assert.equal(
      stayLevelPromoDiscountPct({
        benefitType: "fixed_btn",
        benefitValue: 1000,
        discountBtn: 1000,
        preDiscountBtn: 15000,
      }),
      6.67,
    );
  });
  it("returns null when fixed has no base", () => {
    assert.equal(
      stayLevelPromoDiscountPct({
        benefitType: "fixed_btn",
        discountBtn: 100,
        preDiscountBtn: 0,
      }),
      null,
    );
  });
  it("nightly_rate_btn does not set stay-level %", () => {
    assert.equal(
      stayLevelPromoDiscountPct({
        benefitType: "nightly_rate_btn",
        benefitValue: 2000,
        discountBtn: 0,
        preDiscountBtn: 4620,
      }),
      null,
    );
  });
});
