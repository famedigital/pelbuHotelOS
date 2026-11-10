import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pointsFromSpendBtn } from "@/lib/loyalty/points-math";

describe("pointsFromSpendBtn", () => {
  it("awards 1 per 10 BTN", () => {
    assert.equal(pointsFromSpendBtn(0), 0);
    assert.equal(pointsFromSpendBtn(9), 1);
    assert.equal(pointsFromSpendBtn(100), 10);
    assert.equal(pointsFromSpendBtn(1055), 105);
  });
});
