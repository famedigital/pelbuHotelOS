import { cookies } from "next/headers";

const COOKIE = "pelbu_desk_session";

export type DeskRole = "front_desk" | "cashier" | "gm" | "hk" | "owner";

const MONEY_ROLES: ReadonlySet<DeskRole> = new Set([
  "cashier",
  "gm",
  "owner",
  "front_desk",
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
 */
export async function isDeskAuthenticated(): Promise<boolean> {
  if (await hasDeskPinSession()) return true;

  try {
    const { getStaffSession } = await import("@/lib/staff-auth");
    const staff = await getStaffSession();
    return Boolean(staff?.canAccessDesk);
  } catch {
    return false;
  }
}

/**
 * Resolve desk RBAC role for the current session.
 * PIN sessions act as `gm` (full desk) when allowed.
 */
export async function getDeskRole(): Promise<DeskRole | null> {
  if (await hasDeskPinSession()) return "gm";
  try {
    const { getStaffSession } = await import("@/lib/staff-auth");
    const staff = await getStaffSession();
    if (!staff?.canAccessDesk) return null;
    const role = (staff.deskRole ?? mapAccessLevelToDeskRole(staff.accessLevel)) as
      | DeskRole
      | null;
    return role;
  } catch {
    return null;
  }
}

export function mapAccessLevelToDeskRole(
  accessLevel: string | null | undefined,
): DeskRole {
  const a = (accessLevel ?? "").toLowerCase();
  if (a === "owner" || a === "gm") return "owner";
  if (a === "hr_admin" || a === "supervisor") return "gm";
  if (a === "cashier") return "cashier";
  if (a === "hk" || a === "housekeeping") return "hk";
  return "front_desk";
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

/** Money paths: cashier, front_desk, gm, owner (not hk-only). */
export async function requireMoneyDesk(): Promise<DeskRole> {
  return requireDeskRole([...MONEY_ROLES]);
}

export function deskCookieValue(pin: string): string {
  return `ok:${pin.trim()}`;
}

export { COOKIE as DESK_COOKIE_NAME };
