/**
 * Dual-corridor room packer: front wing + back wing per guest floor.
 */

import { floorStructure, facadeWingLabel } from "@/lib/building/geometry";
import type {
  BuildingFloor,
  BuildingLayoutParams,
  CorridorAxis,
  FloorWingSummary,
  RoomPackInput,
  RoomPackPlacement,
} from "@/lib/building/types";
import {
  DEFAULT_BUILDING_PARAMS,
  inferFloorKey,
} from "@/lib/building/types";

function sortRooms(a: RoomPackInput, b: RoomPackInput): number {
  return a.label.localeCompare(b.label, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Pack sellable (+ optional comp) rooms onto dual wings.
 * front / back alternate odd slots for balance when even counts.
 */
export function packDualCorridor(args: {
  rooms: RoomPackInput[];
  floors: BuildingFloor[];
  corridor_axis: CorridorAxis;
  params?: BuildingLayoutParams;
  includeComp?: boolean;
}): {
  placements: RoomPackPlacement[];
  summaries: FloorWingSummary[];
  unmatched: RoomPackInput[];
} {
  const params = args.params ?? DEFAULT_BUILDING_PARAMS;
  const structure = floorStructure(args.corridor_axis, params);
  const guestFloorKeys = new Set(
    args.floors.filter((f) => f.kind === "guest").map((f) => f.key),
  );
  const floorByKey = new Map(args.floors.map((f) => [f.key, f]));

  const byFloor = new Map<string, RoomPackInput[]>();
  const unmatched: RoomPackInput[] = [];

  for (const room of args.rooms) {
    if (room.is_comp && !args.includeComp) continue;
    const key = inferFloorKey(room.label, room.floor_label);
    if (!key || !guestFloorKeys.has(key)) {
      // Try map public digits onto closest guest floor key if only one set
      if (key && floorByKey.has(key) && floorByKey.get(key)!.kind !== "guest") {
        unmatched.push(room);
        continue;
      }
      if (!key) {
        unmatched.push(room);
        continue;
      }
      // Allow packing onto any declared floor if not strictly guest-only
      if (!floorByKey.has(key)) {
        unmatched.push(room);
        continue;
      }
    }
    const list = byFloor.get(key!) ?? [];
    list.push(room);
    byFloor.set(key!, list);
  }

  // Rooms keyed to non-guest floors → unmatched unless we have guest floor match
  for (const [key, list] of [...byFloor.entries()]) {
    if (!guestFloorKeys.has(key)) {
      unmatched.push(...list);
      byFloor.delete(key);
    }
  }

  const placements: RoomPackPlacement[] = [];
  const summaries: FloorWingSummary[] = [];

  for (const floor of args.floors) {
    const rooms = (byFloor.get(floor.key) ?? []).slice().sort(sortRooms);
    const front: RoomPackInput[] = [];
    const back: RoomPackInput[] = [];

    // Split: even index → front, odd → back (balances wings)
    rooms.forEach((r, i) => {
      if (i % 2 === 0) front.push(r);
      else back.push(r);
    });

    const placeWing = (
      wingRooms: RoomPackInput[],
      wing: "front" | "back",
    ) => {
      const band = wing === "front" ? structure.front : structure.back;
      const n = wingRooms.length;
      if (n === 0) return;
      const span = structure.alongMax - structure.alongMin;
      // Compress if over soft max
      const effectiveMax = Math.max(params.maxRoomsPerWingSide, n);
      void effectiveMax;
      wingRooms.forEach((room, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const along = structure.alongMin + t * span;
        const pos_x =
          structure.axis === "ew" ? along : band.center;
        const pos_y =
          structure.axis === "ew" ? band.center : along;
        placements.push({
          id: room.id,
          floor_key: floor.key,
          pos_x: Math.round(pos_x * 100) / 100,
          pos_y: Math.round(pos_y * 100) / 100,
          facade_side: band.facade,
          wing,
          slot_index: i,
        });
      });
    };

    placeWing(front, "front");
    placeWing(back, "back");

    summaries.push({
      floor_key: floor.key,
      floor_label: floor.label,
      kind: floor.kind,
      front: {
        facade: structure.front.facade,
        count: front.length,
        labels: front.map((r) => r.label),
      },
      back: {
        facade: structure.back.facade,
        count: back.length,
        labels: back.map((r) => r.label),
      },
      unmatched: [],
      amenities: [],
    });
  }

  // Unmatched rollup for UI cards
  if (unmatched.length) {
    summaries.push({
      floor_key: "_unmatched",
      floor_label: "Unmatched rooms",
      kind: "service",
      front: { facade: "—", count: 0, labels: [] },
      back: { facade: "—", count: 0, labels: [] },
      unmatched: unmatched.map((r) => r.label),
      amenities: [],
    });
  }

  return { placements, summaries, unmatched };
}

export function floorCardBlurb(summary: FloorWingSummary): string {
  if (summary.floor_key === "_unmatched") {
    return summary.unmatched.length
      ? `Not on a guest floor: ${summary.unmatched.join(", ")}`
      : "All rooms assigned";
  }
  const f = facadeWingLabel(
    summary.front.facade,
    "front",
  );
  const b = facadeWingLabel(summary.back.facade, "back");
  return `${f}: ${summary.front.count} · ${b}: ${summary.back.count}`;
}

/** Suggest floors for Pelbu-style building (G + N guest + attic). */
export function suggestFloors(args: {
  includeGround: boolean;
  guestFloorCount: number;
  includeAttic: boolean;
  /** Optional guest keys e.g. ["2","3","4","5"] */
  guestKeys?: string[];
}): BuildingFloor[] {
  const floors: BuildingFloor[] = [];
  if (args.includeGround) {
    floors.push({ key: "G", label: "Ground", kind: "public" });
  }
  const keys =
    args.guestKeys ??
    Array.from({ length: Math.max(1, args.guestFloorCount) }, (_, i) =>
      String(i + 2),
    );
  for (const key of keys.slice(0, Math.max(1, args.guestFloorCount))) {
    floors.push({
      key,
      label: `Floor ${key}`,
      kind: "guest",
    });
  }
  if (args.includeAttic) {
    floors.push({ key: "A", label: "Attic", kind: "attic" });
  }
  return floors;
}
