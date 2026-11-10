/** Pure helpers for per-property night-audit close_time gating. */

const CLOSE_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseCloseTime(raw: string | null | undefined): {
  hours: number;
  minutes: number;
} {
  const value = (raw ?? "00:00").trim();
  const match = CLOSE_TIME_RE.exec(value);
  if (!match) return { hours: 0, minutes: 0 };
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function normalizeCloseTime(raw: string | null | undefined): string {
  const { hours, minutes } = parseCloseTime(raw);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Local wall-clock "HH:MM" in the given IANA timezone (fallback Asia/Thimphu).
 */
export function localHmInTimezone(
  now: Date,
  timeZone: string | null | undefined,
): string {
  const tz = timeZone?.trim() || "Asia/Thimphu";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  } catch {
    return "00:00";
  }
}

function hmToMinutes(hm: string): number {
  const { hours, minutes } = parseCloseTime(hm);
  return hours * 60 + minutes;
}

/**
 * Cron may run night audit when local time is at or after close_time.
 * Default close_time 00:00 means "from midnight onward" (always true after midnight).
 */
export function isPastNightAuditCloseTime(args: {
  now?: Date;
  timeZone: string | null | undefined;
  closeTime: string | null | undefined;
}): boolean {
  const now = args.now ?? new Date();
  const local = localHmInTimezone(now, args.timeZone);
  return hmToMinutes(local) >= hmToMinutes(normalizeCloseTime(args.closeTime));
}
