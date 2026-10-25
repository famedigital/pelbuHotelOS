import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMasterBillRows } from "./master-bill-rows";

describe("master bill rows", () => {
  it("keeps one row per folio with the folio number, not each charge", () => {
    const rows = buildMasterBillRows([
      {
        id: "a",
        docNo: "PSFN-2026-00160",
        guest: "Stephanie Yu",
        room: "505",
        arrival: "2026-10-22",
        departure: "2026-10-25",
        mealPlanCode: "MAP",
        lines: [
          { source_type: "room", description: "Room 505 · 2026-10-22", total_btn: 8000 },
          { source_type: "room", description: "Room 505 · 2026-10-23", total_btn: 8000 },
          { source_type: "room", description: "Room 505 · 2026-10-24", total_btn: 8000 },
          { source_type: "pos", description: "Coke", total_btn: 100 },
          { source_type: "laundry", description: "Shirt", total_btn: 150 },
        ],
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.folio, "PSFN-2026-00160");
    assert.equal(rows[0]?.guest, "Stephanie Yu");
    assert.equal(rows[0]?.room, "505");
    assert.match(rows[0]?.stay ?? "", /3 nights/);
    assert.equal(rows[0]?.description, "Room, Breakfast and dinner, Laundry");
    assert.equal(rows[0]?.nights, 3);
    assert.equal(rows[0]?.rate, 8000);
    assert.equal(rows[0]?.qty, 1);
    assert.equal(rows[0]?.amount, 24250);
  });

  it("lists every folio and sorts by room", () => {
    const rows = buildMasterBillRows([
      {
        id: "b",
        docNo: "PSFN-2026-00002",
        guest: "Nghia",
        room: "506",
        arrival: "2026-10-23",
        departure: "2026-10-25",
        mealPlanCode: "EP",
        lines: [{ source_type: "room", description: "Room", total_btn: 4000 }],
      },
      {
        id: "a",
        docNo: "PSFN-2026-00001",
        guest: "Thanh",
        room: "201",
        arrival: "2026-10-23",
        departure: "2026-10-25",
        mealPlanCode: "CP",
        lines: [
          { source_type: "room", description: "Room", total_btn: 5000 },
          { source_type: "meal_plan", description: "Breakfast", total_btn: 0 },
        ],
      },
    ]);
    assert.deepEqual(
      rows.map((row) => row.folio),
      ["PSFN-2026-00001", "PSFN-2026-00002"],
    );
    assert.equal(rows[0]?.description, "Room, Breakfast");
    assert.equal(rows[0]?.nights, 2);
    assert.equal(rows[0]?.rate, 2500);
    assert.equal(rows[0]?.qty, 1);
    assert.equal(rows[1]?.description, "Room");
    assert.equal(rows[1]?.nights, 2);
    assert.equal(rows[1]?.rate, 2000);
    assert.equal(rows[1]?.qty, null);
  });
});
