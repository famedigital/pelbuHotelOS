import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
