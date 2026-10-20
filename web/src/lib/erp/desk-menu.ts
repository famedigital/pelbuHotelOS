/**
 * Sheets-style desk menubar groups + pinned bottom sheet tabs.
 * Built from ERP_MODULES tabs (grant / workspace filtered at render time).
 */

import type { ErpModule, ErpNavLeaf } from "@/lib/erp-nav";
import { ERP_MODULES } from "@/lib/erp-nav";

export type DeskMenuGroupId =
  | "stay"
  | "book"
  | "money"
  | "rooms"
  | "fnb"
  | "tools"
  | "hotel";

export type DeskMenuGroup = {
  id: DeskMenuGroupId;
  label: string;
  /** hrefs to pull from modules (order preserved). */
  hrefs: readonly string[];
};

/** FO/BO shared menubar — hotel labels, not File/Edit. */
export const DESK_MENU_GROUPS: readonly DeskMenuGroup[] = [
  {
    id: "stay",
    label: "Stay",
    hrefs: [
      "/erp/stayview",
      "/erp/arrivals",
      "/erp/in-house",
      "/erp/departures",
      "/erp/reservations",
      "/erp/guests",
      "/erp/stays",
      "/erp",
    ],
  },
  {
    id: "book",
    label: "Book",
    hrefs: ["/erp/reserve", "/erp/ask", "/erp/calendar", "/erp/calendar/day-sheet"],
  },
  {
    id: "money",
    label: "Money",
    hrefs: [
      "/erp/bills",
      "/erp/folios",
      "/erp/invoices",
      "/erp/payments",
      "/erp/agents",
      "/erp/night-audit",
      "/erp/finance",
      "/erp/reports",
    ],
  },
  {
    id: "rooms",
    label: "Rooms",
    hrefs: [
      "/erp/housekeeping",
      "/erp/rooms",
      "/erp/rooms/layout",
      "/erp/laundry",
      "/erp/maintenance",
      "/erp/lost-found",
    ],
  },
  {
    id: "fnb",
    label: "F&B",
    hrefs: [
      "/erp/pos",
      "/erp/kitchen",
      "/erp/menu",
      "/erp/pos/bills",
      "/erp/pos/reports",
      "/erp/kds",
    ],
  },
  {
    id: "tools",
    label: "Tools",
    hrefs: [
      "/erp/training",
      "/erp/agents/confirmed",
      "/erp/channel",
      "/erp/marketing",
      "/erp/rate-plans",
    ],
  },
  {
    id: "hotel",
    label: "Hotel",
    hrefs: [
      "/erp/settings",
      "/erp/rates",
      "/erp/hr",
      "/erp/inventory",
      "/erp/compliance",
      "/erp/dot-assessment",
      "/erp/properties/new",
    ],
  },
] as const;

export type DeskSheetTab = {
  title: string;
  href: string;
  moduleKey: string;
};

/** Pinned bottom sheet tabs — Front desk. */
export const FO_SHEET_TABS: readonly DeskSheetTab[] = [
  { title: "Board", href: "/erp/stayview", moduleKey: "front-desk" },
  { title: "Rack", href: "/erp/calendar", moduleKey: "calendar" },
  { title: "Arrivals", href: "/erp/arrivals", moduleKey: "front-desk" },
  { title: "In-house", href: "/erp/in-house", moduleKey: "front-desk" },
  { title: "Departures", href: "/erp/departures", moduleKey: "front-desk" },
  { title: "Bills", href: "/erp/bills", moduleKey: "front-desk" },
  { title: "POS", href: "/erp/pos", moduleKey: "pos" },
] as const;

/** Pinned bottom sheet tabs — Back office. */
export const BO_SHEET_TABS: readonly DeskSheetTab[] = [
  { title: "Finance", href: "/erp/finance", moduleKey: "money" },
  { title: "Night close", href: "/erp/night-audit", moduleKey: "money" },
  { title: "Reports", href: "/erp/reports", moduleKey: "money" },
  { title: "Bills", href: "/erp/bills", moduleKey: "money" },
  { title: "Agents", href: "/erp/agents", moduleKey: "channels" },
  { title: "HR", href: "/erp/hr", moduleKey: "team" },
  { title: "Stock", href: "/erp/inventory", moduleKey: "inventory" },
] as const;

/** Extra destinations FO can pin via + */
export const FO_PINNABLE_SHEETS: readonly DeskSheetTab[] = [
  { title: "Reserve", href: "/erp/reserve", moduleKey: "front-desk" },
  { title: "Ask", href: "/erp/ask", moduleKey: "front-desk" },
  { title: "Reservations", href: "/erp/reservations", moduleKey: "front-desk" },
  { title: "Guests", href: "/erp/guests", moduleKey: "front-desk" },
  { title: "Day sheet", href: "/erp/calendar/day-sheet", moduleKey: "calendar" },
  { title: "HK", href: "/erp/housekeeping", moduleKey: "rooms" },
  { title: "Night close", href: "/erp/night-audit", moduleKey: "money" },
  { title: "Kitchen", href: "/erp/kitchen", moduleKey: "pos" },
] as const;

const EXTRA_TABS_KEY = "innora.desk.sheetTabs";

export function loadPinnedSheetHrefs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(EXTRA_TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function savePinnedSheetHrefs(hrefs: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(EXTRA_TABS_KEY, JSON.stringify(hrefs));
  } catch {
    /* ignore quota */
  }
}

/** Flat leaf lookup across modules. */
export function leafByHref(
  modules: readonly ErpModule[] = ERP_MODULES,
): Map<string, ErpNavLeaf & { moduleKey: string; moduleTitle: string }> {
  const map = new Map<
    string,
    ErpNavLeaf & { moduleKey: string; moduleTitle: string }
  >();
  for (const m of modules) {
    for (const t of m.tabs) {
      if (!map.has(t.href)) {
        map.set(t.href, {
          ...t,
          moduleKey: m.key,
          moduleTitle: m.title,
        });
      }
    }
  }
  return map;
}

export function resolveMenuItems(
  group: DeskMenuGroup,
  allowedHrefs: Set<string> | null,
  modules: readonly ErpModule[] = ERP_MODULES,
): ErpNavLeaf[] {
  const byHref = leafByHref(modules);
  const out: ErpNavLeaf[] = [];
  const seen = new Set<string>();
  for (const href of group.hrefs) {
    if (seen.has(href)) continue;
    if (allowedHrefs && !allowedHrefs.has(href)) continue;
    const leaf = byHref.get(href);
    if (!leaf) continue;
    seen.add(href);
    out.push(leaf);
  }
  return out;
}

/** Toolbar quick destinations (FO defaults). */
export const FO_TOOLBAR_LINKS: readonly {
  title: string;
  href: string;
}[] = [
  { title: "Day sheet", href: "/erp/calendar/day-sheet" },
  { title: "Rack", href: "/erp/calendar" },
  { title: "Reserve", href: "/erp/reserve" },
  { title: "Bills", href: "/erp/bills" },
  { title: "Night close", href: "/erp/night-audit" },
] as const;

export function pathMatchesHref(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/erp") return pathname === "/erp";
  return pathname.startsWith(`${href}/`);
}

export function activeSheetHref(
  pathname: string,
  tabs: readonly { href: string }[],
): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const t of tabs) {
    if (pathMatchesHref(pathname, t.href) && t.href.length > bestLen) {
      best = t.href;
      bestLen = t.href.length;
    }
  }
  return best;
}
