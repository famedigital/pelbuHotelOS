import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookingCommitsInventory,
  staysOverlap,
  sumBookedRoomsByType,
  type InventoryBookingRow,
} from "./inventory-availability";

test("staysOverlap is false for adjacent half-open stays", () => {
  assert.equal(
    staysOverlap("2026-07-01", "2026-07-03", "2026-07-03", "2026-07-05"),
    false,
  );
  assert.equal(
    staysOverlap("2026-07-01", "2026-07-04", "2026-07-03", "2026-07-05"),
    true,
  );
  assert.equal(
    staysOverlap("2026-07-01", "2026-07-02", "2026-07-02", "2026-07-03"),
    false,
  );
});

test("confirmed and checked-in bookings always commit inventory", () => {
  const now = new Date("2026-07-29T15:00:00Z");
  assert.equal(
    bookingCommitsInventory({ status: "confirmed", hold_expires_at: null }, now),
    true,
  );
  assert.equal(
    bookingCommitsInventory(
      { status: "checked_in", hold_expires_at: null },
      now,
    ),
    true,
  );
});

test("held booking commits only while its TTL is in the future", () => {
  const now = new Date("2026-07-29T15:00:00Z");
  assert.equal(
    bookingCommitsInventory(
      { status: "held", hold_expires_at: "2026-07-29T16:00:00Z" },
      now,
    ),
    true,
  );
  assert.equal(
    bookingCommitsInventory(
      { status: "held", hold_expires_at: "2026-07-29T14:00:00Z" },
      now,
    ),
    false,
  );
  assert.equal(
    bookingCommitsInventory({ status: "held", hold_expires_at: null }, now),
    false,
  );
});

test("expired, cancelled, pending, no_show never commit", () => {
  const now = new Date("2026-07-29T15:00:00Z");
  for (const status of ["expired", "cancelled", "pending", "no_show"]) {
    assert.equal(
      bookingCommitsInventory(
        { status, hold_expires_at: "2099-01-01T00:00:00Z" },
        now,
      ),
      false,
    );
  }
});

test("sumBookedRoomsByType ignores expired holds and keeps live ones", () => {
  const now = new Date("2026-07-29T15:00:00Z");
  const bookings: InventoryBookingRow[] = [
    {
      id: "1",
      status: "confirmed",
      check_in: "2026-08-01",
      check_out: "2026-08-03",
      hold_expires_at: null,
      booking_rooms: [{ qty: 2, room_type_id: "deluxe" }],
    },
    {
      id: "2",
      status: "held",
      check_in: "2026-08-01",
      check_out: "2026-08-02",
      hold_expires_at: "2026-07-29T14:00:00Z", // expired — should drop
      booking_rooms: [{ qty: 3, room_type_id: "deluxe" }],
    },
    {
      id: "3",
      status: "held",
      check_in: "2026-08-01",
      check_out: "2026-08-02",
      hold_expires_at: "2026-07-29T16:00:00Z", // still live — counts
      booking_rooms: [{ qty: 1, room_type_id: "deluxe" }],
    },
    {
      id: "4",
      status: "cancelled",
      check_in: "2026-08-01",
      check_out: "2026-08-02",
      hold_expires_at: null,
      booking_rooms: [{ qty: 5, room_type_id: "deluxe" }],
    },
  ];

  const used = sumBookedRoomsByType(bookings, now);
  // 2 (confirmed) + 1 (live held) = 3. Expired held + cancelled are dropped.
  assert.equal(used.get("deluxe"), 3);
});
