import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ownerProfitIdentity,
  resolveOwnerPeriod,
  rollupExpenseCategories,
} from "./owner-period.js";

describe("resolveOwnerPeriod", () => {
  it("bounds YTD from Jan 1 to asOf", () => {
    const p = resolveOwnerPeriod("ytd", { asOf: "2026-11-13" });
    assert.equal(p.from, "2026-01-01");
    assert.equal(p.to, "2026-11-13");
    assert.equal(p.label, "This year");
  });

  it("bounds this month to calendar month capped at asOf", () => {
    const p = resolveOwnerPeriod("month", { asOf: "2026-11-13" });
    assert.equal(p.from, "2026-11-01");
    assert.equal(p.to, "2026-11-13");
  });

  it("uses peak season window crossing year when season=peak in Nov", () => {
    const p = resolveOwnerPeriod("season", { asOf: "2026-11-13", season: "peak" });
    assert.equal(p.from, "2026-10-01");
    assert.equal(p.to, "2026-11-13");
    assert.match(p.label, /peak/i);
  });

  it("uses lean season May–Sep when season=lean", () => {
    const p = resolveOwnerPeriod("season", { asOf: "2026-07-15", season: "lean" });
    assert.equal(p.from, "2026-05-01");
    assert.equal(p.to, "2026-07-15");
    assert.match(p.label, /lean/i);
  });

  it("peak in March uses prior Oct start", () => {
    const p = resolveOwnerPeriod("season", { asOf: "2026-03-10", season: "peak" });
    assert.equal(p.from, "2025-10-01");
    assert.equal(p.to, "2026-03-10");
  });
});

describe("owner money identity + category rollup", () => {
  it("profit = income − expense", () => {
    assert.equal(ownerProfitIdentity(100_000, 40_000), 60_000);
    assert.equal(ownerProfitIdentity(10_000, 12_000), -2_000);
  });

  it("rolls expense categories by amount", () => {
    const cats = rollupExpenseCategories([
      { category: "veg_dairy", amount: 2500 },
      { category: "utility", amount: 1500 },
      { category: "veg_dairy", amount: 500 },
    ]);
    assert.equal(cats[0]?.category, "veg_dairy");
    assert.equal(cats[0]?.amount, 3000);
    assert.equal(cats[0]?.count, 2);
    assert.equal(cats[1]?.category, "utility");
  });
});
