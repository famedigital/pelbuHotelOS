import assert from "node:assert/strict";
import { test } from "node:test";
import {
  nightsFromShift,
  planInHouseRoomShift,
  upgradeBalanceChange,
  upgradeNeedsManagerPin,
} from "./room-shift";

test("guest who arrived today moves the whole stay", () => {
  const plan = planInHouseRoomShift({
    fromDate: "2026-10-25",
    toDate: "2026-10-28",
    businessDate: "2026-10-25",
  });
  assert.deepEqual(plan, {
    ok: true,
    mode: "full",
    shiftDate: "2026-10-25",
  });
});

test("guest already in house splits at the business date", () => {
  const plan = planInHouseRoomShift({
    fromDate: "2026-10-22",
    toDate: "2026-10-28",
    businessDate: "2026-10-25",
  });
  assert.deepEqual(plan, {
    ok: true,
    mode: "split",
    shiftDate: "2026-10-25",
  });
});

test("departure day has no night left to move", () => {
  const plan = planInHouseRoomShift({
    fromDate: "2026-10-22",
    toDate: "2026-10-25",
    businessDate: "2026-10-25",
  });
  assert.equal(plan.ok, false);
});

test("upgrade top-up is the gap times nights still left", () => {
  assert.deepEqual(
    upgradeBalanceChange({
      quotedGuestNightly: 4800,
      newGuestNightly: 6500,
      nights: 3,
    }),
    { nightlyGapBtn: 1700, balanceChangeBtn: 5100 },
  );
});

test("a cheaper room is a credit, not a top-up", () => {
  const change = upgradeBalanceChange({
    quotedGuestNightly: 6500,
    newGuestNightly: 4800,
    nights: 2,
  });
  assert.equal(change.balanceChangeBtn, -3400);
  assert.equal(nightsFromShift("2026-10-25", "2026-10-28"), 3);
});

test("manager pin when the upgrade is waived or undercharged", () => {
  assert.equal(
    upgradeNeedsManagerPin({
      choice: "complimentary",
      suggestedBalanceBtn: 5100,
      topUpBalanceBtn: 0,
    }),
    true,
  );
  assert.equal(
    upgradeNeedsManagerPin({
      choice: "top_up",
      suggestedBalanceBtn: 5100,
      topUpBalanceBtn: 5100,
    }),
    false,
  );
  assert.equal(
    upgradeNeedsManagerPin({
      choice: "top_up",
      suggestedBalanceBtn: 5100,
      topUpBalanceBtn: 2000,
    }),
    true,
  );
  assert.equal(
    upgradeNeedsManagerPin({
      choice: "complimentary",
      suggestedBalanceBtn: 0,
      topUpBalanceBtn: 0,
    }),
    false,
  );
});

test("a stay that has not started yet moves from arrival", () => {
  const plan = planInHouseRoomShift({
    fromDate: "2026-10-27",
    toDate: "2026-10-30",
    businessDate: "2026-10-25",
  });
  assert.deepEqual(plan, {
    ok: true,
    mode: "full",
    shiftDate: "2026-10-27",
  });
});
