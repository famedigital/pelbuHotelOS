import type { DeskRole } from "@/lib/desk-auth";
import {
  ERP_MODULES,
  resolveModule,
  type ErpModule,
  type ErpNavLeaf,
} from "@/lib/erp-nav";

/**
 * Desk access grants stored in `staff_members.desk_module_keys`.
 *
 * - Module key (e.g. `money`) → every tab under that module
 * - Tab href (e.g. `/erp/hr/payroll`) → that screen only
 *
 * NULL column / role defaults → whole modules from `defaultModulesForDeskRole`.
 * Example: Money full + Team without salary → `["dashboard","money","/erp/hr","/erp/hr/leave",…]`
 * (omit `/erp/hr/payroll`).
 */

/** Keys match `ERP_MODULES[].key`. */
export const DESK_MODULE_CATALOG = ERP_MODULES.map((m) => ({
  key: m.key,
  title: m.title,
  tabs: m.tabs.map((t) => ({
    title: t.title,
    href: t.href,
    /** Screens that expose pay / wage data — call out in access UI. */
    sensitive: isSensitiveTab(m.key, t),
  })),
})) as ReadonlyArray<{
  key: string;
  title: string;
  tabs: ReadonlyArray<{
    title: string;
    href: string;
    sensitive: boolean;
  }>;
}>;

export const DESK_MODULE_KEYS = DESK_MODULE_CATALOG.map((m) => m.key);

export type DeskModuleKey = (typeof DESK_MODULE_KEYS)[number];

/** Every known tab landing href across ERP modules. */
export const DESK_TAB_HREFS = DESK_MODULE_CATALOG.flatMap((m) =>
  m.tabs.map((t) => t.href),
);

const MODULE_KEY_SET = new Set(DESK_MODULE_KEYS);
const TAB_HREF_SET = new Set(DESK_TAB_HREFS);

function isSensitiveTab(moduleKey: string, tab: ErpNavLeaf): boolean {
  if (moduleKey === "team" && tab.href.includes("/payroll")) return true;
  if (moduleKey === "team" && tab.title.toLowerCase().includes("payroll"))
    return true;
  return false;
}

export function isDeskModuleKey(raw: string): boolean {
  return MODULE_KEY_SET.has(raw);
}

export function isDeskTabHref(raw: string): boolean {
  return TAB_HREF_SET.has(raw);
}

/** Valid stored token: module key or exact catalog tab href. */
export function isDeskGrantKey(raw: string): boolean {
  const k = raw.trim();
  return isDeskModuleKey(k) || isDeskTabHref(k);
}

export function allDeskModuleKeys(): string[] {
  return [...DESK_MODULE_KEYS];
}

/** Full catalog as module-level grants (every screen). */
export function allDeskGrants(): string[] {
  return allDeskModuleKeys();
}

/**
 * Role defaults when `staff_members.desk_module_keys` is NULL.
 * Owner/GM get everything; departments get a short ops set (full modules).
 */
/** Tab-level FO/POS defaults when `desk_module_keys` is NULL. */
export function defaultModulesForDeskRole(
  role: DeskRole | null | undefined,
): string[] {
  switch (role) {
    case "owner":
    case "gm":
      return allDeskModuleKeys();
    case "cashier":
      return [
        "dashboard",
        "/erp/pos",
        "/erp/payments",
        "/erp/folios",
      ];
    case "fnb":
      return ["dashboard", "/erp/pos", "/erp/kitchen"];
    case "kitchen":
      return ["dashboard", "/erp/kitchen", "/erp/kds"];
    case "hk":
      return [
        "dashboard",
        "/erp/housekeeping",
        "/erp/rooms",
        "/erp/rooms/layout",
        "/erp/lost-found",
        "/erp/maintenance",
      ];
    case "laundry":
      return ["dashboard", "/erp/laundry", "/erp/housekeeping"];
    case "front_desk":
      return [
        "dashboard",
        "/erp/arrivals",
        "/erp/in-house",
        "/erp/departures",
        "/erp/reservations",
        "/erp/guests",
        "/erp/calendar",
        "/erp/calendar/day-sheet",
        "/erp/housekeeping",
        "/erp/laundry",
        "/erp/pos",
        "/erp/folios",
        "/erp/payments",
        "/erp/night-audit",
      ];
    default:
      return defaultModulesForDeskRole("front_desk");
  }
}

/** Role landing route after desk login (staff Auth or PIN-only shared desk). */
export function deskHomeHrefForRole(
  role: DeskRole | null | undefined,
): string {
  switch (role) {
    case "front_desk":
      return "/erp/arrivals";
    case "kitchen":
      return "/erp/kitchen";
    case "cashier":
    case "fnb":
      return "/erp/pos";
    case "hk":
      return "/erp/housekeeping";
    case "laundry":
      return "/erp/laundry";
    case "owner":
    case "gm":
      return "/erp/finance";
    default:
      return "/erp/arrivals";
  }
}

