import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyRoomDirtyCount,
  emptyRoomReadyCount,
  listEmptyRooms,
} from "./desk-room-inventory";
import type { Room, Stay } from "./front-office-store";

function room(
  partial: Partial<Room> & Pick<Room, "id" | "number" | "hkStatus">,
): Room {
  return {
    floor: 1,
    typeCode: "deluxe_queen",
    typeName: "Deluxe",
    ...partial,
  };
}

function stay(
  partial: Partial<Stay> & Pick<Stay, "id" | "roomId" | "status" | "checkIn" | "checkOut">,
): Stay {
  return {
    confirmationNo: "X",
    guestName: "Guest",
    guestPhone: "",
    guestEmail: "",
    nationality: "BT",
    passportOrCid: "",
    vip: false,
    roomNumber: null,
    typeCode: "deluxe_queen",
    mealPlan: "BB",
    source: "direct",
    nightlyNet: 1000,
    groupId: null,
    groupName: null,
    agencyName: null,
    folioLines: [],
    audit: [],
    holdExpiresAt: null,
    depositPaid: 0,
    ...partial,
  };
}

describe("listEmptyRooms", () => {
  it("excludes occupied, due check-in, and OOO", () => {
    const rooms = [
      room({ id: "r1", number: "101", hkStatus: "clean" }),
      room({ id: "r2", number: "102", hkStatus: "dirty" }),
      room({ id: "r3", number: "103", hkStatus: "clean" }),
      room({ id: "r4", number: "104", hkStatus: "ooo" }),
    ];
    const stays = [
      stay({
        id: "s1",
        roomId: "r1",
        status: "checked_in",
        checkIn: "2026-11-12",
        checkOut: "2026-11-14",
      }),
      stay({
        id: "s2",
        roomId: "r3",
        status: "confirmed",
        checkIn: "2026-11-13",
        checkOut: "2026-11-14",
      }),
    ];
    const empty = listEmptyRooms(rooms, stays, "2026-11-13");
    assert.deepEqual(
      empty.map((e) => e.room.number),
      ["102"],
    );
    assert.equal(emptyRoomDirtyCount(empty), 1);
    assert.equal(emptyRoomReadyCount(empty), 0);
  });

  it("sorts clean before dirty", () => {
    const rooms = [
      room({ id: "r1", number: "201", hkStatus: "dirty" }),
      room({ id: "r2", number: "202", hkStatus: "inspected" }),
    ];
    const empty = listEmptyRooms(rooms, [], "2026-11-13");
    assert.deepEqual(
      empty.map((e) => e.room.number),
      ["202", "201"],
    );
    assert.equal(emptyRoomReadyCount(empty), 1);
  });
});
