/** Pure phone helpers for in-house room verification (safe for unit tests). */

export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

/** Phone match: either ends-with the other (allow country code diffs). Min 7 digits. */
export function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (da.length < 7 || db.length < 7) return false;
  return da.endsWith(db) || db.endsWith(da);
}
