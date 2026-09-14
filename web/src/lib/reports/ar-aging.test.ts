import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addToAging, agingBucket, emptyAging } from "@/lib/reports/ar-aging";
import { applyDiscountPct } from "@/lib/partners/discount";

describe("agingBucket", () => {
  it("buckets by days past", () => {
    assert.equal(agingBucket(0), "current");
    assert.equal(agingBucket(30), "current");
    assert.equal(agingBucket(31), "d30");
    assert.equal(agingBucket(60), "d30");
    assert.equal(agingBucket(61), "d60");
    assert.equal(agingBucket(90), "d60");
    assert.equal(agingBucket(91), "d90");
  });
});

describe("addToAging", () => {
  it("accumulates outstanding into buckets", () => {
    let buckets = emptyAging();
    buckets = addToAging(buckets, 100, "2026-08-01", "2026-07-20");
    // 2026-06-01 → 2026-08-01 = 61 days → d60 (31–60 = d30)
    buckets = addToAging(buckets, 50, "2026-08-01", "2026-06-01");
    assert.equal(buckets.current, 100);
    assert.equal(buckets.d60, 50);
    assert.equal(buckets.total, 150);
  });
});

describe("applyDiscountPct", () => {
  it("applies partner discount", () => {
    assert.equal(applyDiscountPct(1000, 10), 900);
    assert.equal(applyDiscountPct(1000, 0), 1000);
    assert.equal(applyDiscountPct(1000, 100), 0);
  });
});
