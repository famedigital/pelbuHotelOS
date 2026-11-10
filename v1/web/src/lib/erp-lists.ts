/** Pure date/list helpers — safe for Client Components.
 *  Do not import next/headers or Supabase admin here. */

/** Business-date helpers live in `@hotel-os/core/dates` (shared with Hotel OS v2). */
export {
  thimphuDateOffset,
  thimphuToday,
  todayInTimezone,
} from "@hotel-os/core/dates";

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

export function matchesQuery(
  haystacks: Array<string | null | undefined>,
  q: string,
): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(needle));
}
