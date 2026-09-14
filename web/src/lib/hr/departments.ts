/** Sensible Pelbu hotel departments so a new property is not an empty list. */
export const DEFAULT_DEPARTMENTS = [
  "Front office",
  "Rooms",
  "Housekeeping",
  "F&B",
  "Kitchen",
  "Spa",
  "Security",
  "Maintenance",
  "Accounts",
  "Management",
  "Other",
] as const;

/**
 * Merge default hotel departments with property-used (and any session) values.
 * Keeps free-text column values; does not invent a DB enum.
 */
export function mergeDepartmentOptions(
  ...sources: Array<readonly string[] | string[] | null | undefined>
): string[] {
  const set = new Set<string>();
  for (const d of DEFAULT_DEPARTMENTS) {
    set.add(d);
  }
  for (const source of sources) {
    for (const raw of source ?? []) {
      const value = raw.trim();
      if (value) set.add(value);
    }
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
