import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { billStreams } from "./bill-block";
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
    const laundry = { source_type: "laundry", description: "Laundry · Shirt" };
    const service = { source_type: "service", description: "Minibar · Water" };
    const mattress = { source_type: "extra_bed", description: "Extra mattress" };
    assert.equal(classifyBillLine(laundry), "services");
    assert.equal(classifyBillLine(service), "services");
    assert.equal(classifyBillLine(mattress), "room");
    assert.equal(lineBelongsOnBill(laundry, "fnb"), false);
    assert.equal(lineBelongsOnBill(laundry, "room"), false);
    assert.equal(lineBelongsOnBill(service, "fnb"), false);
    assert.equal(lineBelongsOnBill(laundry, "master"), true);
    assert.equal(lineBelongsOnBill(mattress, "room"), true);
  });

  it("names the food bill from the plan", () => {
    assert.equal(foodBillLabel("CP"), "Breakfast");
    assert.equal(foodBillLabel("BB"), "Breakfast");
    assert.equal(foodBillTitle("MAP"), "BREAKFAST & DINNER");
    assert.equal(foodBillLabel("EP"), "F&B bill");
  });

  it("puts laundry and services on the master due, not the food total", () => {
    const streams = billStreams([
      { source_type: "room", description: "Night", total_btn: 5000, status: "posted" },
      { source_type: "extra_bed", description: "Extra mattress", total_btn: 800, status: "posted" },
      { source_type: "pos", description: "Momos", total_btn: 200, status: "posted" },
      { source_type: "laundry", description: "Shirt", total_btn: 150, status: "posted" },
      { source_type: "service", description: "Minibar · Water", total_btn: 80, status: "posted" },
      { source_type: "payment", description: "Cash", total_btn: -1000, status: "posted" },
    ]);
    assert.equal(streams.room, 5800);
    assert.equal(streams.food, 200);
    assert.equal(streams.services, 230);
    assert.equal(streams.master, 6230);
  });
});
