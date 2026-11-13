import type { Room, Stay } from "./front-office-store";

export type DeskRoomInventoryItem = {
  room: Room;
  stay?: Stay;
};

function activeStayForRoom(
  roomId: string,
  stays: Stay[],
  today: string,
): Stay | undefined {
  return (
    stays.find(
      (s) =>
        s.roomId === roomId &&
        !["cancelled", "no_show", "checked_out"].includes(s.status) &&
        s.checkIn <= today &&
        today < s.checkOut,
    ) ??
    stays.find(
      (s) =>
        s.roomId === roomId &&
        ["confirmed", "held"].includes(s.status) &&
        s.checkIn === today,
    )
  );
}

function hkReadyRank(room: Room): number {
  if (room.hkStatus === "inspected" || room.hkStatus === "clean") return 0;
  if (room.hkStatus === "dirty") return 1;
  return 2;
}

/** Vacant sellable rooms (not OOO, not occupied / due CI). */
export function listEmptyRooms(
  rooms: Room[],
  stays: Stay[],
  today: string,
): DeskRoomInventoryItem[] {
  const occupiedRoomIds = new Set<string>();
  for (const room of rooms) {
    const stay = activeStayForRoom(room.id, stays, today);
    if (stay) occupiedRoomIds.add(room.id);
  }

  return rooms
    .filter((room) => !occupiedRoomIds.has(room.id) && room.hkStatus !== "ooo")
    .map((room) => ({ room }))
    .sort((a, b) => {
      const d = hkReadyRank(a.room) - hkReadyRank(b.room);
      return d !== 0 ? d : a.room.number.localeCompare(b.room.number);
    });
}

export function emptyRoomReadyCount(items: DeskRoomInventoryItem[]): number {
  return items.filter(
    (i) => i.room.hkStatus === "clean" || i.room.hkStatus === "inspected",
  ).length;
}

export function emptyRoomDirtyCount(items: DeskRoomInventoryItem[]): number {
  return items.filter((i) => i.room.hkStatus === "dirty").length;
}
