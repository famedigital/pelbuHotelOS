import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILL_KIND_LABELS,
  classifyBillLine,
  foodBillLabel,
  foodBillTitle,
  lineBelongsOnBill,
  parseBillKind,
} from "./bill-kinds";

describe("bill process kinds", () => {
  it("parses Master / Room / F&B", () => {
    assert.equal(parseBillKind("master"), "master");
    assert.equal(parseBillKind("room"), "room");
    assert.equal(parseBillKind("fnb"), "fnb");
    assert.equal(parseBillKind("other"), "master");
    assert.equal(BILL_KIND_LABELS.master, "Master bill");
  });

  it("classifies room vs F&B vs adj", () => {
    assert.equal(
      classifyBillLine({ source_type: "room", description: "Peak night" }),
      "room",
    );
    assert.equal(
      classifyBillLine({ source_type: "pos", description: "Momos" }),
      "fnb",
    );
    assert.equal(
      classifyBillLine({
        source_type: "meal_plan",
        description: "Meal plan MAP · Half board",
      }),
      "fnb",
    );
    assert.equal(
      classifyBillLine({
        source_type: "adjustment",
        description: "Adj · hotel absorbs · room bill (round to Nu 0 or 5)",
      }),
      "hotel_adj",
    );
  });

  it("filters lines per bill kind", () => {
    const room = { source_type: "room", description: "Night 1" };
    const pos = { source_type: "pos", description: "Dinner" };
    const roomAdj = {
      source_type: "adjustment",
      description: "Adj · hotel absorbs · room bill (round to Nu 0 or 5)",
    };
    assert.equal(lineBelongsOnBill(room, "room"), true);
    assert.equal(lineBelongsOnBill(pos, "room"), false);
    assert.equal(lineBelongsOnBill(roomAdj, "room"), true);
    assert.equal(lineBelongsOnBill(pos, "fnb"), true);
    assert.equal(lineBelongsOnBill(room, "master"), true);
    const meal = {
      source_type: "meal_plan",
      description: "Meal plan CP · Breakfast",
    };
    assert.equal(lineBelongsOnBill(meal, "room"), false);
    assert.equal(lineBelongsOnBill(meal, "fnb"), true);
    assert.equal(lineBelongsOnBill(pos, "fnb"), true);
  });

  it("names the food bill from the plan", () => {
    assert.equal(foodBillLabel("CP"), "Breakfast");
    assert.equal(foodBillLabel("BB"), "Breakfast");
    assert.equal(foodBillTitle("MAP"), "BREAKFAST & DINNER");
    assert.equal(foodBillLabel("EP"), "F&B bill");
  });
});
