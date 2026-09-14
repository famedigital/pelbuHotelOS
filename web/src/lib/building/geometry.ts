/**
 * Shared geometry for dual-corridor 2D canvas + 3D massing (CSS legacy + WebGL).
 * Percent canvas: origin top-left, x right, y down (same as Plan).
 * Three.js world: X right, Y up (floor height), Z depth (plan Y maps to +Z).
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

export type Vec3 = { x: number; y: number; z: number };

export type BoxSize = { w: number; d: number; h: number };

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

/**
 * Percent plan position → world (slab-centered).
 * Y = floor base elevation (Three.js up). Place box center at y + h/2.
 */
export function planToWorld3d(
  posX: number,
  posY: number,
  floorTier: number,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): Vec3 {
  const along = ((posX - 50) / 50) * (params.slabW * 0.42);
  const depth = ((posY - 50) / 50) * (params.slabD * 0.38);
  return {
    x: along,
    y: floorTier * params.floorHeight,
    z: depth,
  };
}

/** Slab footprint in world units (floor plate). */
export function floorSlabSize(
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): { w: number; d: number; thickness: number } {
  return {
    w: params.slabW,
    d: params.slabD,
    thickness: Math.max(2, params.floorHeight * 0.06),
  };
}

/** Room mass size from slab + story height (consistent footprint family). */
export function roomFootprint3d(
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): BoxSize {
  return {
    w: Math.max(28, params.slabW * 0.1),
    d: Math.max(24, params.slabD * 0.14),
    h: Math.max(22, params.floorHeight * 0.78),
  };
}

/** World size for amenity mass from width/depth %. */
export function amenityFootprint3d(
  space: Pick<BuildingSpace, "width_pct" | "depth_pct" | "kind">,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): BoxSize {
  const w = Math.max(28, (space.width_pct / 100) * params.slabW * 0.85);
  const d = Math.max(24, (space.depth_pct / 100) * params.slabD * 0.85);
  const hByKind: Record<string, number> = {
    lobby: Math.max(36, params.floorHeight * 0.9),
    restaurant: Math.max(28, params.floorHeight * 0.75),
    cafe: Math.max(26, params.floorHeight * 0.7),
    bar: Math.max(26, params.floorHeight * 0.7),
    reception: Math.max(28, params.floorHeight * 0.72),
    spa: Math.max(28, params.floorHeight * 0.72),
    gym: Math.max(28, params.floorHeight * 0.72),
    meeting: Math.max(28, params.floorHeight * 0.72),
    stair: Math.max(20, params.floorHeight * 0.55),
    lift: Math.max(20, params.floorHeight * 0.55),
    service: Math.max(22, params.floorHeight * 0.6),
    attic: Math.max(18, params.floorHeight * 0.5),
    other: Math.max(26, params.floorHeight * 0.68),
  };
  return {
    w,
    d,
    h: hByKind[space.kind] ?? Math.max(26, params.floorHeight * 0.68),
  };
}

/** Corridor ribbon on a floor slab (world size, at slab center). */
export function corridorRibbonSize(
  axis: CorridorAxis,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): { w: number; d: number } {
  if (axis === "ew") {
    return {
      w: params.slabW * 0.88,
      d: params.slabD * 0.12,
    };
  }
  return {
    w: params.slabW * 0.12,
    d: params.slabD * 0.88,
  };
}

/**
 * Default SketchUp-like camera for OrbitControls.
 * Position looks from southern-east corner down onto the stack.
 */
export function defaultCameraPose(
  floorCount: number,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): { position: [number, number, number]; target: [number, number, number] } {
  const floors = Math.max(1, floorCount);
  const stackH =
    (floors - 1) * params.floorHeight + roomFootprint3d(params).h;
  const midY = stackH * 0.4;
  const dist = Math.max(params.slabW, params.slabD) * 1.15 + stackH * 0.35;
  return {
    position: [dist * 0.72, midY + dist * 0.48, dist * 0.78],
    target: [0, midY * 0.85, 0],
  };
}

/** Floor base Y for a tier (optional explode retained for future). */
export function floorBaseY(
  floorTier: number,
  params: BuildingLayoutParams = DEFAULT_BUILDING_PARAMS,
): number {
  return floorTier * params.floorHeight;
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
