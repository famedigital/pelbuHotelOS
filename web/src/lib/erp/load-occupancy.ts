import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addIsoDays,
  isOutOfOrder,
  occupancyByNight,
  occupancyKind,
  type OccupancyNight,
  type OccupancySpan,
  type OccupancyUnit,
} from "@/lib/erp/occupancy-nights";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadOccupancyNights(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<OccupancyNight[]> {
  const end = addIsoDays(to, 1);
  const [{ data: units }, { data: spans }] = await Promise.all([
    admin
      .from("room_units")
      .select("id, label, hk_status, room_types(name, code, inventory_kind)")
      .eq("property_id", propertyId)
      .order("label"),
    admin
      .from("room_assignments")
      .select("room_unit_id, from_date, to_date, bookings!inner(status)")
      .eq("property_id", propertyId)
      .lt("from_date", end)
      .gt("to_date", from),
  ]);

  const rooms: OccupancyUnit[] = (units ?? []).map((unit) => {
    const type = one(
      unit.room_types as
        | { name?: string; code?: string; inventory_kind?: string }
        | { name?: string; code?: string; inventory_kind?: string }[]
        | null,
    );
    const rawName = (type?.name || type?.code || "Room").replace(/_/g, " ");
    const typeName = rawName.replace(/\b\w/g, (letter) => letter.toUpperCase());
    return {
      id: unit.id as string,
      label: String(unit.label ?? ""),
      typeName,
      kind: occupancyKind(type?.inventory_kind),
      outOfOrder: isOutOfOrder(unit.hk_status as string | null),
    };
  });

  const open: OccupancySpan[] = [];
  for (const span of spans ?? []) {
    const booking = one(
      span.bookings as { status?: string } | { status?: string }[] | null,
    );
    const status = booking?.status ?? "";
    if (status === "cancelled" || status === "no_show" || status === "expired") continue;
    open.push({
      unitId: span.room_unit_id as string,
      from: String(span.from_date).slice(0, 10),
      to: String(span.to_date).slice(0, 10),
    });
  }
  return occupancyByNight(rooms, open, from, to);
}
