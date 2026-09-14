/** eZee-style list buckets for reservations FO chrome. */

export type ReservationStatusBucket =
  | "active"
  | "cancelled"
  | "no_show"
  | "checked_out"
  | "all";

const ACTIVE = new Set([
  "held",
  "pending",
  "confirmed",
  "checked_in",
]);

export function parseReservationStatusBucket(
  raw: string | null | undefined,
): ReservationStatusBucket {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "active") return "active";
  if (v === "cancelled") return "cancelled";
  if (v === "no_show" || v === "noshow") return "no_show";
  if (v === "checked_out" || v === "departed") return "checked_out";
  if (v === "all") return "all";
  return "all";
}

/** When bucket is set, expand to SQL statuses (empty = no status filter). */
export function statusesForBucket(
  bucket: ReservationStatusBucket,
): string[] | null {
  if (bucket === "all") return null;
  if (bucket === "active") return [...ACTIVE];
  if (bucket === "cancelled") return ["cancelled"];
  if (bucket === "no_show") return ["no_show"];
  if (bucket === "checked_out") return ["checked_out"];
  return null;
}

export function statusLegendTone(
  status: string | null | undefined,
): "active" | "cancelled" | "no_show" | "void_like" | "other" {
  const s = status ?? "";
  if (ACTIVE.has(s)) return "active";
  if (s === "cancelled") return "cancelled";
  if (s === "no_show") return "no_show";
  if (s === "checked_out") return "other";
  return "other";
}

/** Left border stripe class for list rows (eZee colour legend). */
export function statusStripeClass(status: string | null | undefined): string {
  const t = statusLegendTone(status);
  if (t === "active") return "border-l-[3px] border-l-emerald-600";
  if (t === "cancelled") return "border-l-[3px] border-l-sky-600";
  if (t === "no_show") return "border-l-[3px] border-l-orange-500";
  return "border-l-[3px] border-l-border";
}
