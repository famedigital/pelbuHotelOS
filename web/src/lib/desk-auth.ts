import { cookies } from "next/headers";

const COOKIE = "pelbu_desk_session";

export function deskPinConfigured(): boolean {
  return Boolean(process.env.DESK_PIN?.trim());
}

export function verifyDeskPin(pin: string): boolean {
  const expected = process.env.DESK_PIN?.trim();
  if (!expected) return false;
  return pin.trim() === expected;
}

/** Shared DESK_PIN cookie only (not staff Auth). */
export async function hasDeskPinSession(): Promise<boolean> {
  if (!deskPinConfigured()) {
    // Dev-friendly: allow inbox when pin not set (local only warning in UI).
    return process.env.NODE_ENV !== "production";
  }
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const expected = process.env.DESK_PIN?.trim();
  return Boolean(token && expected && token === `ok:${expected}`);
}

/**
 * Desk / Work access: shared DESK_PIN session OR staff Auth with
 * `staff_members.can_access_desk`. Call sites keep using this helper.
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

export function deskCookieValue(pin: string): string {
  return `ok:${pin.trim()}`;
}

export { COOKIE as DESK_COOKIE_NAME };