/**
 * Post-login desk home — prefers role home; shared PIN with no staff role →
 * Front desk Arrivals (not bare `/erp`).
 */
export function resolveDeskHomeHref(opts: {
  deskRole: DeskRole | null | undefined;
  pinOnlySession?: boolean;
}): string {
  if (opts.pinOnlySession && !opts.deskRole) {
    return "/erp/arrivals";
  }
  return deskHomeHrefForRole(opts.deskRole);
}

/**
 * Normalize + validate grants. Drops unknowns. Ensures `dashboard` when non-empty.
 * Does not compress (caller may pass mix of modules + tabs).
 */
export function sanitizeDeskGrants(raw: readonly string[]): string[] {
  const cleaned = [
    ...new Set(
      raw
        .map((k) => k.trim())
        .filter((k) => k.length > 0 && isDeskGrantKey(k)),
    ),
  ];
  if (cleaned.length === 0) return cleaned;
  // Desk home always stays available when any custom grant is set.
  if (!cleaned.includes("dashboard")) {
    cleaned.unshift("dashboard");
  }
  return cleaned;
}

/**
 * Collapse full-module tab lists into module keys for compact storage.
 * Partial modules stay as individual hrefs.
 */
export function compressDeskGrants(raw: readonly string[]): string[] {
  const sanitized = sanitizeDeskGrants(raw);
  const modules = new Set(sanitized.filter(isDeskModuleKey));
  const tabs = sanitized.filter(isDeskTabHref);

  for (const mod of DESK_MODULE_CATALOG) {
    if (modules.has(mod.key)) continue;
    const tabHrefs = mod.tabs.map((t) => t.href);
    const hasAll =
      tabHrefs.length > 0 && tabHrefs.every((href) => tabs.includes(href));
    if (hasAll) {
      modules.add(mod.key);
    }
  }

  const out = [...modules];
  for (const href of tabs) {
    const parent = DESK_MODULE_CATALOG.find((m) =>
      m.tabs.some((t) => t.href === href),
    );
    if (parent && modules.has(parent.key)) continue;
    out.push(href);
  }

  return sanitizeDeskGrants(out);
}

/**
 * Expand role-default / stored grants into an explicit allow-check shape.
 */
export function resolveDeskModules(opts: {
  deskRole: DeskRole | null | undefined;
  deskModuleKeys: string[] | null | undefined;
}): string[] {
  const role = opts.deskRole ?? null;
  if (role === "owner" || role === "gm") {
    return allDeskGrants();
  }

  const raw = opts.deskModuleKeys;
  if (raw != null) {
    const cleaned = sanitizeDeskGrants(raw);
    if (cleaned.length > 0) return cleaned;
  }

  return defaultModulesForDeskRole(role);
}

/** True when the current session role may edit other staff module matrices. */
export function canEditDeskModuleAccess(
  role: DeskRole | null | undefined,
): boolean {
  return role === "owner" || role === "gm";
}

function moduleFullyGranted(
  moduleKey: string,
  grants: readonly string[],
): boolean {
  return grants.includes(moduleKey);
}

function tabHrefGranted(href: string, grants: readonly string[]): boolean {
  if (grants.includes(href)) return true;
  const parent = DESK_MODULE_CATALOG.find((m) =>
    m.tabs.some((t) => t.href === href),
  );
  if (parent && grants.includes(parent.key)) return true;
  // Dashboard module is only `/erp`.
  if (href === "/erp" && grants.includes("dashboard")) return true;
  return false;
}

/** Module shows in sidebar if any tab is granted (or whole module). */
export function moduleVisibleFromGrants(
  moduleKey: string,
  grants: readonly string[] | null | undefined,
): boolean {
  if (!grants || grants.length === 0) return true;
  if (moduleFullyGranted(moduleKey, grants)) return true;
  const mod = DESK_MODULE_CATALOG.find((m) => m.key === moduleKey);
  if (!mod) return false;
  return mod.tabs.some((t) => grants.includes(t.href));
}

export function tabVisibleFromGrants(
  moduleKey: string,
  tabHref: string,
  grants: readonly string[] | null | undefined,
): boolean {
  if (!grants || grants.length === 0) return true;
  if (moduleFullyGranted(moduleKey, grants)) return true;
  return grants.includes(tabHref);
}

/** First allowed landing for a module (for sidebar primary link). */
export function firstAllowedHrefForModule(
  module: ErpModule,
  grants: readonly string[] | null | undefined,
): string {
  if (!grants || grants.length === 0) return module.href;
  if (moduleFullyGranted(module.key, grants)) return module.href;
  for (const tab of module.tabs) {
    if (grants.includes(tab.href)) return tab.href;
  }
  return module.href;
}

/**
 * Filter modules + tabs to only granted screens.
 * Empty grants / omit → everything (PIN / legacy full access).
 */
