import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countFollowUp,
  filterReservations,
  isCheckoutUnpaid,
  reservationsToCsv,
  sumUnpaidNow,
  type ResStayLike,
} from "./reservations-list";

function stay(partial: Partial<ResStayLike> & Pick<ResStayLike, "id">): ResStayLike {
  return {
    guestName: "Guest",
    confirmationNo: "PS-1",
    roomNumber: "101",
    roomId: "r1",
    groupName: null,
    guestPhone: "",
    agencyName: null,
    source: "direct",
    status: "checked_in",
    checkIn: "2026-11-10",
    checkOut: "2026-11-12",
    ...partial,
  };
}

describe("reservations-list", () => {
  it("flags checkout unpaid and counts follow-up", () => {
    const s = stay({ id: "a", status: "checked_out" });
    assert.equal(isCheckoutUnpaid(s, 1200), true);
    assert.equal(isCheckoutUnpaid(s, 0), false);
    assert.equal(
      countFollowUp([s, stay({ id: "b", status: "checked_in" })], { a: 100, b: 50 }),
      1,
    );
  });

  it("filters balance due and sorts by unpaid", () => {
    const stays = [
      stay({ id: "1", guestName: "A", confirmationNo: "PS-1" }),
      stay({ id: "2", guestName: "B", confirmationNo: "PS-2" }),
    ];
    const out = filterReservations({
      stays,
      balances: { "1": 0, "2": 500 },
      status: "all",
      source: "all",
      agent: "all",
      query: "",
      fromDate: "",
      toDate: "",
      moneyChip: "balance_due",
      sort: "balance",
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, "2");
  });

  it("sums unpaid now for live stays only", () => {
    const stays = [
      stay({ id: "1", status: "checked_in" }),
      stay({ id: "2", status: "checked_out" }),
      stay({ id: "3", status: "confirmed" }),
    ];
    assert.equal(sumUnpaidNow(stays, { "1": 100, "2": 999, "3": 50 }), 150);
  });

  it("exports csv with balance columns", () => {
    const csv = reservationsToCsv(
      [stay({ id: "1", agencyName: "Soultrips", source: "agent" })],
      { "1": 200 },
      { "1": 800 },
    );
    assert.match(csv, /Conf,Guest,Status/);
    assert.match(csv, /Soultrips/);
    assert.match(csv, /200\.00/);
  });
});
