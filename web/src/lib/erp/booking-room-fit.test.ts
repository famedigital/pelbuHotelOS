import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingRoomFit,
  compareReservations,
  matchesRoomFilter,
  parseReservationSort,
  roomsNeeded,
  roomFitBadgeLabel,
} from "./booking-room-fit";

test("roomsNeeded floors at 1", () => {
  assert.equal(roomsNeeded(null), 1);
  assert.equal(roomsNeeded(0), 1);
  assert.equal(roomsNeeded(3), 3);
});

test("closed statuses are n_a", () => {
  assert.equal(
    bookingRoomFit({ status: "cancelled", rooms: 2, assignedCount: 0 }),
    "n_a",
  );
  assert.equal(
    bookingRoomFit({ status: "checked_out", rooms: 1, assignedCount: 1 }),
    "n_a",
  );
  assert.equal(
    bookingRoomFit({ status: "no_show", rooms: 1, assignedCount: 0 }),
    "n_a",
  );
});

test("active none / partial / full", () => {
  assert.equal(
    bookingRoomFit({ status: "confirmed", rooms: 2, assignedCount: 0 }),
    "none",
  );
  assert.equal(
    bookingRoomFit({ status: "held", rooms: 2, assignedCount: 1 }),
    "partial",
  );
  assert.equal(
    bookingRoomFit({ status: "checked_in", rooms: 2, assignedCount: 2 }),
    "full",
  );
  assert.equal(
    bookingRoomFit({ status: "pending", rooms: 1, assignedCount: 1 }),
    "full",
  );
});

test("matchesRoomFilter needs_room includes none and partial", () => {
  assert.equal(matchesRoomFilter("none", "needs_room"), true);
  assert.equal(matchesRoomFilter("partial", "needs_room"), true);
  assert.equal(matchesRoomFilter("full", "needs_room"), false);
  assert.equal(matchesRoomFilter("n_a", "needs_room"), false);
  assert.equal(matchesRoomFilter("full", "assigned"), true);
  assert.equal(matchesRoomFilter("partial", "partial"), true);
  assert.equal(matchesRoomFilter("none", "all"), true);
});

test("needs_room_first sorts shortfalls first", () => {
  const rows = [
    { check_in: "2026-08-10", contact_name: "B", room_fit: "full" as const },
    { check_in: "2026-08-12", contact_name: "A", room_fit: "none" as const },
    {
      check_in: "2026-08-11",
      contact_name: "C",
      room_fit: "partial" as const,
    },
  ];
  rows.sort((a, b) => compareReservations(a, b, "needs_room_first"));
  assert.equal(rows[0]?.room_fit, "none");
  assert.equal(rows[1]?.room_fit, "partial");
  assert.equal(rows[2]?.room_fit, "full");
});

test("parseReservationSort defaults", () => {
  assert.equal(parseReservationSort(undefined), "check_in_desc");
  assert.equal(parseReservationSort("check_in_asc"), "check_in_asc");
  assert.equal(parseReservationSort("bogus"), "check_in_desc");
});

test("roomFitBadgeLabel copy", () => {
  assert.equal(
    roomFitBadgeLabel("none", 0, 2, "").label,
    "No room",
  );
  assert.equal(
    roomFitBadgeLabel("partial", 1, 2, "201").label,
    "Partial (1/2)",
  );
  assert.equal(roomFitBadgeLabel("full", 2, 2, "201, 202").label, "201, 202");
});
