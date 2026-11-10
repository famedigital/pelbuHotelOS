import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";

/**
 * Housekeeping board. Real tables: room_units (hk_status CHECK: clean | dirty |
 * inspect | ooo | occupied), lost_found_items, maintenance_orders.
 */
export async function getHkBoard(ctx: AdapterCtx) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });

  const { data: rooms, error } = await ctx.admin
    .from("room_units")
    .select(
      "id, label, hk_status, floor_label, sort_order, room_types(name, inventory_kind)",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("sort_order")
    .order("label");
  if (error) throw error;

  // Who is in each room tonight (dated assignment overlapping today).
  const { data: occ, error: oErr } = await ctx.admin
    .from("room_assignments")
    .select("room_unit_id, booking_id, bookings(contact_name, status)")
    .eq("property_id", ctx.jwt.propertyId)
    .lte("from_date", today)
    .gt("to_date", today);
  if (oErr) throw oErr;
  const byRoom = new Map<string, { bookingId: string; guest: string | null; status: string | null }>();
  for (const a of occ ?? []) {
    const b = Array.isArray(a.bookings) ? a.bookings[0] : a.bookings;
    byRoom.set(a.room_unit_id as string, {
      bookingId: a.booking_id as string,
      guest: (b as { contact_name?: string } | null)?.contact_name ?? null,
      status: (b as { status?: string } | null)?.status ?? null,
    });
  }

  const [{ data: lost, error: lErr }, { data: maint, error: mErr }] =
    await Promise.all([
      ctx.admin
        .from("lost_found_items")
        .select("id, description, room_unit_id, status, guest_name, found_at, notes")
        .eq("property_id", ctx.jwt.propertyId)
        .eq("status", "open")
        .order("found_at", { ascending: false })
        .limit(30),
      ctx.admin
        .from("maintenance_orders")
        .select("id, title, description, room_unit_id, status, priority, created_at")
        .eq("property_id", ctx.jwt.propertyId)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
  if (lErr) throw lErr;
  if (mErr) throw mErr;

  return {
    rooms: (rooms ?? []).map((r) => ({
      ...r,
      housekeeping_status: r.hk_status,
      occupant: byRoom.get(r.id as string) ?? null,
    })),
    lostAndFound: (lost ?? []).map((x) => ({ ...x, item: x.description })),
    maintenance: maint ?? [],
  };
}

const hkSchema = z.object({
  roomUnitId: z.string().uuid(),
  status: z.enum(["clean", "dirty", "inspect", "ooo"]),
  idempotencyKey: z.string().min(8),
});

export async function updateHkStatus(ctx: AdapterCtx, raw: unknown) {
  const input = hkSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  // `occupied` is owned by check-in / checkout RPCs — never set by hand.
  const { data: unit, error: uErr } = await ctx.admin
    .from("room_units")
    .select("id, hk_status")
    .eq("id", input.roomUnitId)
    .eq("property_id", ctx.jwt.propertyId)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!unit) throw new Error("Room not found for property");
  if (unit.hk_status === "occupied") {
    throw new Error("Room is occupied — status changes at checkout");
  }

  const { error } = await ctx.admin
    .from("room_units")
    .update({ hk_status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.roomUnitId)
    .eq("property_id", ctx.jwt.propertyId);
  if (error) throw error;

  const result = { ok: true, roomUnitId: input.roomUnitId, status: input.status };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "hk_status",
    result,
  );
  return result;
}
