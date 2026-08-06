/**
 * Shared geometry for dual-corridor 2D canvas + CSS 3D massing.
 * Percent canvas: origin top-left, x right, y down (same as Plan).
 */

import type {
  BuildingLayoutParams,
  BuildingSpace,
  CorridorAxis,
} from "@/lib/building/types";
import { DEFAULT_BUILDING_PARAMS } from "@/lib/building/types";

export type WingBand = {
  /** Centerline position on cross-axis (percent). */
  center: number;
  min: number;
  max: number;
  facade: "north" | "south" | "east" | "west";
  wing: "front" | "back";
};

export type CorridorBand = {
  center: number;
  min: number;
  max: number;
};

export type FloorStructure = {
  margin: number;
  corridor: CorridorBand;
  front: WingBand;
  back: WingBand;
  axis: CorridorAxis;
  /** Along-corridor usable range [min, max] for room slots. */
  alongMin: number;
  alongMax: number;
};

/** Compute wing + corridor bands for a dual-corridor floor plan. */
export function floorStructure(
  axis: CorridorAxis,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): FloorStructure {
  const m = Math.max(2, Math.min(20, params.marginPct));
  const corridorW = Math.max(8, Math.min(30, params.corridorWidthPct));
  const wingD = Math.max(12, Math.min(40, params.wingDepthPct));
  const mid = 50;
  const halfC = corridorW / 2;

  const corridor: CorridorBand = {
    center: mid,
    min: mid - halfC,
    max: mid + halfC,
  };

  // Front = lower numbers / "street" side; back = opposite wing
  if (axis === "ew") {
    // Long corridor runs west→east (along X); wings north/south (Y)
    const frontCenter = corridor.min - wingD / 2;
    const backCenter = corridor.max + wingD / 2;
    return {
      margin: m,
      corridor,
      front: {
        center: frontCenter,
        min: Math.max(m, corridor.min - wingD),
        max: corridor.min,
        facade: "north",
        wing: "front",
      },
      back: {
        center: backCenter,
        min: corridor.max,
        max: Math.min(100 - m, corridor.max + wingD),
        facade: "south",
        wing: "back",
      },
      axis,
      alongMin: m + 4,
      alongMax: 100 - m - 4,
    };
  }

  // ns: corridor runs north→south (along Y); wings east/west (X)
  const frontCenter = corridor.min - wingD / 2;
  const backCenter = corridor.max + wingD / 2;
  return {
    margin: m,
    corridor,
    front: {
      center: frontCenter,
      min: Math.max(m, corridor.min - wingD),
      max: corridor.min,
      facade: "west",
      wing: "front",
    },
    back: {
      center: backCenter,
      min: corridor.max,
      max: Math.min(100 - m, corridor.max + wingD),
      facade: "east",
      wing: "back",
    },
    axis,
    alongMin: m + 4,
    alongMax: 100 - m - 4,
  };
}

/** CSS rect styles for corridor / wing bands (2D plan). */
export function structureBandStyle(
  structure: FloorStructure,
  band: "corridor" | "front" | "back",
): { left: string; top: string; width: string; height: string } {
  const m = structure.margin;
  if (structure.axis === "ew") {
    const row =
      band === "corridor"
        ? structure.corridor
        : band === "front"
          ? structure.front
          : structure.back;
    return {
      left: `${m}%`,
      top: `${row.min}%`,
      width: `${100 - 2 * m}%`,
      height: `${Math.max(1, row.max - row.min)}%`,
    };
  }
  const col =
    band === "corridor"
      ? structure.corridor
      : band === "front"
        ? structure.front
        : structure.back;
  return {
    left: `${col.min}%`,
    top: `${m}%`,
    width: `${Math.max(1, col.max - col.min)}%`,
    height: `${100 - 2 * m}%`,
  };
}

/**
 * Snap room drop position to nearest wing centerline and return facade/wing.
 */
export function snapToWing(
  x: number,
  y: number,
  structure: FloorStructure,
): {
  pos_x: number;
  pos_y: number;
  facade_side: WingBand["facade"];
  wing: "front" | "back";
} {
  const along =
    structure.axis === "ew"
      ? clamp(x, structure.alongMin, structure.alongMax)
      : clamp(y, structure.alongMin, structure.alongMax);
  const cross = structure.axis === "ew" ? y : x;

  const dFront = Math.abs(cross - structure.front.center);
  const dBack = Math.abs(cross - structure.back.center);
  const wing = dFront <= dBack ? structure.front : structure.back;

  if (structure.axis === "ew") {
    return {
      pos_x: along,
      pos_y: wing.center,
      facade_side: wing.facade,
      wing: wing.wing,
    };
  }
  return {
    pos_x: wing.center,
    pos_y: along,
    facade_side: wing.facade,
    wing: wing.wing,
  };
}

/** Percent plan position → CSS 3D world (slab-centered). */
export function planToWorld3d(
  posX: number,
  posY: number,
  floorTier: number,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): { x: number; y: number; z: number } {
  const along = ((posX - 50) / 50) * (params.slabW * 0.42);
  const depth = ((posY - 50) / 50) * (params.slabD * 0.38);
  return {
    x: along,
    y: floorTier * params.floorHeight,
    z: depth,
  };
}

/** World size for amenity mass from width/depth %. */
export function amenityFootprint3d(
  space: Pick<BuildingSpace, "width_pct" | "depth_pct" | "kind">,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): { w: number; d: number; h: number } {
  const w = Math.max(28, (space.width_pct / 100) * params.slabW * 0.85);
  const d = Math.max(24, (space.depth_pct / 100) * params.slabD * 0.85);
  const hByKind: Record<string, number> = {
    lobby: 42,
    restaurant: 32,
    cafe: 28,
    bar: 28,
    reception: 30,
    spa: 30,
    gym: 30,
    meeting: 30,
    stair: 22,
    lift: 22,
    service: 24,
    attic: 20,
    other: 28,
  };
  return { w, d, h: hByKind[space.kind] ?? 28 };
}

export function facadeWingLabel(
  facade: string,
  wing: "front" | "back",
): string {
  const side =
    facade === "north"
      ? "North"
      : facade === "south"
        ? "South"
        : facade === "east"
          ? "East"
          : facade === "west"
            ? "West"
            : facade;
  return wing === "front" ? `Front (${side})` : `Back (${side})`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
