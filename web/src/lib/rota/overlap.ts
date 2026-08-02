/**
 * Pure shift time-overlap helpers for rota exclusivity.
 * Times are time-of-day strings (HH:MM or HH:MM:SS) on a single calendar day.
 */

export type Interval = {
  startsAt: string;
  endsAt: string;
};

export type ShiftInterval = Interval & {
  id?: string;
  staffId: string;
  shiftDate: string;
  status?: string;
};

/** Normalize HH:MM or HH:MM:SS to HH:MM:SS for string comparison. */
export function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  throw new Error(`Invalid time: ${value}`);
}

/** True when two half-open/closed windows overlap: a starts before b ends and ends after b starts. */
export function timesOverlap(a: Interval, b: Interval): boolean {
  const aStart = normalizeTime(a.startsAt);
  const aEnd = normalizeTime(a.endsAt);
  const bStart = normalizeTime(b.startsAt);
  const bEnd = normalizeTime(b.endsAt);
  return aStart < bEnd && aEnd > bStart;
}

export function findOverlappingShift(
  candidate: ShiftInterval,
  peers: ShiftInterval[],
  options?: { ignoreId?: string | null },
): ShiftInterval | null {
  for (const peer of peers) {
    if (options?.ignoreId && peer.id && peer.id === options.ignoreId) continue;
    if (peer.staffId !== candidate.staffId) continue;
    if (peer.shiftDate !== candidate.shiftDate) continue;
    if (peer.status === "cancelled") continue;
    if (timesOverlap(candidate, peer)) return peer;
  }
  return null;
}

export function assertNoOverlap(
  candidate: ShiftInterval,
  peers: ShiftInterval[],
  options?: { ignoreId?: string | null },
): void {
  const hit = findOverlappingShift(candidate, peers, options);
  if (!hit) return;
  const start = normalizeTime(hit.startsAt).slice(0, 5);
  const end = normalizeTime(hit.endsAt).slice(0, 5);
  const status = hit.status ? ` ${hit.status}` : "";
  throw new Error(`Shift overlaps existing${status} shift ${start}–${end}.`);
}

/** Staff ids busy on a given date for the candidate interval. */
export function busyStaffIds(
  candidate: Omit<ShiftInterval, "staffId"> & { staffId?: string },
  peers: ShiftInterval[],
  options?: { ignoreId?: string | null },
): Set<string> {
  const busy = new Set<string>();
  for (const peer of peers) {
    if (options?.ignoreId && peer.id && peer.id === options.ignoreId) continue;
    if (peer.shiftDate !== candidate.shiftDate) continue;
    if (peer.status === "cancelled") continue;
    if (timesOverlap(candidate, peer)) {
      busy.add(peer.staffId);
    }
  }
  return busy;
}

/** Filter staff options to free people; keeps the current assignee if ignoreId is editing. */
export function freeStaffFilter<T extends { id: string }>(
  staff: T[],
  candidate: Omit<ShiftInterval, "staffId">,
  peers: ShiftInterval[],
  options?: { ignoreId?: string | null; includeStaffId?: string | null },
): Array<T & { busy: boolean }> {
  const busy = busyStaffIds(candidate, peers, options);
  return staff.map((member) => {
    const isInclude = options?.includeStaffId === member.id;
    return {
      ...member,
      busy: busy.has(member.id) && !isInclude,
    };
  });
}

/** ISO weekday Mon=1 … Sun=7 for an ISO date string. */
export function isoWeekday(isoDate: string): number {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function templateAppliesOnDay(
  daysOfWeek: number[],
  isoDate: string,
): boolean {
  if (!daysOfWeek.length) return true;
  return daysOfWeek.includes(isoWeekday(isoDate));
}
