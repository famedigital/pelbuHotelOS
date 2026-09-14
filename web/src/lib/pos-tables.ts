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
  "ordered",
  "billed",
  "reserved",
  "dirty",
] as const;

export type TableStatus = (typeof TABLE_STATUS_VALUES)[number];

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  free: "Free",
  occupied: "Seated",
  ordered: "Ordered",
  billed: "Billed",
  reserved: "Reserved",
  dirty: "Needs clearing",
};

/** Lifecycle hint for floor plan badges. */
export function tableLifecycleHint(status: TableStatus): string {
  switch (status) {
    case "free":
      return "Ready to seat";
    case "occupied":
      return "Guests seated · taking order";
    case "ordered":
      return "Order fired · cooking";
    case "billed":
      return "Bill printed · awaiting pay";
    case "reserved":
      return "Held for reservation";
    case "dirty":
      return "Clear & reset to free";
    default:
      return status;
  }
}
