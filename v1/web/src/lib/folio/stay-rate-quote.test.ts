import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  packageNightlyAverageBtn,
  packageStayTotalBtn,
  roomNightAllInBtn,
} from "./stay-rate-quote";

describe("stay-rate-quote", () => {
  it("applies exclusive tax on agreed listed rate", () => {
    // 1000 net → 10% SC → 1100; 10% GST on 1100 → 110; total 1210
    const allIn = roomNightAllInBtn(1000, {
      gstRate: 0.1,
      serviceChargeRate: 0.1,
      applyServiceCharge: true,
      inclusiveOfGstSc: false,
    });
    assert.equal(allIn, 1210);
  });

  it("keeps inclusive listed total as all-in", () => {
    const allIn = roomNightAllInBtn(3463, {
      gstRate: 0.1,
      serviceChargeRate: 0.1,
      applyServiceCharge: true,
      inclusiveOfGstSc: true,
    });
    assert.equal(allIn, 3463);
  });

  it("builds multi-night multi-room plan with meals", () => {
    const stay = packageStayTotalBtn({
      roomNightAllInBtn: 3000,
      rooms: 2,
      nights: 3,
      mealStayBtn: 500,
      extraBedStayBtn: 200,
    });
    // 3000 * 2 * 3 + 500 + 200 = 18700
    assert.equal(stay, 18700);
    assert.equal(packageNightlyAverageBtn(stay, 2, 3), 3116.67);
  });
});
