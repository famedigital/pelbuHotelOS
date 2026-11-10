import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFolioChargeRows } from "./folio-charge-rows";

describe("folio charge rows", () => {
  it("groups room nights and keeps the nightly rate", () => {
    const rows = buildFolioChargeRows([
      {
        id: "1",
        source_type: "room",
        description: "Room 505 · 2026-10-22",
        total_btn: 8000,
        qty: 1,
        business_date: "2026-10-22",
      },
      {
        id: "2",
        source_type: "room",
        description: "Room 505 · 2026-10-23",
        total_btn: 8000,
        qty: 1,
        business_date: "2026-10-23",
      },
      {
        id: "3",
        source_type: "room",
        description: "Room 505 · 2026-10-24",
        total_btn: 8000,
        qty: 1,
        business_date: "2026-10-24",
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.room, "505");
    assert.equal(rows[0]?.nights, 3);
    assert.equal(rows[0]?.rate, 8000);
    assert.equal(rows[0]?.qty, null);
    assert.equal(rows[0]?.amount, 24000);
  });

  it("shows food quantity and rate", () => {
    const rows = buildFolioChargeRows([
      {
        id: "c",
        source_type: "order",
        description: "Coke",
        total_btn: 200,
        unit_price_btn: 100,
        qty: 2,
      },
    ]);
    assert.equal(rows[0]?.qty, 2);
    assert.equal(rows[0]?.rate, 100);
    assert.equal(rows[0]?.nights, null);
    assert.equal(rows[0]?.amount, 200);
  });

  it("keeps an extra mattress as its own quantity, not a stay night", () => {
    const rows = buildFolioChargeRows(
      [
        {
          id: "m",
          source_type: "extra_bed",
          description: "Extra mattress",
          total_btn: 1500,
          unit_price_btn: 750,
          qty: 2,
        },
      ],
      { checkIn: "2026-10-01", checkOut: "2026-10-04" },
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.particulars, "Extra mattress");
    assert.equal(rows[0]?.qty, 2);
    assert.equal(rows[0]?.nights, null);
    assert.equal(rows[0]?.rate, 750);
    assert.equal(rows[0]?.amount, 1500);
  });

  it("prints laundry detail on its own line", () => {
    const rows = buildFolioChargeRows([
      {
        id: "l",
        source_type: "laundry",
        description: "Laundry · Same day · Men Shirt × 1",
        total_btn: 165,
        qty: 1,
      },
    ]);
    assert.equal(rows[0]?.particulars, "Same day · Men Shirt × 1");
    assert.equal(rows[0]?.nights, null);
  });
});
