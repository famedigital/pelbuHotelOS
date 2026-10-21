import assert from "node:assert/strict";
import test from "node:test";
import {
  foActionFromDirtyRoom,
  foActionFromStay,
  recommendFoStayJob,
  sortFoNextActions,
  type FoNextAction,
  type FoStayFacts,
} from "./fo-next-action";

const biz = "2026-08-18";

function stay(partial: Partial<FoStayFacts>): FoStayFacts {
  return {
    bookingId: "b1",
    guestName: "Tashi",
    roomLabel: "101",
    status: "confirmed",
    checkIn: biz,
    checkOut: "2026-08-20",
    businessDate: biz,
    balanceBtn: 0,
    hasRoomAssigned: true,
    ...partial,
  };
}

test("arrival today not CI → check_in", () => {
  assert.equal(recommendFoStayJob(stay({ status: "confirmed" })), "check_in");
  assert.equal(recommendFoStayJob(stay({ status: "pending" })), "check_in");
});

test("arrival before today with nights still ahead → check_in", () => {
  assert.equal(
    recommendFoStayJob(
      stay({
        status: "confirmed",
        checkIn: "2026-08-16",
        checkOut: "2026-08-20",
      }),
    ),
    "check_in",
  );
  const late = foActionFromStay(
    stay({
      status: "confirmed",
      checkIn: "2026-08-16",
      checkOut: "2026-08-20",
    }),
    "check_in",
  );
  assert.match(late.why, /2026-08-16/);
});

test("arrival whose stay already ended today is not a check-in", () => {
  assert.equal(
    recommendFoStayJob(
      stay({
        status: "confirmed",
        checkIn: "2026-08-14",
        checkOut: biz,
      }),
    ),
    null,
  );
});

test("in-house departing with due → collect", () => {
  assert.equal(
    recommendFoStayJob(
      stay({
        status: "checked_in",
        checkIn: "2026-08-16",
        checkOut: biz,
        balanceBtn: 2400,
      }),
    ),
    "collect",
  );
});

test("in-house departing clear → checkout", () => {
  assert.equal(
    recommendFoStayJob(
      stay({
        status: "checked_in",
        checkIn: "2026-08-16",
        checkOut: biz,
        balanceBtn: 0,
      }),
    ),
    "checkout",
  );
});

test("hold with incomplete deposit → confirm", () => {
  assert.equal(
    recommendFoStayJob(
      stay({
        status: "held",
        checkIn: "2026-08-22",
        tokenRequiredBtn: 5000,
        tokenReceivedBtn: 0,
        depositDueOn: biz,
      }),
    ),
    "confirm",
  );
});

test("checked out / cancelled ignored", () => {
  assert.equal(
    recommendFoStayJob(stay({ status: "checked_out" })),
    null,
  );
  assert.equal(recommendFoStayJob(stay({ status: "cancelled" })), null);
});

test("vacant dirty room → housekeeping; occupied skipped", () => {
  const vacant = foActionFromDirtyRoom({
    roomUnitId: "u1",
    roomLabel: "204",
    occupied: false,
  });
  assert.equal(vacant?.kind, "housekeeping");
  assert.equal(
    foActionFromDirtyRoom({
      roomUnitId: "u1",
      roomLabel: "204",
      occupied: true,
    }),
    null,
  );
});

test("check_in action includes arrival playbook + Assign CTA when unassigned", () => {
  const action = foActionFromStay(
    stay({ hasRoomAssigned: false, roomLabel: null }),
    "check_in",
  );
  assert.equal(action.cta, "Assign → CI");
  assert.ok(action.playbook?.length);
  assert.equal(action.playbook?.find((s) => s.id === "assign")?.current, true);
});

test("sortFoNextActions ranks CI before collect before HK", () => {
  const rows: FoNextAction[] = [
    {
      id: "hk",
      kind: "housekeeping",
      rank: 4,
      guestName: "204",
      roomLabel: "204",
      why: "Dirty",
      cta: "Housekeeping",
      stayHubStep: null,
      href: "/erp/housekeeping",
      bookingId: null,
      roomUnitId: "u1",
    },
    {
      id: "ci",
      kind: "check_in",
      rank: 1,
      guestName: "A",
      roomLabel: "101",
      why: "Arrival",
      cta: "Check-in",
      stayHubStep: "check_in",
      href: "/erp/today",
      bookingId: "b1",
      roomUnitId: null,
    },
  ];
  assert.equal(sortFoNextActions(rows)[0]?.kind, "check_in");
});
