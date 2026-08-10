/**
 * Product pack: hotel (full PMS) vs restaurant (F&B-only surfaces).
 */

export type ProductPack = "hotel" | "restaurant";

export function parseProductPack(raw: unknown): ProductPack {
  return raw === "restaurant" ? "restaurant" : "hotel";
}

/** ERP module keys hidden when product_pack = restaurant. */
export const RESTAURANT_PACK_HIDDEN_MODULES = new Set([
  "calendar",
  "front-desk",
  "rooms",
  "channels",
]);

/** Tab hrefs still allowed under money when restaurant pack. */
export const RESTAURANT_PACK_MONEY_TABS = new Set([
  "/erp/payments",
  "/erp/invoices",
  "/erp/night-audit",
  "/erp/finance/banking",
  "/erp/finance/expenses",
  "/erp/finance/gst",
  "/erp/finance",
  "/erp/reports",
  "/erp/kitchen/day-pack",
  "/erp/kitchen/compliance",
  "/erp/pos/reservations",
]);

/** Hotel settings tabs hidden for restaurant pack. */
export const RESTAURANT_PACK_HIDDEN_HOTEL_TABS = new Set([
  "/erp/rates",
  "/erp/dot-assessment",
]);

export function filterModulesForProductPack<
  T extends { key: string; href: string; tabs: { href: string }[] },
>(modules: T[], pack: ProductPack): T[] {
  if (pack === "hotel") return modules;
  return modules
    .filter((m) => !RESTAURANT_PACK_HIDDEN_MODULES.has(m.key))
    .map((m) => {
      if (m.key === "money") {
        return {
          ...m,
          tabs: m.tabs.filter((t) => RESTAURANT_PACK_MONEY_TABS.has(t.href)),
          href: "/erp/pos",
        };
      }
      if (m.key === "hotel") {
        return {
          ...m,
          tabs: m.tabs.filter(
            (t) => !RESTAURANT_PACK_HIDDEN_HOTEL_TABS.has(t.href),
          ),
        };
      }
      if (m.key === "dashboard") {
        return { ...m, href: "/erp/pos", tabs: m.tabs };
      }
      return m;
    }) as T[];
}

export function restaurantPublicHrefsAllowed(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  const allow = [
    "/menu",
    "/order",
    "/dine",
    "/cafe",
    "/restaurant",
    "/bar",
    "/contact",
    "/faq",
    "/careers",
  ];
  return allow.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
