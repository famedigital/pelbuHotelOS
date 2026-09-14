/**
 * Default amenities per floor kind for dual-corridor hotel wizard.
 */

import type {
  BuildingFloor,
  BuildingSpace,
  BuildingSpaceKind,
  CorridorAxis,
} from "@/lib/building/types";
import { floorStructure } from "@/lib/building/geometry";
import { DEFAULT_BUILDING_PARAMS } from "@/lib/building/types";

const LABELS: Record<BuildingSpaceKind, string> = {
  lobby: "Lobby",
  restaurant: "Restaurant",
  cafe: "Bistro",
  bar: "Bar",
  reception: "Reception",
  spa: "Spa",
  steam: "Steam",
  gym: "Gym",
  meeting: "Board meeting",
  stair: "Stairs",
  lift: "Lift",
  service: "Service",
  attic: "Attic",
  other: "Space",
};

export type AmenityProgramChoice = {
  floor_key: string;
  kinds: BuildingSpaceKind[];
};

/** Recommended kinds when floor is first configured. */
export function defaultAmenityKindsForFloor(
  floor: BuildingFloor,
): BuildingSpaceKind[] {
  if (floor.kind === "public") {
    if (floor.key === "1") {
      return ["meeting", "restaurant", "stair", "lift"];
    }
    return ["lobby", "cafe", "spa", "steam", "stair", "lift"];
  }
  if (floor.kind === "attic") {
    return ["attic", "service", "stair", "lift"];
  }
  if (floor.kind === "service") {
    return ["service", "stair", "lift"];
  }
  // guest floors
  return ["stair", "lift"];
}

/**
 * Materialise amenity footprints on a floor given selected kinds.
 * Public floor: large front/back program blocks + cores at ends.
 * Guest floor: stair/lift at west & east (or N/S) of corridor.
 */
export function buildAmenitySpaces(args: {
  floors: BuildingFloor[];
  program: AmenityProgramChoice[];
  corridor_axis: CorridorAxis;
}): BuildingSpace[] {
  const structure = floorStructure(args.corridor_axis, DEFAULT_BUILDING_PARAMS);
  const out: BuildingSpace[] = [];
  let sort = 0;

  for (const floor of args.floors) {
    const chosen =
      args.program.find((p) => p.floor_key === floor.key)?.kinds ??
      defaultAmenityKindsForFloor(floor);

    const cores = chosen.filter((k) => k === "stair" || k === "lift");
    const programKinds = chosen.filter((k) => k !== "stair" && k !== "lift");

    // Service cores at corridor ends
    cores.forEach((kind, i) => {
      const along =
        structure.axis === "ew"
          ? i === 0
            ? structure.alongMin + 2
            : structure.alongMax - 2
          : structure.corridor.center;
      const cross =
        structure.axis === "ew"
          ? structure.corridor.center
          : i === 0
            ? structure.alongMin + 2
            : structure.alongMax - 2;

      out.push({
        floor_key: floor.key,
        kind,
        label: LABELS[kind],
        pos_x: structure.axis === "ew" ? along : cross,
        pos_y: structure.axis === "ew" ? cross : along,
        width_pct: 8,
        depth_pct: Math.max(8, structure.corridor.max - structure.corridor.min),
        facade_side: "internal",
        sort_order: sort++,
      });
    });

    // Large program blocks — alternate front / back wings
    programKinds.forEach((kind, i) => {
      const wing = i % 2 === 0 ? structure.front : structure.back;
      const isLarge =
        kind === "lobby" ||
        kind === "restaurant" ||
        kind === "spa" ||
        kind === "attic";
      const width = isLarge ? 36 : 22;
      const depth = isLarge ? Math.max(14, wing.max - wing.min - 1) : 16;
      // Spread along corridor
      const slots = Math.max(1, programKinds.length);
      const t = (i + 0.5) / slots;
      const along =
        structure.alongMin + t * (structure.alongMax - structure.alongMin);

      out.push({
        floor_key: floor.key,
        kind,
        label: LABELS[kind],
        pos_x: structure.axis === "ew" ? along : wing.center,
        pos_y: structure.axis === "ew" ? wing.center : along,
        width_pct: width,
        depth_pct: depth,
        facade_side: wing.facade,
        sort_order: sort++,
      });
    });
  }

  return out;
}

export function spaceKindLabel(kind: BuildingSpaceKind): string {
  return LABELS[kind] ?? kind;
}

export const PROGRAM_KIND_OPTIONS: BuildingSpaceKind[] = [
  "lobby",
  "reception",
  "restaurant",
  "cafe",
  "bar",
  "spa",
  "steam",
  "gym",
  "meeting",
  "attic",
  "service",
  "stair",
  "lift",
];
