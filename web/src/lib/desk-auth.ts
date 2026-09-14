import { cookies } from "next/headers";
import { cache } from "react";

const COOKIE = "hotelos_desk_session";

export type DeskRole =
  | "front_desk"
  | "cashier"
  | "gm"
  | "hk"
  | "owner"
  | "fnb"
  | "kitchen"
  | "laundry";

/** Settle / void / drawer — not waiters or HK. */
export const MONEY_ROLES: ReadonlySet<DeskRole> = new Set([
  "cashier",
  "gm",
  "owner",
  "front_desk",
]);

/** Fire a ticket onto the kitchen TV (Send / unpark). Waiters yes; HK/laundry/cooks no. */
export const POS_FIRE_ROLES: ReadonlySet<DeskRole> = new Set([
  "cashier",
  "fnb",
  "front_desk",
  "gm",
  "owner",
]);

/** Operate kitchen / pass displays (bump KOT). Cooks + F&B + FO; not HK/laundry. */
export const KOT_BOARD_ROLES: ReadonlySet<DeskRole> = new Set([
  "kitchen",
  "fnb",
  "cashier",
  "front_desk",
  "gm",
  "owner",
]);

const ALL_DESK_ROLES: ReadonlySet<string> = new Set([
  "front_desk",
  "cashier",
  "gm",
  "hk",
  "owner",
  "fnb",
  "kitchen",
  "laundry",
]);

export function deskPinConfigured(): boolean {
  return Boolean(process.env.DESK_PIN?.trim());
}

/** Launch escape hatch — keep PIN until staff Auth is proven in prod. */
export function deskPinAllowedInProduction(): boolean {
  return process.env.ALLOW_DESK_PIN_IN_PROD === "1";
}

export function verifyDeskPin(pin: string): boolean {
  const expected = process.env.DESK_PIN?.trim();
  if (!expected) return false;
  return pin.trim() === expected;
}

/** Shared DESK_PIN cookie only (not staff Auth). */
export async function hasDeskPinSession(): Promise<boolean> {
  if (!deskPinConfigured()) {
    return process.env.NODE_ENV !== "production";
  }
  if (
    process.env.NODE_ENV === "production" &&
    !deskPinAllowedInProduction()
  ) {
    return false;
  }
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const expected = process.env.DESK_PIN?.trim();
  return Boolean(token && expected && token === `ok:${expected}`);
}

/**
 * Desk / Work access: shared DESK_PIN session (if allowed) OR staff Auth with
 * `staff_members.can_access_desk`.
 *
 * When property_policies.desk_restrict_to_scheduled_shifts is ON, non-management
 * staff also need a published staff_shifts window covering now (Thimphu).
 * Shared DESK_PIN and Owner/GM always bypass the shift rule.
 */
export async function isDeskAuthenticated(): Promise<boolean> {
  if (await hasDeskPinSession()) return true;

  try {
    const jar = await cookies();
    const supportProp = jar.get("hotelos_support_property")?.value;
    if (supportProp) {
      const { createSupabaseServerClient } = await import(
        "@/lib/supabase/server"
      );
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) return true;
    }
  } catch {
    // ignore
  }

  try {
    const { getStaffSession } = await import("@/lib/staff-auth");
    const staff = await getStaffSession();
    if (!staff?.canAccessDesk) return false;

    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const { staffSessionSatisfiesDeskShift } = await import(
      "@/lib/desk-shift-gate"
    );
    const gate = await staffSessionSatisfiesDeskShift(
      createSupabaseAdminClient(),
      staff,
    );
    return gate.ok;
  } catch {
    return false;
  }
}

/** Normalize free-text desk_role values to a known enum. */
export function normalizeDeskRole(
  role: string | null | undefined,
): DeskRole | null {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return null;
  if (r === "manager") return "gm";
  if (r === "housekeeping") return "hk";
  if (r === "f&b" || r === "f_and_b" || r === "food_beverage") return "fnb";
  if (ALL_DESK_ROLES.has(r)) return r as DeskRole;
  return null;
}

/** When desk_role is empty, map HR department → dashboard role. */
export function mapDepartmentToDeskRole(
  department: string | null | undefined,
): DeskRole | null {
  const d = (department ?? "").trim().toLowerCase();
  if (!d) return null;
  if (d === "fnb" || d === "f&b" || d.includes("food") || d.includes("bar"))
    return "fnb";
  if (d === "kitchen" || d.includes("cook") || d.includes("chef"))
    return "kitchen";
  if (d === "laundry") return "laundry";
  if (d === "housekeeping" || d === "hk") return "hk";
  if (d === "front_desk" || d === "reception" || d === "fo")
    return "front_desk";
  if (d === "manager" || d === "gm") return "gm";
  return null;
}

/**
 * Resolve desk RBAC role for the current session.
 * PIN sessions act as `gm` (full desk) when allowed.
 */
