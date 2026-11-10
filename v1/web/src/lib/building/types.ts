/** Building layout types — dual-corridor twin-wing hotel massing. */

export type CorridorAxis = "ew" | "ns";

export type BuildingFloorKind = "public" | "guest" | "attic" | "service";

export type BuildingFloor = {
  key: string;
  label: string;
  kind: BuildingFloorKind;
};

export type BuildingTemplate = "dual_corridor";

export type BuildingLayoutParams = {
  /** Corridor band thickness as % of canvas cross-axis (default 14). */
  corridorWidthPct: number;
  /** Depth of each room wing from outer wall toward corridor (default 28). */
  wingDepthPct: number;
  /** Padding from canvas edge (default 6). */
  marginPct: number;
  /** Max rooms along one wing before compression (soft limit). */
  maxRoomsPerWingSide: number;
  /** CSS 3D slab width px (default 340). */
  slabW: number;
  /** CSS 3D slab depth px (default 210). */
  slabD: number;
  /** Floor-to-floor px (default 56). */
  floorHeight: number;
};

export const DEFAULT_BUILDING_PARAMS: BuildingLayoutParams = {
  corridorWidthPct: 14,
  wingDepthPct: 28,
  marginPct: 6,
  maxRoomsPerWingSide: 12,
  slabW: 340,
  slabD: 210,
  floorHeight: 56,
};

export type BuildingSpaceKind =
  | "lobby"
  | "restaurant"
  | "cafe"
  | "bar"
  | "reception"
  | "spa"
  | "steam"
  | "gym"
  | "meeting"
  | "stair"
  | "lift"
  | "service"
  | "attic"
  | "other";

export type BuildingSpace = {
  id?: string;
  floor_key: string;
  kind: BuildingSpaceKind;
  label: string;
  pos_x: number;
  pos_y: number;
  width_pct: number;
  depth_pct: number;
  facade_side: string | null;
  sort_order: number;
};

export type PropertyBuildingLayout = {
  property_id: string;
  template: BuildingTemplate;
  floors: BuildingFloor[];
  params: BuildingLayoutParams;
  corridor_axis: CorridorAxis;
  setup_completed_at: string | null;
};

export type RoomPackInput = {
  id: string;
  label: string;
  floor_label: string | null;
  /** When true, still pack but track as comp. */
  is_comp?: boolean;
};

export type RoomPackPlacement = {
  id: string;
  floor_key: string;
  pos_x: number;
  pos_y: number;
  facade_side: "north" | "south" | "east" | "west";
  /** front = first wing / back = second wing along dual corridor */
  wing: "front" | "back";
  slot_index: number;
};

export type FloorWingSummary = {
  floor_key: string;
  floor_label: string;
  kind: BuildingFloorKind;
  front: { facade: string; count: number; labels: string[] };
  back: { facade: string; count: number; labels: string[] };
  unmatched: string[];
  amenities: string[];
};

export function normalizeParams(
  raw: unknown,
): BuildingLayoutParams {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    corridorWidthPct: num(o.corridorWidthPct, DEFAULT_BUILDING_PARAMS.corridorWidthPct),
    wingDepthPct: num(o.wingDepthPct, DEFAULT_BUILDING_PARAMS.wingDepthPct),
    marginPct: num(o.marginPct, DEFAULT_BUILDING_PARAMS.marginPct),
    maxRoomsPerWingSide: Math.max(
      2,
      Math.floor(
        num(o.maxRoomsPerWingSide, DEFAULT_BUILDING_PARAMS.maxRoomsPerWingSide),
      ),
    ),
    slabW: num(o.slabW, DEFAULT_BUILDING_PARAMS.slabW),
    slabD: num(o.slabD, DEFAULT_BUILDING_PARAMS.slabD),
    floorHeight: num(o.floorHeight, DEFAULT_BUILDING_PARAMS.floorHeight),
  };
}

export function normalizeFloors(raw: unknown): BuildingFloor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const key = String(o.key ?? "").trim();
      if (!key) return null;
      const kindRaw = String(o.kind ?? "guest");
      const kind: BuildingFloorKind =
        kindRaw === "public" ||
        kindRaw === "attic" ||
        kindRaw === "service" ||
        kindRaw === "guest"
          ? kindRaw
          : "guest";
      return {
        key,
        label: String(o.label ?? key).trim() || key,
        kind,
      };
    })
    .filter((f): f is BuildingFloor => f != null);
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Infer floor key from floor_label or 3-digit room number (201 → "2"). */
export function inferFloorKey(
  label: string,
  floorLabel: string | null | undefined,
): string | null {
  const fl = floorLabel?.trim();
  if (fl) return fl;
  if (/^[2-9]\d{2}$/.test(label.trim())) return label.trim()[0];
  if (/^[Gg]$/.test(label.trim())) return "G";
  return null;
}
