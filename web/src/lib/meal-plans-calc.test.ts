import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExtraBedStayTotalBtn,
  computeMealStayTotalBtn,
  extraBedIsSellable,
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

  it("children with null child rate are free", () => {
    assert.equal(computeMealStayTotalBtn(500, 2, 3, null, 2), 3000);
  });

  it("children with child rate add child_rate × children × nights", () => {
    assert.equal(computeMealStayTotalBtn(500, 2, 3, 250, 2), 4500);
  });

  it("minimum 1 adult and 1 night", () => {
    assert.equal(computeMealStayTotalBtn(100, 0, 0), 100);
  });

  it("extra bed multiplies rate × qty × nights", () => {
    assert.equal(computeExtraBedStayTotalBtn(800, 1, 3), 2400);
    assert.equal(computeExtraBedStayTotalBtn(800, 2, 2), 3200);
    assert.equal(computeExtraBedStayTotalBtn(null, 1, 3), 0);
    assert.equal(computeExtraBedStayTotalBtn(800, 0, 3), 0);
  });

  it("extraBedIsSellable requires active + positive rate", () => {
    assert.equal(extraBedIsSellable(true, 800), true);
    assert.equal(extraBedIsSellable(true, null), false);
    assert.equal(extraBedIsSellable(false, 800), false);
  });
});
