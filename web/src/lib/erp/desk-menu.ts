/**
 * Sheets-style desk menubar groups + pinned bottom sheet tabs.
 * Built from ERP_MODULES tabs (grant / workspace filtered at render time).
 */

import type { ErpModule, ErpNavLeaf } from "@/lib/erp-nav";
import { ERP_MODULES } from "@/lib/erp-nav";

export type DeskMenuGroupId =
  | "stay"
  | "money"
  | "rooms"
  | "fnb"
  | "hotel";

export type DeskMenuGroup = {
  id: DeskMenuGroupId;
  label: string;
  /** hrefs to pull from modules (order preserved). */
  hrefs: readonly string[];
};

/** One list for the role. Top bar is the group. The rail is that group's items. */
export const DESK_MENU_GROUPS: readonly DeskMenuGroup[] = [
  {
    id: "stay",
    label: "Front office",
    hrefs: [
      "/erp/calendar",
      "/erp/arrivals",
      "/erp/in-house",
      "/erp/departures",
      "/erp/reservations",
      "/erp/stayview",
      "/erp/guests",
      "/erp/stays",
      "/erp/reserve",
      "/erp/ask",
      "/erp/calendar/day-sheet",
      "/erp",
    ],
  },
  {
    id: "money",
    label: "Cashier",
    hrefs: ["/erp/folios", "/erp/invoices", "/erp/bills", "/erp/payments"],
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
    id: "hotel",
    label: "Hotel",
    hrefs: [
      "/erp/night-audit",
      "/erp/rates",
      "/erp/rate-plans",
      "/erp/settings",
      "/erp/finance",
      "/erp/reports",
      "/erp/agents",
      "/erp/agents/confirmed",
      "/erp/hr",
      "/erp/inventory",
      "/erp/channel",
      "/erp/marketing",
      "/erp/training",
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

/**
 * Unified bottom sheet tabs (RBAC-filtered). Priority order for FO + back office.
 * Duplicates by href are skipped when building the visible list.
 */
/** Pinned front-office sheets. Cashier, rooms, F&B, and hotel stay in the menu. */
export const DESK_SHEET_TABS: readonly DeskSheetTab[] = [
  { title: "Room rack", href: "/erp/calendar", moduleKey: "calendar" },
  { title: "Arrival", href: "/erp/arrivals", moduleKey: "front-desk" },
  { title: "In house", href: "/erp/in-house", moduleKey: "front-desk" },
  { title: "Departure", href: "/erp/departures", moduleKey: "front-desk" },
  { title: "Reservations", href: "/erp/reservations", moduleKey: "front-desk" },
] as const;

/** @deprecated use DESK_SHEET_TABS */
export const FO_SHEET_TABS = DESK_SHEET_TABS;
/** @deprecated use DESK_SHEET_TABS */
export const BO_SHEET_TABS = DESK_SHEET_TABS;

/** Extra destinations staff can pin via + */
export const DESK_PINNABLE_SHEETS: readonly DeskSheetTab[] = [
  { title: "Reserve", href: "/erp/reserve", moduleKey: "front-desk" },
  { title: "Ask", href: "/erp/ask", moduleKey: "front-desk" },
  { title: "Reservations", href: "/erp/reservations", moduleKey: "front-desk" },
  { title: "Guests", href: "/erp/guests", moduleKey: "front-desk" },
  { title: "Day sheet", href: "/erp/calendar/day-sheet", moduleKey: "calendar" },
  { title: "HK", href: "/erp/housekeeping", moduleKey: "rooms" },
  { title: "Kitchen", href: "/erp/kitchen", moduleKey: "pos" },
] as const;

/** @deprecated use DESK_PINNABLE_SHEETS */
export const FO_PINNABLE_SHEETS = DESK_PINNABLE_SHEETS;

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
  { title: "Room rack", href: "/erp/calendar" },
  { title: "Arrival", href: "/erp/arrivals" },
  { title: "In house", href: "/erp/in-house" },
  { title: "Departure", href: "/erp/departures" },
  { title: "Reservations", href: "/erp/reservations" },
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
