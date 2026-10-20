import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  quoteStayComponents,
  splitMealNightShares,
} from "./stay-components";

describe("splitMealNightShares", () => {
  it("puts CP entirely on breakfast", () => {
    assert.deepEqual(splitMealNightShares("CP", 1000), {
      breakfast: 1000,
      lunch: 0,
      dinner: 0,
    });
  });

  it("splits MAP half and half", () => {
    const s = splitMealNightShares("MAP", 1000);
    assert.equal(s.breakfast + s.dinner, 1000);
    assert.equal(s.lunch, 0);
  });
});

describe("quoteStayComponents", () => {
  it("builds room + MAP + mattress components", () => {
    const q = quoteStayComponents({
      roomNightlyBtn: 5000,
      mealPerAdultNightBtn: 1000,
      mealPerChildNightBtn: 500,
      mealPlanCode: "MAP",
      adults: 2,
      children: 1,
      nights: 2,
      extraBeds: 1,
      extraBedPerNightBtn: 800,
    });
    assert.equal(q.roomStayBtn, 10000);
    assert.ok(q.breakfastStayBtn > 0);
    assert.ok(q.dinnerStayBtn > 0);
    assert.equal(q.extraPersonMealStayBtn, 1000);
    assert.equal(q.mattressStayBtn, 1600);
    assert.ok(q.components.some((c) => c.id === "dinner"));
  });
});
