"use client";

/**
 * Legacy POS form — superseded by the modular UI under
 * `components/erp/pos/` (PosLayout + MenuGrid + CartPanel + …).
 *
 * Kept as an inert stub so any in-flight imports still resolve until
 * Cursor confirms full removal. New POS UI is mounted directly in
 * `app/erp/pos/page.tsx`. Do not extend this file.
 */

export type { DeskBookingOption } from "@/components/erp/pos/types";

export function DeskPosForm() {
  if (process.env.NODE_ENV !== "production") {
    // Surface stale usage during local dev without breaking prod.
    // eslint-disable-next-line no-console
    console.warn(
      "DeskPosForm is deprecated — use components/erp/pos/PosLayout instead.",
    );
  }
  return null;
}
