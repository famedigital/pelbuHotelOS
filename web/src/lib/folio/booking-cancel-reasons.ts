/**
 * Desk cancel reasons for reservations (soft cancel → bookings.status = cancelled).
 * Stored in bookings.cancel_reason as "Label · detail" (text column, no enum migration).
 */

export const BOOKING_CANCEL_REASON_CODES = [
  "guest_cancelled",
  "agent_cancelled",
  "duplicate",
  "dates_changed",
  "rate_issue",
  "no_inventory",
  "clerical_error",
  "other",
] as const;

export type BookingCancelReasonCode =
  (typeof BOOKING_CANCEL_REASON_CODES)[number];

export const BOOKING_CANCEL_REASON_LABELS: Record<
  BookingCancelReasonCode,
  string
> = {
  guest_cancelled: "Guest cancelled",
  agent_cancelled: "Agent / tour cancelled",
  duplicate: "Duplicate booking",
  dates_changed: "Dates / room rebooked",
  rate_issue: "Rate / commercial issue",
  no_inventory: "No inventory / overbook",
  clerical_error: "Clerical error",
  other: "Other",
};

export function isBookingCancelReasonCode(
  v: string | null | undefined,
): v is BookingCancelReasonCode {
  return Boolean(
    v &&
      (BOOKING_CANCEL_REASON_CODES as readonly string[]).includes(v),
  );
}

/** Persist value for bookings.cancel_reason + audit summary. */
export function formatBookingCancelReason(
  code: BookingCancelReasonCode,
  detail?: string | null,
): string {
  const label = BOOKING_CANCEL_REASON_LABELS[code];
  const note = detail?.trim();
  if (code === "other") {
    return note ? `Other · ${note}` : "Other";
  }
  return note ? `${label} · ${note}` : label;
}
