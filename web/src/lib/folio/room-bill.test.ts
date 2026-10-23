import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRoomBillRows, roomBillTotal } from "./room-bill";

describe("room bill rows", () => {
  it("bills each room category as rooms × nights × rate", () => {
    const rows = buildRoomBillRows({
      checkIn: "2026-10-22",
      checkOut: "2026-10-24",
      mealPlanCode: "MAP",
      adults: 5,
      children: 0,
      nationalities: ["Canada", "Deferred"],
      guideNumber: "17856841",
      lines: [
        {
          roomTypeName: "Double",
          roomNumbers: ["207", "307"],
          rooms: 2,
          nightlyRateBtn: 5143,
        },
        {
          roomTypeName: "Deluxe Twin",
          roomNumbers: ["403"],
          rooms: 1,
          nightlyRateBtn: 3524,
          occupancy: "single",
        },
      ],
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.rooms, 2);
    assert.equal(rows[0]?.nights, 2);
    assert.equal(rows[0]?.rate, 5143);
    assert.equal(rows[0]?.amount, 20572);
    assert.match(rows[0]?.description ?? "", /Rm 207, 307/);
    assert.match(rows[0]?.description ?? "", /MAP/);
    assert.match(rows[0]?.description ?? "", /5 pax/);
    assert.match(rows[0]?.description ?? "", /Canada/);
    assert.match(rows[0]?.description ?? "", /Guide 17856841/);
    assert.doesNotMatch(rows[0]?.description ?? "", /Deferred/);
    assert.equal(rows[1]?.amount, 7048);
    assert.match(rows[1]?.description ?? "", /^Single · Deluxe Twin/);
    assert.equal(roomBillTotal(rows), 27620);
    assert.equal(rows[0]?.checkInLabel, "22 Oct 2026");
    assert.equal(rows[0]?.checkOutLabel, "24 Oct 2026");
  });

  it("prints a different meal on each night", () => {
    const rows = buildRoomBillRows({
      checkIn: "2026-10-22",
      checkOut: "2026-10-24",
      mealPlanCode: "BB",
      adults: 5,
      nightMeals: [
        { date: "2026-10-22", mealPlanCode: "MAP" },
        { date: "2026-10-23", mealPlanCode: "CP" },
      ],
      lines: [
        {
          roomTypeName: "Deluxe Twin",
          roomNumbers: ["406"],
          rooms: 1,
          nightlyRateBtn: 5143,
          occupancy: "double",
        },
      ],
    });
    assert.match(rows[0]?.description ?? "", /22 Oct MAP/);
    assert.match(rows[0]?.description ?? "", /23 Oct CP/);
    assert.doesNotMatch(rows[0]?.description ?? "", /BB/);
  });
});
