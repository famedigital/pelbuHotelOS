import assert from "node:assert/strict";
import test from "node:test";
import { dueStayOpenOr, isDueToCheckIn } from "./due-check-in";

const today = "2026-10-21";

test("arrival today is due, including day-use", () => {
  assert.equal(
    isDueToCheckIn({
      checkIn: today,
      checkOut: "2026-10-23",
      status: "confirmed",
      today,
    }),
    true,
  );
  assert.equal(
    isDueToCheckIn({
      checkIn: today,
      checkOut: today,
      status: "pending",
      today,
    }),
    true,
  );
  assert.equal(
    isDueToCheckIn({
      checkIn: today,
      checkOut: "2026-10-22",
      status: "held",
      today,
    }),
    true,
  );
});

test("earlier arrival still in house tonight is due", () => {
  assert.equal(
    isDueToCheckIn({
      checkIn: "2026-10-18",
      checkOut: "2026-10-24",
      status: "confirmed",
      today,
    }),
    true,
  );
});

test("stay that ends today, future arrival, and closed statuses are not due", () => {
  assert.equal(
    isDueToCheckIn({
      checkIn: "2026-10-18",
      checkOut: today,
      status: "confirmed",
      today,
    }),
    false,
  );
  assert.equal(
    isDueToCheckIn({
      checkIn: "2026-10-22",
      checkOut: "2026-10-25",
      status: "confirmed",
      today,
    }),
    false,
  );
  assert.equal(
    isDueToCheckIn({
      checkIn: "2026-10-18",
      checkOut: "2026-10-24",
      status: "checked_in",
      today,
    }),
    false,
  );
  assert.equal(
    isDueToCheckIn({
      checkIn: today,
      checkOut: "2026-10-23",
      status: "cancelled",
      today,
    }),
    false,
  );
  assert.equal(
    isDueToCheckIn({
      checkIn: today,
      checkOut: "2026-10-23",
      status: "no_show",
      today,
    }),
    false,
  );
});

test("dueStayOpenOr matches the predicate's date clause", () => {
  assert.equal(
    dueStayOpenOr(today),
    "check_out.gt.2026-10-21,check_in.eq.2026-10-21",
  );
});