export function filterErpNavByGrants(
  modules: readonly ErpModule[],
  grants: readonly string[] | null | undefined,
): ErpModule[] {
  if (!grants || grants.length === 0) {
    return modules.map((m) => ({ ...m, tabs: [...m.tabs] }));
  }
  return modules
    .map((m) => {
      if (moduleFullyGranted(m.key, grants)) {
        return { ...m, tabs: [...m.tabs] };
      }
      const tabs = m.tabs.filter((t) => grants.includes(t.href));
      if (tabs.length === 0) return null;
      return {
        ...m,
        href: tabs[0]?.href ?? m.href,
        tabs,
      };
    })
    .filter((m): m is ErpModule => m != null);
}

/**
 * Soft product ACL for deep links. Unmapped routes stay allowed so ad-hoc
 * screens (check-in, folio detail) are not hard-blocked by partial nav maps.
 */
export function pathnameAllowedForModules(
  pathname: string | null | undefined,
  grants: readonly string[],
): boolean {
  if (!pathname) return true;
  if (pathname === "/erp" || pathname === "/erp/") return true;
  if (pathname === "/erp/login" || pathname.startsWith("/erp/login"))
    return true;
  // Wall displays / print sheets are shell-free; never block.
  if (
    pathname === "/erp/kds" ||
    pathname.startsWith("/erp/kds/") ||
    pathname.startsWith("/erp/menu/print/") ||
    /\/print\/?$/.test(pathname) ||
    /\/receipt\/?$/.test(pathname) ||
    /\/statement\/?$/.test(pathname)
  ) {
    return true;
  }

  const match = resolveModule(pathname);
  if (!match) return true;
  return tabVisibleFromGrants(match.module.key, match.tab.href, grants);
}

export function filterModulesByKeys<T extends { key: string }>(
  modules: readonly T[],
  moduleKeys: readonly string[],
): T[] {
  return modules.filter((m) => moduleVisibleFromGrants(m.key, moduleKeys));
}

/**
 * Expand stored grants to checkbox state for the access UI.
 * Module checked = whole module; otherwise individual tab hrefs.
 */
export function expandGrantsForEditor(
  grants: readonly string[] | null,
  roleDefaults: readonly string[],
): { useDefaults: boolean; selected: Set<string> } {
  if (grants == null) {
    return {
      useDefaults: true,
      selected: new Set(expandModulesToAllTabTokens(roleDefaults)),
    };
  }
  const selected = new Set<string>();
  for (const g of sanitizeDeskGrants(grants)) {
    if (isDeskModuleKey(g)) {
      selected.add(g);
      const mod = DESK_MODULE_CATALOG.find((m) => m.key === g);
      if (mod) {
        for (const t of mod.tabs) selected.add(t.href);
      }
    } else {
      selected.add(g);
    }
  }
  return { useDefaults: false, selected };
}

/** All tab hrefs + module keys for modules that are fully present. */
function expandModulesToAllTabTokens(moduleKeys: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of moduleKeys) {
    if (!isDeskModuleKey(key)) continue;
    out.push(key);
    const mod = DESK_MODULE_CATALOG.find((m) => m.key === key);
    if (mod) {
      for (const t of mod.tabs) out.push(t.href);
    }
  }
  return out;
}

/**
 * From editor Set of module keys + tab hrefs, produce storage grant list.
 * Whole module if every tab selected; else individual tab hrefs.
 */
export function grantsFromEditorSelection(
  selected: ReadonlySet<string>,
): string[] {
  const raw: string[] = [];
  for (const mod of DESK_MODULE_CATALOG) {
    const tabHrefs = mod.tabs.map((t) => t.href);
    if (tabHrefs.length === 0) {
      if (selected.has(mod.key)) raw.push(mod.key);
      continue;
    }
    const selectedTabs = tabHrefs.filter((h) => selected.has(h));
    if (selectedTabs.length === 0) continue;
    if (selectedTabs.length === tabHrefs.length) {
      raw.push(mod.key);
    } else {
      raw.push(...selectedTabs);
    }
  }
  return compressDeskGrants(raw);
}

/** Human summary for dossier / matrix display. */
export function summarizeDeskGrants(
  grants: string[] | null | undefined,
  role: DeskRole | null | undefined,
  opts?: { isOwner?: boolean },
): string {
  if (opts?.isOwner) return "Owner — full catalog";
  if (grants == null) {
    const defaults = defaultModulesForDeskRole(role);
    return `Role defaults (${defaults.join(", ")})`;
  }
  const modules = grants.filter(isDeskModuleKey);
  const tabs = grants.filter(isDeskTabHref);
  const parts: string[] = [];
  if (modules.length) parts.push(modules.join(", "));
  if (tabs.length) {
    const labels = tabs.map((href) => {
      for (const m of DESK_MODULE_CATALOG) {
        const t = m.tabs.find((x) => x.href === href);
        if (t) return `${m.title} › ${t.title}`;
      }
      return href;
    });
    parts.push(labels.join("; "));
  }
  return parts.length ? parts.join(" · ") : "No modules selected";
}
