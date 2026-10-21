/** Work tabs on the reservations desk. Default is today's in-house list. */

import { DUE_CHECK_IN_STATUSES, dueStayOpenOr } from "@/lib/erp/due-check-in";

export type ReservationView =
  | "in_house"
  | "departures"
  | "arrivals"
  | "upcoming"
  | "all";

export function parseReservationView(
  raw: string | null | undefined,
): ReservationView {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "departures" || v === "checkout" || v === "check_out") {
    return "departures";
  }
  if (v === "arrivals" || v === "arrival" || v === "check_in") return "arrivals";
  if (v === "upcoming") return "upcoming";
  if (v === "all") return "all";
  return "in_house";
}

/** Day, due-through-today, and upcoming slices. `all` leaves status and dates to the caller. */
export function applyReservationView(
  // Supabase's filter builder instantiates too deeply through a generic constraint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  view: ReservationView,
  today: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (view === "in_house") {
    return query
      .eq("status", "checked_in")
      .lte("check_in", today)
      .gt("check_out", today);
  }
  if (view === "departures") {
    return query.eq("check_out", today).eq("status", "checked_in");
  }
  if (view === "arrivals") {
    return query
      .lte("check_in", today)
      .or(dueStayOpenOr(today))
      .in("status", [...DUE_CHECK_IN_STATUSES]);
  }
  if (view === "upcoming") {
    return query
      .gt("check_in", today)
      .in("status", ["held", "pending", "confirmed"]);
  }
  return query;
}
