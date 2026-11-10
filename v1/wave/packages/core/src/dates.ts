const FALLBACK_TZ = "Asia/Thimphu";

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch (err) {
    if (err instanceof RangeError) return false;
    throw err;
  }
}

/** Business date YYYY-MM-DD in an IANA timezone (falls back to Asia/Thimphu). */
export function todayInTimezone(
  timeZone?: string | null,
  date: Date = new Date(),
): string {
  const requested = timeZone?.trim() || FALLBACK_TZ;
  const tz = isValidTimeZone(requested) ? requested : FALLBACK_TZ;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function thimphuToday(): string {
  return todayInTimezone(FALLBACK_TZ);
}

/**
 * Add (or subtract) days from a YYYY-MM-DD date string, returning a new
 * YYYY-MM-DD. Uses noon UTC to avoid DST edge cases.
 */
export function thimphuDateOffset(yyyymmdd: string, days: number): string {
  const base = new Date(`${yyyymmdd.slice(0, 10)}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
