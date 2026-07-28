import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Rooms already sold for overlapping active bookings (overbooking guard). */
export async function soldQtyByRoomType(
  admin: Admin,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
): Promise<Map<string, number>> {
  let query = admin
    .from("bookings")
    .select("id, booking_rooms(qty, room_type_id)")
    .eq("property_id", propertyId)
    .in("status", ["held", "confirmed", "checked_in"])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data } = await query;
  const used = new Map<string, number>();
  for (const booking of data ?? []) {
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
