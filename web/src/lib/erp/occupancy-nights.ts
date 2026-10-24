/**
 * Empty and occupied guest rooms for each night in a range.
 * Counted from physical rooms and assignments, not sold quantities.
 */

export type OccupancyKind = "guest" | "guide" | "driver" | "other";

export type OccupancyUnit = {
  id: string;
  label: string;
  typeName: string;
  kind: OccupancyKind;
  outOfOrder: boolean;
};

export type OccupancySpan = {
  unitId: string;
  from: string;
  to: string;
};

export type OccupancyTypeNight = {
  name: string;
  empty: string[];
  occupied: string[];
  outOfOrder: string[];
};

export type OccupancyNight = {
  date: string;
  empty: number;
  occupied: number;
  outOfOrder: number;
  types: OccupancyTypeNight[];
};

const MAX_NIGHTS = 31;

export function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function eachNight(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return [];
  }
  if (to < from) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length < MAX_NIGHTS) {
    dates.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return dates;
}

export function occupancyKind(inventoryKind: string | null | undefined): OccupancyKind {
  const kind = (inventoryKind ?? "sellable_guest").toLowerCase();
  if (kind.includes("guide")) return "guide";
  if (kind.includes("driver")) return "driver";
  if (kind === "sellable_guest" || kind === "guest") return "guest";
  return "other";
}

export function isOutOfOrder(hkStatus: string | null | undefined): boolean {
  const status = (hkStatus ?? "").toLowerCase();
  return status === "out_of_order" || status === "ooo" || status === "out_of_service";
}

function covers(span: OccupancySpan, night: string): boolean {
  return span.from <= night && night < span.to;
}

/** Guest rooms only in the headline counts. Guide and driver stay in their type. */
export function occupancyByNight(
  units: OccupancyUnit[],
  spans: OccupancySpan[],
  from: string,
  to: string,
): OccupancyNight[] {
  const byUnit = new Map<string, OccupancySpan[]>();
  for (const span of spans) {
    const list = byUnit.get(span.unitId) ?? [];
    list.push(span);
    byUnit.set(span.unitId, list);
  }

  return eachNight(from, to).map((date) => {
    const types = new Map<string, OccupancyTypeNight>();
    let empty = 0;
    let occupied = 0;
    let outOfOrder = 0;
    for (const unit of units) {
      if (unit.kind !== "guest") {
        const bucket = types.get(unit.typeName) ?? {
          name: unit.typeName,
          empty: [],
          occupied: [],
          outOfOrder: [],
        };
        const taken = (byUnit.get(unit.id) ?? []).some((span) => covers(span, date));
        if (taken) bucket.occupied.push(unit.label);
        else bucket.empty.push(unit.label);
        types.set(unit.typeName, bucket);
        continue;
      }
      const taken = (byUnit.get(unit.id) ?? []).some((span) => covers(span, date));
      const bucket = types.get(unit.typeName) ?? {
        name: unit.typeName,
        empty: [],
        occupied: [],
        outOfOrder: [],
      };
      if (taken) {
        occupied += 1;
        bucket.occupied.push(unit.label);
      } else if (unit.outOfOrder) {
        outOfOrder += 1;
        bucket.outOfOrder.push(unit.label);
      } else {
        empty += 1;
        bucket.empty.push(unit.label);
      }
      types.set(unit.typeName, bucket);
    }
    return {
      date,
      empty,
      occupied,
      outOfOrder,
      types: [...types.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}
