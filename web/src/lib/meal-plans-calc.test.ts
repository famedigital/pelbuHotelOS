import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeMealStayTotalBtn,
  mealPlanHasMoney,
} from "./meal-plans-calc";

describe("meal-plans-calc", () => {
  it("null amount = label-only (no folio money)", () => {
    assert.equal(computeMealStayTotalBtn(null, 2, 3), null);
    assert.equal(mealPlanHasMoney(null), false);
  });

  it("EP room-only is Nu 0", () => {
    assert.equal(computeMealStayTotalBtn(0, 2, 3), 0);
    assert.equal(mealPlanHasMoney(0), false);
  });

  it("priced meal multiplies adults × nights", () => {
    assert.equal(computeMealStayTotalBtn(500, 2, 3), 3000);
    assert.equal(mealPlanHasMoney(500), true);
  });

  it("minimum 1 adult and 1 night", () => {
    assert.equal(computeMealStayTotalBtn(100, 0, 0), 100);
  });
});
