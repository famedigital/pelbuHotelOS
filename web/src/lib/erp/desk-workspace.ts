/**
 * Front desk vs Back office workspace (eZee Absolute FO / BO rail → one Pelbu ERP).
 * Cookie `pelbu_workspace_v1` · no second login / Configuration product.
 */

import type { DeskRole } from "@/lib/desk-auth";
import type { ErpModule } from "@/lib/erp-nav";
import {
  filterErpNavByGrants,
  moduleVisibleFromGrants,
  pathnameAllowedForModules,
} from "@/lib/erp/desk-modules";

export type DeskWorkspace = "front_desk" | "back_office";

export const DESK_WORKSPACE_COOKIE = "pelbu_workspace_v1";
export const DESK_WORKSPACE_STORAGE_KEY = "pelbu_workspace_v1";

/** Modules emphasized in Front desk (guest-day ops). */
export const FRONT_DESK_MODULE_KEYS = [
  "dashboard",
  "calendar",
  "front-desk",
  "rooms",
  "pos",
] as const;

/**
 * Money tabs still available on Front desk (collect / folio / close day)
 * without opening full AP / GST / vault.
 */
export const FRONT_DESK_MONEY_TAB_HREFS = [
  "/erp/payments",
  "/erp/folios",
  "/erp/night-audit",
] as const;

/** Modules emphasized in Back office (Absolute Pay Out / Cityledger / Business Source). */
export const BACK_OFFICE_MODULE_KEYS = [
  "dashboard",
  "money",
  "channels",
  "inventory",
  "team",
  "pos",
] as const;

export function isDeskWorkspace(
  raw: string | null | undefined,
): raw is DeskWorkspace {
  return raw === "front_desk" || raw === "back_office";
}

/** Owner/GM/cashier lean Back office; FO staff lean Front desk. */
export function defaultWorkspaceForRole(
  role: DeskRole | null | undefined,
): DeskWorkspace {
  switch (role) {
    case "owner":
    case "gm":
    case "cashier":
      return "back_office";
    case "front_desk":
    case "hk":
    case "laundry":
    case "kitchen":
    case "fnb":
    default:
      return "front_desk";
  }
}

export function workspaceLandingHref(workspace: DeskWorkspace): string {
  return workspace === "back_office" ? "/erp/finance" : "/erp/arrivals";
}

const FRONT_DESK_LANDING_CANDIDATES = [
  "/erp/arrivals",
  "/erp/calendar",
  "/erp/in-house",
  "/erp/reservations",
  "/erp/pos",
  "/erp",
] as const;

const BACK_OFFICE_LANDING_CANDIDATES = [
  "/erp/finance",
  "/erp/agents",
  "/erp/payments",
  "/erp/invoices",
  "/erp/inventory",
  "/erp/hr",
  "/erp/pos",
  "/erp",
] as const;

/** First granted landing for a workspace (toggle / PIN home). */
export function resolveWorkspaceLandingHref(
  workspace: DeskWorkspace,
  grants?: readonly string[] | null,
): string {
  const candidates =
    workspace === "back_office"
      ? BACK_OFFICE_LANDING_CANDIDATES
      : FRONT_DESK_LANDING_CANDIDATES;
  if (!grants || grants.length === 0) return candidates[0];
  for (const href of candidates) {
    if (pathnameAllowedForModules(href, grants)) return href;
  }
  return "/erp";
}

/** Cookie max-age (~400d) for workspace preference. */
export const DESK_WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * True when session can open Back office world (AP / city ledger / agents / stock).
 * Guest-day payments + folio alone stay on Front desk — no BO toggle for pure FO.
 */
export function canUseBackOfficeWorkspace(
  grants: readonly string[] | null | undefined,
): boolean {
  if (!grants || grants.length === 0) return true;
  if (moduleVisibleFromGrants("channels", grants)) return true;
  if (moduleVisibleFromGrants("inventory", grants)) return true;
  if (moduleVisibleFromGrants("team", grants)) return true;
  if (grants.includes("money")) return true;
  return grants.some(
    (g) =>
      g.startsWith("/erp/finance") ||
      g.startsWith("/erp/agents") ||
      g.startsWith("/erp/inventory") ||
      g.startsWith("/erp/invoices") ||
      g.startsWith("/erp/reports") ||
      g.startsWith("/erp/hr") ||
      g === "/erp/finance" ||
      g === "/erp/agents" ||
      g === "/erp/inventory" ||
      g === "/erp/invoices" ||
      g === "/erp/reports" ||
      g === "/erp/hr",
  );
}

export function canUseFrontDeskWorkspace(
  grants: readonly string[] | null | undefined,
): boolean {
  if (!grants || grants.length === 0) return true;
  for (const key of FRONT_DESK_MODULE_KEYS) {
    if (key === "dashboard" || key === "pos") continue;
    if (moduleVisibleFromGrants(key, grants)) return true;
  }
  return grants.some(
    (g) =>
      g === "front-desk" ||
      g === "calendar" ||
      g === "rooms" ||
      g.startsWith("/erp/arrivals") ||
      g.startsWith("/erp/in-house") ||
      g.startsWith("/erp/departures") ||
      g.startsWith("/erp/reservations") ||
      g.startsWith("/erp/calendar") ||
      g.startsWith("/erp/guests") ||
      g.startsWith("/erp/housekeeping"),
  );
}

/**
 * Filter nav for the active workspace, then apply role grants.
 * Hotel/settings stay out of the rail (footer) — caller keeps that separate.
 */
export function filterModulesForWorkspace(
  modules: readonly ErpModule[],
  workspace: DeskWorkspace,
  grants?: readonly string[] | null,
): ErpModule[] {
  const withoutHotel = modules.filter((m) => m.key !== "hotel");

  let scoped: ErpModule[];
  if (workspace === "front_desk") {
    const keySet = new Set<string>(FRONT_DESK_MODULE_KEYS);
    scoped = withoutHotel
      .filter((m) => keySet.has(m.key) || m.key === "money")
      .map((m) => {
        if (m.key !== "money") return { ...m, tabs: [...m.tabs] };
        const tabs = m.tabs.filter((t) =>
          (FRONT_DESK_MONEY_TAB_HREFS as readonly string[]).includes(t.href),
        );
        if (tabs.length === 0) return null;
        return {
          ...m,
          href: tabs[0]?.href ?? m.href,
          tabs,
          title: "Desk money",
        };
      })
      .filter((m): m is ErpModule => m != null);
  } else {
    const keySet = new Set<string>(BACK_OFFICE_MODULE_KEYS);
    scoped = withoutHotel
      .filter((m) => keySet.has(m.key))
      .map((m) => ({ ...m, tabs: [...m.tabs] }));
  }

  return filterErpNavByGrants(scoped, grants ?? null);
}

export function parseWorkspaceCookie(
  cookieHeader: string | null | undefined,
): DeskWorkspace | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${DESK_WORKSPACE_COOKIE}=([^;]*)`),
  );
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isDeskWorkspace(raw) ? raw : null;
}
