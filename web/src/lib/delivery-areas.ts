/**
 * Thimphu delivery zones offered on the public /order page.
 *
 * The list is intentionally short and human — Pelbu only runs taxi delivery
 * inside Thimphu, so we reject any taxi order whose area is not on this list.
 * Add zones here when the dispatch radius grows; the server validator and the
 * public form both read this same source.
 */
export const THIMPHU_DELIVERY_AREAS = [
  "Olakha",
  "Motithang",
  "Changzamtog",
  "Changangkha",
  "Babesa",
  "Yangchenphug",
  "Taba",
  "Hejo",
  "Jungshina",
  "Other (Thimphu)",
] as const;

export type ThimphuArea = (typeof THIMPHU_DELIVERY_AREAS)[number];

export const THIMPHU_AREA_SET = new Set<string>(THIMPHU_DELIVERY_AREAS);

export function isValidThimphuArea(value: string | null | undefined): boolean {
  return typeof value === "string" && THIMPHU_AREA_SET.has(value);
}
