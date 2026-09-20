/**
 * Dedicated till URLs: /pos/cafe, /pos/restaurant, /pos/bar.
 * /pos/barista is an alias for the cafe till (same menu and tickets).
 */

export const POS_KIOSK_OUTLETS = ["cafe", "restaurant", "bar"] as const;
export type PosKioskOutlet = (typeof POS_KIOSK_OUTLETS)[number];

const ALIASES: Record<string, PosKioskOutlet> = {
  cafe: "cafe",
  barista: "cafe",
  restaurant: "restaurant",
  resto: "restaurant",
  bar: "bar",
};

export function resolvePosKioskOutlet(
  raw: string | null | undefined,
): { slug: string; outlet: PosKioskOutlet; label: string } | null {
  const key = (raw ?? "").trim().toLowerCase();
  const outlet = ALIASES[key];
  if (!outlet) return null;
  const label =
    key === "barista"
      ? "Barista"
      : outlet === "cafe"
        ? "Cafe"
        : outlet === "restaurant"
          ? "Restaurant"
          : "Bar";
  return { slug: key, outlet, label };
}

export function posKioskSaleKind(
  outlet: PosKioskOutlet,
): "table" | "counter" {
  return outlet === "restaurant" ? "table" : "counter";
}

export function isPosKioskPath(path: string): boolean {
  return path === "/pos" || path.startsWith("/pos/");
}
