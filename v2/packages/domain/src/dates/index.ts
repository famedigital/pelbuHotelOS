/** Asia/Thimphu business / stay date helpers — COPY simplified (no Supabase). */

const TZ = "Asia/Thimphu";

export function thimphuToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function thimphuDateOffset(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const utc = Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  const next = new Date(utc + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(checkOut.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}
