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

export async function isDeskAuthenticated(): Promise<boolean> {
  if (!deskPinConfigured()) {
    // Dev-friendly: allow inbox when pin not set (local only warning in UI).
    return process.env.NODE_ENV !== "production";
  }
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const expected = process.env.DESK_PIN?.trim();
  return Boolean(token && expected && token === `ok:${expected}`);
}

export function deskCookieValue(pin: string): string {
  return `ok:${pin.trim()}`;
}

export { COOKIE as DESK_COOKIE_NAME };
