import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveActivePropertyId } from "@/lib/property-context";

/** Asia/Thimphu business date YYYY-MM-DD. */
export function thimphuToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Add (or subtract) days from a YYYY-MM-DD date string, returning a new
 * YYYY-MM-DD. Uses noon to avoid DST edge cases (Thimphu has none today, but
 * the convention keeps the helper portable across timezones).
 */
export function thimphuDateOffset(yyyymmdd: string, days: number): string {
  const base = new Date(`${yyyymmdd.slice(0, 10)}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-BT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Thimphu",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-BT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Thimphu",
  });
}

export async function requireDeskPropertyId(): Promise<string> {
  const admin = createSupabaseAdminClient();
  return resolveActivePropertyId(admin);
}

export function matchesQuery(
  haystacks: Array<string | null | undefined>,
  q: string,
): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(needle));
}
