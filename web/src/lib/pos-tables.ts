/**
 * Client-safe dining-table constants.
 *
 * `@/lib/pos` depends on `next/headers`, so client components must not import
 * runtime values from it. Anything both the server loaders and the POS client
 * components need at runtime lives here instead.
 */

export const TABLE_STATUS_VALUES = [
  "free",
  "occupied",
  "reserved",
  "dirty",
] as const;

export type TableStatus = (typeof TABLE_STATUS_VALUES)[number];

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  free: "Free",
  occupied: "Occupied",
  reserved: "Reserved",
  dirty: "Needs clearing",
};
