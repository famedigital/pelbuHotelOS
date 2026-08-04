import type { DeskRole } from "@/lib/desk-auth";
import { ERP_MODULES, resolveModule } from "@/lib/erp-nav";

/** Keys match `ERP_MODULES[].key`. */
export const DESK_MODULE_CATALOG = ERP_MODULES.map((m) => ({
  key: m.key,
  title: m.title,
})) as ReadonlyArray<{ key: string; title: string }>;

export const DESK_MODULE_KEYS = DESK_MODULE_CATALOG.map((m) => m.key);

export type DeskModuleKey = (typeof DESK_MODULE_KEYS)[number];

const KEY_SET = new Set(DESK_MODULE_KEYS);

export function isDeskModuleKey(raw: string): boolean {
  return KEY_SET.has(raw);
}

export function allDeskModuleKeys(): string[] {
  return [...DESK_MODULE_KEYS];
}

/**
 * Role defaults when `staff_members.desk_module_keys` is NULL.
 * Owner/GM get everything; departments get a short ops set.
 */
export function defaultModulesForDeskRole(
  role: DeskRole | null | undefined,
): string[] {
  switch (role) {
    case "owner":
    case "gm":
      return allDeskModuleKeys();
    case "cashier":
      return ["dashboard", "pos", "money"];
    case "fnb":
    case "kitchen":
      return ["dashboard", "pos"];
    case "hk":
    case "laundry":
      return ["dashboard", "rooms"];
    case "front_desk":
    default:
      return ["dashboard", "calendar", "front-desk", "rooms", "money"];
  }
}

/**
 * Resolve visible modules for a desk session.
 * Owner / GM (and PIN → gm) always get the full catalog.
 * Non-null stored keys are an explicit allowlist (must still be catalog keys).
 * NULL keys → role defaults.
 */
export function resolveDeskModules(opts: {
  deskRole: DeskRole | null | undefined;
  deskModuleKeys: string[] | null | undefined;
}): string[] {
  const role = opts.deskRole ?? null;
  if (role === "owner" || role === "gm") {
    return allDeskModuleKeys();
  }

  const raw = opts.deskModuleKeys;
  if (raw != null) {
    const cleaned = [
      ...new Set(
        raw
          .map((k) => k.trim())
          .filter((k) => isDeskModuleKey(k)),
      ),
    ];
    if (!cleaned.includes("dashboard")) {
      cleaned.unshift("dashboard");
    }
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

/**
 * Soft product ACL for deep links. Unmapped routes stay allowed so ad-hoc
 * screens (check-in, folio detail) are not hard-blocked by partial nav maps.
 */
export function pathnameAllowedForModules(
  pathname: string | null | undefined,
  moduleKeys: readonly string[],
): boolean {
  if (!pathname) return true;
  if (pathname === "/erp" || pathname === "/erp/") return true;
  if (pathname === "/erp/login" || pathname.startsWith("/erp/login"))
    return true;
  // Wall displays / print sheets are shell-free; never block.
  if (
    pathname === "/erp/kds" ||
    pathname.startsWith("/erp/kds/") ||
    /\/print\/?$/.test(pathname) ||
    /\/receipt\/?$/.test(pathname) ||
    /\/statement\/?$/.test(pathname)
  ) {
    return true;
  }

  const match = resolveModule(pathname);
  if (!match) return true;
  return moduleKeys.includes(match.module.key);
}

export function filterModulesByKeys<T extends { key: string }>(
  modules: readonly T[],
  moduleKeys: readonly string[],
): T[] {
  const allow = new Set(moduleKeys);
  return modules.filter((m) => allow.has(m.key));
}
