/** Browser prefs for the POS register — survive refresh, never touch the server. */

export type PosSaleKindPref = "table" | "room" | "counter";

const FLOOR_KEY = "pelbu.pos.floor";
const KIND_KEY = "pelbu.pos.lastKind";
const MENU_OUTLET_KEY = "pelbu.pos.menuOutlet";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readPosFloorPref(fallback: string | null): string | null {
  if (!canUseStorage()) return fallback;
  try {
    const raw = localStorage.getItem(FLOOR_KEY);
    if (raw === null) return fallback;
    if (raw === "" || raw === "__shared__") return null;
    return raw;
  } catch {
    return fallback;
  }
}

export function writePosFloorPref(floor: string | null): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(FLOOR_KEY, floor ?? "__shared__");
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPosLastKind(): PosSaleKindPref | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(KIND_KEY);
    if (raw === "table" || raw === "room" || raw === "counter") return raw;
    return null;
  } catch {
    return null;
  }
}

export function writePosLastKind(kind: PosSaleKindPref): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KIND_KEY, kind);
  } catch {
    /* ignore */
  }
}

export function readPosMenuOutletPref(fallback: string): string {
  if (!canUseStorage()) return fallback;
  try {
    return localStorage.getItem(MENU_OUTLET_KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePosMenuOutletPref(outlet: string): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(MENU_OUTLET_KEY, outlet);
  } catch {
    /* ignore */
  }
}
