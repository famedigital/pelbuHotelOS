/**
 * Client-safe POS void reasons (no server-only deps).
 * Keep in sync with `pos_voids.reason_code` check constraint.
 */
export const POS_VOID_REASON_CODES = [
  "guest_change",
  "kitchen_error",
  "wrong_item",
  "comp",
  "manager_comp",
  "duplicate",
  "training",
  "other",
] as const;

export type PosVoidReasonCode = (typeof POS_VOID_REASON_CODES)[number];
