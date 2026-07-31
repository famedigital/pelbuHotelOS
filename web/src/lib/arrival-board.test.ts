import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boardActionHref,
  boardActionLabel,
  computeArrivalBadges,
} from "./arrival-board";

test("unassigned arrival shows danger badge", () => {
  const badges = computeArrivalBadges({
    status: "confirmed",
    guest_origin: "international",
    guide_number: null,
    payment_mode: "cash",
    token_required_btn: 0,
    token_received_btn: 0,
    rooms: 2,
    assigned_count: 0,
    room_labels: [],
    dirty_or_ooo: false,
    has_unready_guest_room: false,
  });
  assert.ok(badges.some((b) => b.key === "unassigned"));
  assert.ok(badges.some((b) => b.key === "guide"));
  assert.ok(badges.some((b) => b.key === "sdf"));
});

test("deposit due when token not received", () => {
  const badges = computeArrivalBadges({
    status: "pending",
    guest_origin: "local",
    guide_number: null,
    payment_mode: "prepaid",
    token_required_btn: 5000,
    token_received_btn: 0,
    rooms: 1,
    assigned_count: 1,
    room_labels: ["101"],
    dirty_or_ooo: false,
    has_unready_guest_room: false,
  });
  assert.ok(badges.some((b) => b.key === "deposit"));
  assert.ok(!badges.some((b) => b.key === "guide"));
});

test("checked-in shows folio balance badge", () => {
  const badges = computeArrivalBadges({
    status: "checked_in",
    guest_origin: "international",
    guide_number: "G1",
    payment_mode: "cash",
    token_required_btn: null,
    token_received_btn: null,
    rooms: 1,
    assigned_count: 1,
    room_labels: ["205"],
    dirty_or_ooo: false,
    has_unready_guest_room: false,
    folio_balance_btn: 1200,
  });
  assert.ok(badges.some((b) => b.key === "balance"));
  assert.equal(boardActionLabel("checked_in"), "Check out");
  assert.equal(boardActionLabel("confirmed"), "Check in");
});

test("only check-in-actionable statuses route to the check-in screen", () => {
  const id = "c2305a9d-49e4-45fb-ba2b-9d2777dea0a2";
  for (const status of ["pending", "confirmed"]) {
    assert.equal(boardActionHref(status, id), `/erp/check-in?id=${id}`);
  }
  for (const status of ["held", "checked_out", "cancelled", "no_show", null]) {
    assert.equal(boardActionHref(status, id), `/erp/bookings/${id}`);
  }
});

test("in-house stays route to the settlement screen", () => {
  const id = "c2305a9d-49e4-45fb-ba2b-9d2777dea0a2";
  assert.equal(boardActionHref("checked_in", id), `/erp/check-out?id=${id}`);
});

test("held bookings advertise the token action, closed ones just view", () => {
  assert.equal(boardActionLabel("held"), "Confirm token");
  assert.equal(boardActionLabel("checked_out"), "View");
  assert.equal(boardActionLabel("cancelled"), "View");
});
