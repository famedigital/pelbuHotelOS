/** Valid `staff_shifts.outlet` values — must match DB CHECK (see migration). */
export const SHIFT_OUTLETS = [
  "front_desk",
  "cafe",
  "pastry",
  "restaurant",
  "bar",
  "spa",
  "housekeeping",
  "maintenance",
  "security",
  "admin",
  "other",
] as const;

export type ShiftOutlet = (typeof SHIFT_OUTLETS)[number];

export const SHIFT_OUTLET_SET = new Set<string>(SHIFT_OUTLETS);

export function isShiftOutlet(value: string | null | undefined): value is ShiftOutlet {
  return value != null && SHIFT_OUTLET_SET.has(value);
}

export function formatShiftOutlet(outlet: string): string {
  return outlet.replace(/_/g, " ");
}

/** Map Postgres constraint failures to desk-friendly shift errors. */
export function shiftSaveErrorMessage(
  error: { code?: string; message?: string } | null,
  fallback: string,
): string {
  if (!error) return fallback;
  if (error.code === "23514" && error.message?.includes("outlet")) {
    return "That outlet is not allowed for shifts. Pick a section from the list or contact support if maintenance/security/admin is missing.";
  }
  if (error.message) {
    return `${fallback} ${error.message}`;
  }
  return fallback;
}
