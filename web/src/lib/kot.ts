/**
 * Shared KOT (Kitchen Order Ticket) constants. Lifted out of `app/erp/page.tsx`
 * so the POS surface, the desk dashboard, and the kitchen TV board all import
 * the same canonical flow + labels.
 */

export const KOT_FLOW = ["new", "preparing", "ready", "served"] as const;
export type KotStatus = (typeof KOT_FLOW)[number];

export const KOT_LABEL: Record<string, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

/**
 * Columns the kitchen TV board renders. Served tickets drop off the board
 * (they're done), so we stop at "ready".
 */
export const KOT_BOARD_COLUMNS = ["new", "preparing", "ready"] as const;

/** Stable display order for prep-station grouping inside a card. */
export const PREP_STATION_ORDER = [
  "kitchen",
  "bar",
  "pastry",
  "grill",
  "cold",
] as const;

export const PREP_STATION_LABELS: Record<string, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  pastry: "Pastry",
  grill: "Grill",
  cold: "Cold",
};

export function prepStationLabel(station: string | null | undefined): string {
  if (!station) return "Kitchen";
  return PREP_STATION_LABELS[station] ?? station;
}

/** Sort stations in the canonical order; unknowns go last, alphabetically. */
export function sortPrepStations(
  stations: string[],
): string[] {
  return [...stations].sort((a, b) => {
    const ia = PREP_STATION_ORDER.indexOf(
      a as (typeof PREP_STATION_ORDER)[number],
    );
    const ib = PREP_STATION_ORDER.indexOf(
      b as (typeof PREP_STATION_ORDER)[number],
    );
    const ra = ia === -1 ? 99 : ia;
    const rb = ib === -1 ? 99 : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
