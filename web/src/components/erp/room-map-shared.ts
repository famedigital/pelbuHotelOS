export type StayState = "vacant" | "arriving" | "in_house" | "departing";

export type RoomMapUnit = {
  id: string;
  label: string;
  floor_label: string | null;
  view_label: string | null;
  facade_side: string | null;
  has_balcony: boolean;
  /** True DB housekeeper status — never overwritten by stay. */
  hk_status: string;
  pos_x: number | null;
  pos_y: number | null;
  room_type_code: string;
  room_type_name: string;
  is_comp: boolean;
  /** Derived ops layer. */
  stay_state: StayState;
  person_count: number | null;
  has_open_maintenance: boolean;
  /** Missing core photo facets (0–5). Null if not loaded. */
  photos_missing?: number | null;
  occupied_tonight?: boolean;
  guest_name?: string | null;
};

export const FACADE_RING: Record<string, string> = {
  north: "ring-sky-400/60",
  south: "ring-amber-400/60",
  east: "ring-emerald-400/60",
  west: "ring-violet-400/60",
  courtyard: "ring-rose-400/50",
  internal: "ring-muted-foreground/30",
};

/** Edge accent for extruded Building blocks (facade ring on 2D). */
export const FACADE_EDGE: Record<string, string> = {
  north: "border-sky-400",
  south: "border-amber-400",
  east: "border-emerald-400",
  west: "border-violet-400",
  courtyard: "border-rose-400",
  internal: "border-muted-foreground/40",
};

export const HK_FILL: Record<string, string> = {
  clean: "bg-emerald-500/90 text-white",
  dirty: "bg-amber-500/90 text-white",
  inspect: "bg-sky-500/90 text-white",
  occupied: "bg-indigo-600/90 text-white",
  ooo: "bg-rose-600/90 text-white",
};

export const HK_SOLID: Record<string, string> = {
  clean: "#10b981",
  dirty: "#f59e0b",
  inspect: "#0ea5e9",
  occupied: "#4f46e5",
  ooo: "#e11d48",
};

/** Stay-state edge / strip colors (desk dual paint). */
export const STAY_SOLID: Record<StayState, string> = {
  vacant: "#94a3b8",
  arriving: "#3b82f6",
  in_house: "#4f46e5",
  departing: "#f59e0b",
};

export const STAY_RING: Record<StayState, string> = {
  vacant: "ring-slate-400/50",
  arriving: "ring-blue-500",
  in_house: "ring-indigo-600",
  departing: "ring-amber-500",
};

/** Stable palette for public massing by room type code. */
export const TYPE_SOLID_PALETTE = [
  "#0f766e",
  "#9a3412",
  "#0369a1",
  "#7c3aed",
  "#b45309",
  "#0e7490",
  "#be123c",
  "#365314",
] as const;

export function typeSolidColor(typeCode: string): string {
  const key = typeCode.trim() || "room";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TYPE_SOLID_PALETTE[h % TYPE_SOLID_PALETTE.length] ?? "#0f766e";
}

/** Core room areas staff should photograph per physical unit. */
export const ROOM_MAP_CORE_FACETS = [
  "overview",
  "beds",
  "bathroom",
  "view",
  "amenities",
] as const;

export function floorKey(unit: RoomMapUnit): string {
  if (unit.floor_label?.trim()) return unit.floor_label.trim();
  if (/^[2-5]\d{2}$/.test(unit.label)) return unit.label[0];
  return "Other";
}

/** Shared percent coords with Plan fallback grid so both views align. */
export function unitPlanPosition(
  unit: RoomMapUnit,
  indexAmongShown: number,
): { x: number; y: number } {
  if (unit.pos_x != null && unit.pos_y != null) {
    return { x: unit.pos_x, y: unit.pos_y };
  }
  const col = indexAmongShown % 6;
  const row = Math.floor(indexAmongShown / 6);
  return { x: 10 + col * 15, y: 16 + row * 20 };
}

export function listFloors(units: RoomMapUnit[]): string[] {
  const set = new Set<string>();
  for (const u of units) set.add(floorKey(u));
  return [
    "All",
    ...[...set].filter((f) => f !== "All").sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    }),
  ];
}

export function deriveStayState(input: {
  fromDate: string;
  toDate: string;
  today: string;
  bookingStatus: string;
  checkOut: string | null;
}): StayState {
  const { fromDate, toDate, today, bookingStatus, checkOut } = input;
  if (fromDate > today || toDate <= today) return "vacant";
  const status = bookingStatus.toLowerCase();
  if (status === "cancelled") return "vacant";
  const checkout = checkOut ?? toDate;
  if (checkout === today && (status === "checked_in" || fromDate < today)) {
    return "departing";
  }
  if (fromDate === today && status !== "checked_in") {
    return "arriving";
  }
  return "in_house";
}

export function deskHoverLabel(unit: RoomMapUnit): string {
  const parts = [`Room ${unit.label}`, unit.hk_status];
  if (unit.stay_state !== "vacant") {
    parts.push(unit.stay_state.replace("_", " "));
  }
  if (unit.person_count != null && unit.person_count > 0) {
    parts.push(`${unit.person_count} pax`);
  }
  if (unit.has_open_maintenance) parts.push("maint");
  if (unit.guest_name) parts.push(unit.guest_name);
  return parts.join(" · ");
}
