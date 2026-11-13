/**
 * In-house / print-pass headcount from stay adults+children.
 * Never invent double occupancy when counts are missing.
 */
export type StayPaxFields = {
  adults?: number | null;
  children?: number | null;
};

export function stayPax(stay: StayPaxFields): number {
  const hasAdults = stay.adults != null && Number.isFinite(Number(stay.adults));
  const hasChildren =
    stay.children != null && Number.isFinite(Number(stay.children));
  if (!hasAdults && !hasChildren) return 1;
  const adults = hasAdults ? Math.max(0, Math.floor(Number(stay.adults))) : 0;
  const children = hasChildren
    ? Math.max(0, Math.floor(Number(stay.children)))
    : 0;
  return Math.max(1, adults + children);
}
