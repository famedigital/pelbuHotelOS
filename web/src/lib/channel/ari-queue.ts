import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { availabilityByRoomType } from "@/lib/inventory-availability";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Enqueue availability ARI for each day in [from, to) — flushed when Channex credentials exist. */
export async function enqueueAvailabilityWindow(
  admin: Admin,
  propertyId: string,
  fromDate: string,
  toDateExclusive: string,
  reason: string,
): Promise<number> {
  const { data: conn } = await admin
    .from("channel_connections")
    .select("id, status")
    .eq("property_id", propertyId)
    .eq("provider", "channex")
    .maybeSingle();

  if (!conn || (conn.status as string) === "paused") {
    return 0;
  }

  const { data: maps } = await admin
    .from("channel_room_maps")
    .select("room_type_id, external_room_type_id")
    .eq("connection_id", conn.id)
    .eq("is_active", true);

  if (!maps?.length) {
    // Still queue a full_sync placeholder so desk sees pending work
    const { error } = await admin.from("ari_queue").insert({
      property_id: propertyId,
      connection_id: conn.id,
      kind: "full_sync",
      payload: {
        reason,
        from: fromDate,
        to: toDateExclusive,
        note: "No room maps yet — map room types before push.",
      },
    });
    if (error) {
      console.error("ari_queue insert failed", error);
      return 0;
    }
    return 1;
  }

  const values: {
    property_id: string;
    connection_id: string;
    date: string;
    room_type_id: string;
    external_room_type_id: string;
    availability: number;
  }[] = [];

  let cursor = fromDate;
  let guard = 0;
  while (cursor < toDateExclusive && guard < 400) {
    const next = addDays(cursor, 1);
    const avail = await availabilityByRoomType(admin, propertyId, cursor, next);
    for (const map of maps) {
      const row = avail.find((a) => a.roomTypeId === map.room_type_id);
      if (!row) continue;
      values.push({
        property_id: propertyId,
        connection_id: conn.id as string,
        date: cursor,
        room_type_id: map.room_type_id as string,
        external_room_type_id: map.external_room_type_id as string,
        availability: row.remaining,
      });
    }
    cursor = next;
    guard += 1;
  }

  if (values.length === 0) return 0;

  // Batch into ~60-day chunks (Channex prefers few large messages)
  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const { error } = await admin.from("ari_queue").insert({
      property_id: propertyId,
      connection_id: conn.id,
      kind: "availability",
      payload: {
        reason,
        values: chunk.map((v) => ({
          date: v.date,
          property_id: conn.id, // placeholder until external property mapped
          room_type_id: v.external_room_type_id,
          availability: v.availability,
        })),
        local: chunk,
      },
    });
    if (error) {
      console.error("ari_queue batch insert failed", error);
      continue;
    }
    inserted += 1;
  }
  return inserted;
}

export async function enqueueAfterBookingChange(
  admin: Admin,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  reason: string,
): Promise<void> {
  try {
    await enqueueAvailabilityWindow(admin, propertyId, checkIn, checkOut, reason);
  } catch (err) {
    console.error("enqueueAfterBookingChange failed", err);
  }
}
