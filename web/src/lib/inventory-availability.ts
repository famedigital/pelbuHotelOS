import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type InventoryBookingRow = {
  id: string;
  status: string;
  check_in: string;
  check_out: string;
  hold_expires_at: string | null;
  booking_rooms?: { qty: number; room_type_id: string }[] | null;
};

/**
 * Date-overlap test for half-open stay intervals. A stay [checkIn, checkOut)
 * overlaps another [otherIn, otherOut) only when each starts before the other
 * ends. Adjacent stays (one ending on the other's check-in day) do NOT overlap.
 */
export function staysOverlap(
  checkIn: string,
  checkOut: string,
  otherIn: string,
  otherOut: string,
): boolean {
  return checkIn < otherOut && otherIn < checkOut;
}

/**
 * Whether a single booking still commits inventory at the given moment.
 *
 * Confirmed and checked-in bookings always count. A held booking counts only
 * while its hold TTL is still in the future — once `hold_expires_at` has
 * passed the rooms are treat as released, even before the expire-holds job has
 * flipped the status to `expired`. This keeps availability correct under
 * daily-only Hobby Vercel Cron and during any scheduler outage.
 */
export function bookingCommitsInventory(
  row: Pick<InventoryBookingRow, "status" | "hold_expires_at">,
  now: Date,
): boolean {
  if (row.status === "confirmed" || row.status === "checked_in") return true;
  if (row.status === "held") {
    const exp = row.hold_expires_at;
    if (!exp) return false;
    return new Date(exp).getTime() > now.getTime();
  }
  return false;
}

/**
 * Sum sellable room quantities from a set of bookings into a per-room-type map.
 * Pure helper extracted so it can be tested without a database; the live query
 * path is `soldQtyByRoomType` below.
 */
export function sumBookedRoomsByType(
  bookings: InventoryBookingRow[],
  now: Date = new Date(),
): Map<string, number> {
  const used = new Map<string, number>();
  for (const booking of bookings) {
    if (!bookingCommitsInventory(booking, now)) continue;
    for (const line of booking.booking_rooms ?? []) {
      used.set(
        line.room_type_id,
        (used.get(line.room_type_id) ?? 0) + Number(line.qty),
      );
    }
  }
  return used;
}

/**
 * Rooms already committed for overlapping active bookings (overbooking guard).
 *
 * Held bookings only count toward inventory while their hold TTL is still live;
 * expired holds are filtered at read time so availability is correct even
 * before the expire-holds cleanup job runs.
 */
export async function soldQtyByRoomType(
  admin: Admin,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
): Promise<Map<string, number>> {
  const nowIso = new Date().toISOString();

  // Confirmed + checked-in always count.
  let firmQuery = admin
    .from("bookings")
    .select("id, booking_rooms(qty, room_type_id)")
    .eq("property_id", propertyId)
    .in("status", ["confirmed", "checked_in"])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if (excludeBookingId) {
    firmQuery = firmQuery.neq("id", excludeBookingId);
  }

  // Held bookings count only while their hold is still live.
  let heldQuery = admin
    .from("bookings")
    .select("id, booking_rooms(qty, room_type_id)")
    .eq("property_id", propertyId)
    .eq("status", "held")
    .gt("hold_expires_at", nowIso)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if (excludeBookingId) {
    heldQuery = heldQuery.neq("id", excludeBookingId);
  }

  const [firmRes, heldRes] = await Promise.all([firmQuery, heldQuery]);

  const used = new Map<string, number>();
  for (const booking of [...(firmRes.data ?? []), ...(heldRes.data ?? [])]) {
    const lines = (booking.booking_rooms ?? []) as {
      qty: number;
      room_type_id: string;
    }[];
    for (const line of lines) {
      used.set(
        line.room_type_id,
        (used.get(line.room_type_id) ?? 0) + Number(line.qty),
      );
    }
  }
  return used;
}

/** Remaining sellable units per room type for a date window. */
export async function availabilityByRoomType(
  admin: Admin,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<
  { roomTypeId: string; code: string; capacity: number; remaining: number }[]
> {
  const { data: types } = await admin
    .from("room_types")
    .select("id, code, unit_count")
    .eq("property_id", propertyId);

  const sold = await soldQtyByRoomType(admin, propertyId, checkIn, checkOut);
  return (types ?? []).map((t) => {
    const capacity = Number(t.unit_count ?? 0);
    const used = sold.get(t.id as string) ?? 0;
    return {
      roomTypeId: t.id as string,
      code: t.code as string,
      capacity,
      remaining: Math.max(capacity - used, 0),
    };
  });
}
