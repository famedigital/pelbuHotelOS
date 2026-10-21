/** Reservations the desk still has to check in, through a calendar day. */

export const DUE_CHECK_IN_STATUSES = ["pending", "confirmed", "held"] as const;

export type DueCheckInStatus = (typeof DUE_CHECK_IN_STATUSES)[number];

function day(iso: string | null | undefined): string {
  return (iso ?? "").slice(0, 10);
}

export function isDueCheckInStatus(status: string | null | undefined): boolean {
  return (DUE_CHECK_IN_STATUSES as readonly string[]).includes(
    (status ?? "").toLowerCase(),
  );
}

/**
 * Still waiting to check in on `today`.
 * Includes the arrival date itself (day-use included) and earlier arrivals
 * whose departure is still after today. A stay that already ends today is a
 * departure, not a check-in.
 */
export function isDueToCheckIn(input: {
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  status: string | null | undefined;
  today: string;
}): boolean {
  if (!isDueCheckInStatus(input.status)) return false;
  const checkIn = day(input.checkIn);
  const checkOut = day(input.checkOut);
  const today = day(input.today);
  if (!checkIn || !today || checkIn > today) return false;
  if (checkOut > today) return true;
  return checkIn === today;
}

/** PostgREST `or` clause paired with `check_in <= today` and due statuses. */
export function dueStayOpenOr(today: string): string {
  const day = today.slice(0, 10);
  return `check_out.gt.${day},check_in.eq.${day}`;
}
