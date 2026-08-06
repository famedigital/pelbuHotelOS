export type BookingRoomFit = "none" | "partial" | "full" | "n_a";

const CLOSED_STATUSES = new Set([
  "cancelled",
  "no_show",
  "checked_out",
]);

/** Live reservations that still need room inventory checked. */
const ACTIVE_ROOM_STATUSES = new Set([
  "held",
  "pending",
  "confirmed",
  "checked_in",
]);

export function roomsNeeded(rooms: number | null | undefined): number {
  return Math.max(1, Number(rooms ?? 1));
}

/**
 * PMS-style fit: compare units assigned vs sold qty for live bookings.
 * Closed statuses → n_a (show under status filters only).
 */
export function bookingRoomFit(input: {
  status: string | null | undefined;
  rooms: number | null | undefined;
  assignedCount: number;
}): BookingRoomFit {
  const status = (input.status ?? "").toLowerCase();
  if (CLOSED_STATUSES.has(status) || !ACTIVE_ROOM_STATUSES.has(status)) {
    return "n_a";
  }
  const needed = roomsNeeded(input.rooms);
  const assigned = Math.max(0, Number(input.assignedCount ?? 0));
  if (assigned <= 0) return "none";
  if (assigned < needed) return "partial";
  return "full";
}

/** Filter param `room` on /erp/reservations. */
export function matchesRoomFilter(
  fit: BookingRoomFit,
  roomParam: string | null | undefined,
): boolean {
  const room = (roomParam ?? "all").toLowerCase();
  if (!room || room === "all") return true;
  if (room === "needs_room") return fit === "none" || fit === "partial";
  if (room === "partial") return fit === "partial";
  if (room === "assigned") return fit === "full";
  return true;
}

export type ReservationSort =
  | "check_in_desc"
  | "check_in_asc"
  | "created_desc"
  | "name_asc"
  | "needs_room_first";

export function parseReservationSort(
  raw: string | null | undefined,
): ReservationSort {
  const v = (raw ?? "").toLowerCase();
  if (
    v === "check_in_asc" ||
    v === "created_desc" ||
    v === "name_asc" ||
    v === "needs_room_first"
  ) {
    return v;
  }
  return "check_in_desc";
}

const FIT_RANK: Record<BookingRoomFit, number> = {
  none: 0,
  partial: 1,
  full: 2,
  n_a: 3,
};

export function compareReservations(
  a: {
    check_in: string | null;
    contact_name: string | null;
    created_at?: string | null;
    room_fit?: BookingRoomFit;
  },
  b: {
    check_in: string | null;
    contact_name: string | null;
    created_at?: string | null;
    room_fit?: BookingRoomFit;
  },
  sort: ReservationSort,
): number {
  if (sort === "needs_room_first") {
    const ra = FIT_RANK[a.room_fit ?? "n_a"];
    const rb = FIT_RANK[b.room_fit ?? "n_a"];
    if (ra !== rb) return ra - rb;
    return (a.check_in ?? "").localeCompare(b.check_in ?? "");
  }
  if (sort === "check_in_asc") {
    return (a.check_in ?? "").localeCompare(b.check_in ?? "");
  }
  if (sort === "check_in_desc") {
    return (b.check_in ?? "").localeCompare(a.check_in ?? "");
  }
  if (sort === "created_desc") {
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  }
  // name_asc
  return (a.contact_name ?? "")
    .toLowerCase()
    .localeCompare((b.contact_name ?? "").toLowerCase());
}

/** Short FO label for list row. */
export function roomFitBadgeLabel(
  fit: BookingRoomFit,
  assigned: number,
  needed: number,
  labels: string,
): { label: string; tone: "ok" | "danger" | "warn" | "muted" } {
  if (fit === "full") {
    return {
      label: labels || "Rooms OK",
      tone: "ok",
    };
  }
  if (fit === "partial") {
    return {
      label: `Partial (${assigned}/${needed})`,
      tone: "warn",
    };
  }
  if (fit === "none") {
    return { label: "No room", tone: "danger" };
  }
  return {
    label: labels || "—",
    tone: "muted",
  };
}
