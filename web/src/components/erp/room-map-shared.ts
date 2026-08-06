export type RoomMapUnit = {
  id: string;
  label: string;
  floor_label: string | null;
  view_label: string | null;
  facade_side: string | null;
  has_balcony: boolean;
  hk_status: string;
  pos_x: number | null;
  pos_y: number | null;
  room_type_code: string;
  room_type_name: string;
  is_comp: boolean;
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

/** Edge accent for extruded Building blocks */
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
