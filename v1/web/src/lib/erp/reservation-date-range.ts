/** Arrival-window helpers for reservations FO filters. */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): value is string {
  return !!value && ISO.test(value);
}

/** Last calendar day of the month for a YYYY-MM-DD (UTC math, no timezone shift). */
export function lastDayOfMonth(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  if (!y || !m) return iso.slice(0, 10);
  const last = new Date(Date.UTC(y, m, 0));
  const mm = String(last.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(last.getUTCDate()).padStart(2, "0");
  return `${last.getUTCFullYear()}-${mm}-${dd}`;
}

export function firstDayOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function yearMonth(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * When arrival-from changes, keep To in the same month (hotel FO expectation):
 * empty To, To before From, or To in another month → end of From’s month.
 */
export function syncToWithFrom(from: string, to: string): string {
  if (!isIsoDate(from)) return to;
  if (!isIsoDate(to) || to < from || yearMonth(to) !== yearMonth(from)) {
    return lastDayOfMonth(from);
  }
  return to;
}

/** Normalize a submitted range so from ≤ to when both present. */
export function normalizeArrivalRange(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): { from: string; to: string } {
  let from = isIsoDate(fromRaw) ? fromRaw : "";
  let to = isIsoDate(toRaw) ? toRaw : "";
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to };
}

/** Compare booking check_in (date or timestamptz) to YYYY-MM-DD window. */
export function checkInWithinRange(
  checkIn: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!checkIn) return false;
  const day = checkIn.slice(0, 10);
  if (!ISO.test(day)) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
