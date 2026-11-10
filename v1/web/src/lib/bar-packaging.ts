/** Pure bar packing math — safe for client and server. */

export const DEFAULT_PEK_ML = 30;

export function peksPerBottle(
  bottleMl: number,
  pourMl: number = DEFAULT_PEK_ML,
): number {
  if (!Number.isFinite(bottleMl) || bottleMl <= 0) return 0;
  if (!Number.isFinite(pourMl) || pourMl <= 0) return 0;
  return Math.floor(bottleMl / pourMl);
}

export function mlFromBottles(bottles: number, bottleMl: number): number {
  if (!Number.isFinite(bottles) || bottles <= 0) return 0;
  if (!Number.isFinite(bottleMl) || bottleMl <= 0) return 0;
  return Math.round(bottles * bottleMl * 1000) / 1000;
}

export function bottlesFromCases(
  cases: number,
  bottlesPerCase: number,
): number {
  if (!Number.isFinite(cases) || cases <= 0) return 0;
  if (!Number.isInteger(bottlesPerCase) || bottlesPerCase < 1) return 0;
  return Math.round(cases * bottlesPerCase);
}

/** Convert waste amount (pek / bottles / ml) into ledger delta (positive = remove). */
export function wasteQtyInBaseUnit(opts: {
  unit: "pek" | "bottle" | "ml" | "ea";
  amount: number;
  pourMl?: number;
  bottleSizeMl?: number | null;
}): number {
  const amount = Number(opts.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (opts.unit === "ml" || opts.unit === "ea") {
    return Math.round(amount * 1000) / 1000;
  }
  if (opts.unit === "pek") {
    const pour = opts.pourMl ?? DEFAULT_PEK_ML;
    return Math.round(amount * pour * 1000) / 1000;
  }
  // bottle → ml when bottle size known; otherwise treat amount as ea bottles
  const size = opts.bottleSizeMl;
  if (size != null && size > 0) {
    return mlFromBottles(amount, size);
  }
  return Math.round(amount * 1000) / 1000;
}

export function formatPeksPerBottleLabel(
  bottleMl: number,
  pourMl: number = DEFAULT_PEK_ML,
): string {
  const peks = peksPerBottle(bottleMl, pourMl);
  return `1 bottle (${bottleMl} ml) = ${peks} pek${peks === 1 ? "" : "s"}`;
}

/** SKU-friendly slug fragment from a brand name. */
export function barSkuFragment(name: string): string {
  const s = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return s || "ITEM";
}

export function servingsLeft(
  qtyOnHand: number,
  qtyPerSale: number,
): number {
  if (!Number.isFinite(qtyOnHand) || qtyOnHand <= 0) return 0;
  if (!Number.isFinite(qtyPerSale) || qtyPerSale <= 0) return 0;
  return Math.floor(qtyOnHand / qtyPerSale);
}
