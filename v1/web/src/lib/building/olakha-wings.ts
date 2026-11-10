/**
 * Olakha guest-floor split: floors 2–4 are 4 front + 3 back; floor 5 is 3 + 3.
 * Door numbers stay as eZee; this only groups them for the public facade.
 */

export type WingRoom = {
  id: string;
  label: string;
  floor_label: string | null;
  room_type_code?: string;
};

export function frontCountForOlakhaFloor(floorKey: string): number {
  return floorKey === "5" ? 3 : 4;
}

export function splitOlakhaFloorWings<T extends WingRoom>(
  units: T[],
  floorKey: string,
): { front: T[]; back: T[] } {
  const rooms = units
    .filter((u) => (u.floor_label ?? "").trim() === floorKey)
    .slice()
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  const frontN = Math.min(frontCountForOlakhaFloor(floorKey), rooms.length);
  return {
    front: rooms.slice(0, frontN),
    back: rooms.slice(frontN),
  };
}
