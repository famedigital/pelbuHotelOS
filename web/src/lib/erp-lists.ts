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
