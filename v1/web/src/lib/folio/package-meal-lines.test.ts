import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mealPlanInclusions } from "@/lib/kitchen/covers";
import {
  allocatePackageShare,
  includedMealPeriods,
  presentFnbBillLines,
  stayServiceDates,
} from "./package-meal-lines";

describe("package meal print lines", () => {
  it("includes breakfast only on CP and breakfast plus dinner on MAP", () => {
    assert.deepEqual(mealPlanInclusions("CP"), {
      breakfast: true,
      lunch: false,
      dinner: false,
    });
    assert.deepEqual(mealPlanInclusions("BB"), mealPlanInclusions("CP"));
    assert.deepEqual(includedMealPeriods("MAP"), ["breakfast", "dinner"]);
    assert.deepEqual(mealPlanInclusions("MAP").lunch, false);
    assert.deepEqual(includedMealPeriods("AP"), [
      "breakfast",
      "lunch",
      "dinner",
    ]);
  });

  it("prints one package line per included meal per night and keeps the meal share", () => {
    const lines = presentFnbBillLines({
      mealPlanCode: "MAP",
      checkIn: "2026-09-01",
      checkOut: "2026-09-03",
      menus: [
        {
          serviceDate: "2026-09-01",
          mealPeriod: "breakfast",
          menuHighlights: "Porridge, ema datshi",
        },
        {
          serviceDate: "2026-09-01",
          mealPeriod: "dinner",
          menuNote: "Rice and dal",
        },
      ],
      lines: [
        {
          id: "meal-1",
          source_type: "meal_plan",
          description: "Meal plan MAP · Half board",
          total_btn: 2400,
          gst_btn: 100,
        },
        {
          id: "pos-1",
          source_type: "pos",
          description: "Lunch · momos",
          total_btn: 350,
          gst_btn: 20,
        },
      ],
    });

    const packageLines = lines.filter((line) => line.source_type === "meal_plan");
    const lunch = lines.find((line) => line.id === "pos-1");
    assert.equal(packageLines.length, 4);
    assert.equal(
      packageLines[0]?.description,
      "01 Sep 2026 · Breakfast · package",
    );
    assert.equal(packageLines[0]?.hint, "Porridge, ema datshi");
    assert.equal(packageLines[1]?.hint, "Rice and dal");
    assert.equal(packageLines[2]?.hint, null);
    assert.equal(
      packageLines.reduce((sum, line) => sum + line.total_btn, 0),
      2400,
    );
    assert.equal(lunch?.total_btn, 350);
    assert.equal(lunch?.description, "Lunch · momos");
  });

  it("prints breakfast only for CP and does not invent a dinner line", () => {
    const lines = presentFnbBillLines({
      mealPlanCode: "CP",
      checkIn: "2026-09-10",
      checkOut: "2026-09-11",
      lines: [
        {
          id: "meal-cp",
          source_type: "meal_plan",
          description: "Meal plan CP",
          total_btn: 400,
        },
      ],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0]!.description, /Breakfast · package/);
    assert.doesNotMatch(lines[0]!.description, /Dinner/);
    assert.equal(lines[0]!.total_btn, 400);
  });

  it("allocates the share without changing the total", () => {
    const parts = allocatePackageShare(100, 3);
    assert.equal(
      parts.reduce((sum, n) => sum + n, 0),
      100,
    );
    assert.deepEqual(stayServiceDates("2026-09-01", "2026-09-01"), []);
  });
});