export async function getDeskRole(): Promise<DeskRole | null> {
  return getDeskRoleCached();
}

const getDeskRoleCached = cache(async (): Promise<DeskRole | null> => {
  if (await hasDeskPinSession()) return "gm";
  try {
    const { getStaffSession } = await import("@/lib/staff-auth");
    const staff = await getStaffSession();
    if (!staff?.canAccessDesk) return null;
    return (
      normalizeDeskRole(staff.deskRole) ??
      mapDepartmentToDeskRole(staff.department) ??
      mapAccessLevelToDeskRole(staff.accessLevel)
    );
  } catch {
    return null;
  }
});

export function mapAccessLevelToDeskRole(
  accessLevel: string | null | undefined,
): DeskRole {
  const a = (accessLevel ?? "").toLowerCase();
  if (a === "owner" || a === "gm") return "owner";
  if (a === "hr_admin" || a === "supervisor") return "gm";
  if (a === "cashier") return "cashier";
  if (a === "hk" || a === "housekeeping") return "hk";
  if (a === "kitchen") return "kitchen";
  if (a === "fnb" || a === "f&b") return "fnb";
  if (a === "laundry") return "laundry";
  return "front_desk";
}

/** HK / laundry — must not be POS servers or fire tickets to the kitchen TV. */
export function isHouseOpsStaff(args: {
  deskRole?: string | null;
  department?: string | null;
  roleLabel?: string | null;
}): boolean {
  const role = normalizeDeskRole(args.deskRole);
  if (role === "hk" || role === "laundry") return true;
  const dept = (args.department ?? "").trim().toLowerCase();
  if (
    dept === "hk" ||
    dept === "housekeeping" ||
    dept.includes("laundry") ||
    dept.includes("housekeep")
  ) {
    return true;
  }
  const label = (args.roleLabel ?? "").trim().toLowerCase();
  if (
    label.includes("housekeep") ||
    label.includes("laundry") ||
    /\bmaid\b/.test(label)
  ) {
    return true;
  }
  return false;
}

export async function requireDeskRole(
  allowed: readonly DeskRole[],
): Promise<DeskRole> {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
  const role = await getDeskRole();
  if (!role || !allowed.includes(role)) {
    throw new Error("You do not have permission for this action.");
  }
  return role;
}

/** Money paths: cashier, front_desk, gm, owner (not hk/kitchen/fnb-only). */
export async function requireMoneyDesk(): Promise<DeskRole> {
  return requireDeskRole([...MONEY_ROLES]);
}

export function isPosFireRole(role: DeskRole | null | undefined): boolean {
  return role != null && POS_FIRE_ROLES.has(role);
}

export function isKotBoardRole(role: DeskRole | null | undefined): boolean {
  return role != null && KOT_BOARD_ROLES.has(role);
}

/** Send / park / unpark POS tickets that appear on the kitchen display. */
export async function requirePosFireDesk(): Promise<DeskRole> {
  try {
    return await requireDeskRole([...POS_FIRE_ROLES]);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === "You do not have permission for this action."
    ) {
      throw new Error(
        "Only F&B, cashier, and front desk can send tickets to the kitchen display.",
      );
    }
    throw err;
  }
}

/** Bump KOT on kitchen / pass TV (not housekeeping or laundry). */
export async function requireKotBoardDesk(): Promise<DeskRole> {
  try {
    return await requireDeskRole([...KOT_BOARD_ROLES]);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === "You do not have permission for this action."
    ) {
      throw new Error(
        "Housekeeping and laundry cannot operate the kitchen display.",
      );
    }
    throw err;
  }
}

/**
 * Module allowlist for the current desk session (nav + deep-link soft ACL).
 * PIN sessions (gm) receive the full catalog.
 */
export async function getDeskModuleKeys(): Promise<string[]> {
  return getDeskModuleKeysCached();
}

const getDeskModuleKeysCached = cache(async (): Promise<string[]> => {
  const { allDeskModuleKeys, resolveDeskModules } = await import(
    "@/lib/erp/desk-modules"
  );

  if (await hasDeskPinSession()) {
    return allDeskModuleKeys();
  }

  try {
    const { getStaffSession } = await import("@/lib/staff-auth");
    const staff = await getStaffSession();
    if (!staff?.canAccessDesk) return allDeskModuleKeys();
    const role =
      normalizeDeskRole(staff.deskRole) ??
      mapDepartmentToDeskRole(staff.department) ??
      mapAccessLevelToDeskRole(staff.accessLevel);
    return resolveDeskModules({
      deskRole: role,
      deskModuleKeys: staff.deskModuleKeys,
    });
  } catch {
    return allDeskModuleKeys();
  }
});

export function deskCookieValue(pin: string): string {
  return `ok:${pin.trim()}`;
}

export { COOKIE as DESK_COOKIE_NAME };
