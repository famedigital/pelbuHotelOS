/** Bhutan hotel login codes: AAA (dzongkhag) + LL (area) + NNN (signup). */

export const HOTEL_CODE_PATTERN = /^[A-Z0-9]{6,8}$/;
export const LOGIN_HOTEL_CODE_COOKIE = "hotelos_login_hotel_code";
export const LOGIN_HOTEL_CODE_COOKIE_MAX_AGE = 60 * 60 * 8; // 8h

export function normalizeHotelCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidHotelCodeFormat(code: string): boolean {
  return HOTEL_CODE_PATTERN.test(code);
}

export function buildHotelCode(
  dzongkhagCode: string,
  areaCode: string,
  sequence: number,
): string {
  const d = dzongkhagCode.trim().toUpperCase();
  const a = areaCode.trim().padStart(2, "0");
  if (!/^[A-Z]{3}$/.test(d)) throw new Error("Dzongkhag code must be 3 letters.");
  if (!/^[0-9]{2}$/.test(a)) throw new Error("Area code must be 2 digits.");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new Error("Signup sequence must be 1–999.");
  }
  return `${d}${a}${String(sequence).padStart(3, "0")}`;
}

export function parseHotelCode(code: string): {
  dzongkhagCode: string;
  areaCode: string;
  sequence: number;
} | null {
  const c = normalizeHotelCodeInput(code);
  if (c.length !== 8) return null;
  const dzongkhagCode = c.slice(0, 3);
  const areaCode = c.slice(3, 5);
  const sequence = Number(c.slice(5, 8));
  if (!/^[A-Z]{3}$/.test(dzongkhagCode)) return null;
  if (!/^[0-9]{2}$/.test(areaCode)) return null;
  if (!Number.isInteger(sequence) || sequence < 1) return null;
  return { dzongkhagCode, areaCode, sequence };
}

/** Next free NNN for a dzongkhag+area prefix among properties.hotel_code. */
export async function nextHotelCodeSequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (table: string) => any },
  dzongkhagCode: string,
  areaCode: string,
): Promise<number> {
  const prefix = `${dzongkhagCode.trim().toUpperCase()}${areaCode.trim().padStart(2, "0")}`;
  const { data } = await admin
    .from("properties")
    .select("hotel_code")
    .like("hotel_code", `${prefix}%`);

  let max = 0;
  for (const row of (data ?? []) as Array<{ hotel_code: string | null }>) {
    const code = row.hotel_code ?? "";
    if (code.length === 8 && code.startsWith(prefix)) {
      const n = Number(code.slice(5, 8));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}
