import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

export type BookingRoomLine = {
  room_type_id: string;
  qty: number;
  inventory_kind: string;
};

export type CheckInRoomUnit = {
  id: string;
  label: string;
  floorLabel: string | null;
  hkStatus: string;
  roomTypeId: string;
  roomTypeName: string;
  inventoryKind: string;
  available: boolean;
  blocked: boolean;
  reason?: string;
};

export type CheckInAssignmentSlot = {
  key: string;
  roomTypeId: string;
  roomTypeName: string;
  inventoryKind: string;
  index: number;
  /** Currently assigned unit for this slot, if any. */
  assignedUnitId: string | null;
  assignedLabel: string | null;
};

function rangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return aFrom < bTo && bFrom < aTo;
}

const ASSIGNABLE_KINDS = new Set([
  "sellable_guest",
  "guide_comp",
  "driver_comp",
]);

/** Exported for unit tests — half-open [from, to) date ranges. */
export function stayRangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return rangesOverlap(aFrom, aTo, bFrom, bTo);
}

/** Guest sellable rooms must be clean/inspect/occupied; comps skip HK gate. */
export function unitReadyForCheckIn(
  inventoryKind: string,
  hkStatus: string,
  requireClean: boolean,
): boolean {
  if (!requireClean) return true;
  if (inventoryKind !== "sellable_guest") return true;
  return ["clean", "inspect", "occupied"].includes(hkStatus);
}

export function isAssignableInventoryKind(kind: string): boolean {
  return ASSIGNABLE_KINDS.has(kind);
}

/**
 * Packs a booking onto free physical room_units for [checkIn, checkOut).
 * Assigns sellable guest rooms and guide/driver complimentary beds.
 * preferredUnitIds are tried first (calendar drag selection), then preferredUnitId.
 */
export async function assignRoomsForBooking(
  admin: Admin,
  args: {
    propertyId: string;
    bookingId: string;
    checkIn: string;
    checkOut: string;
    lines: BookingRoomLine[];
    preferredUnitId?: string | null;
    preferredUnitIds?: string[] | null;
  },
): Promise<{ assigned: number; shortfall: number }> {
  const { propertyId, bookingId, checkIn, checkOut } = args;
  const preferredIds = [
    ...(args.preferredUnitIds ?? []),
    ...(args.preferredUnitId ? [args.preferredUnitId] : []),
  ].filter(Boolean);

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return { assigned: 0, shortfall: 0 };
  }

  const demandByType = new Map<string, number>();
  for (const line of args.lines) {
    if (!ASSIGNABLE_KINDS.has(line.inventory_kind) || line.qty <= 0) continue;
    demandByType.set(
      line.room_type_id,
      (demandByType.get(line.room_type_id) ?? 0) + line.qty,
    );
  }
  if (demandByType.size === 0) return { assigned: 0, shortfall: 0 };

  const { data: lockedRows } = await admin
    .from("room_assignments")
    .select("room_unit_id, room_units(room_type_id)")
    .eq("booking_id", bookingId)
    .eq("is_locked", true);

  await admin
    .from("room_assignments")
    .delete()
    .eq("booking_id", bookingId)
    .eq("is_locked", false);

  const lockedByType = new Map<string, number>();
  for (const row of lockedRows ?? []) {
    const rawUnit = row.room_units as
      | { room_type_id?: string }
      | { room_type_id?: string }[]
      | null;
    const unit = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
    if (!unit?.room_type_id) continue;
    lockedByType.set(
      unit.room_type_id,
      (lockedByType.get(unit.room_type_id) ?? 0) + 1,
    );
  }

  const typeIds = [...demandByType.keys()];
  const [{ data: units }, { data: busy }] = await Promise.all([
    admin
      .from("room_units")
      .select("id, room_type_id, sort_order, label")
      .eq("property_id", propertyId)
      .in("room_type_id", typeIds)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    admin
      .from("room_assignments")
      .select("room_unit_id, from_date, to_date")
      .eq("property_id", propertyId)
      .lt("from_date", checkOut)
      .gt("to_date", checkIn),
  ]);

  const occupied = new Set<string>();
  for (const row of busy ?? []) {
    if (
      rangesOverlap(
        checkIn,
        checkOut,
        row.from_date as string,
        row.to_date as string,
      )
    ) {
      occupied.add(row.room_unit_id as string);
    }
  }

  const byType = new Map<string, { id: string }[]>();
  for (const u of units ?? []) {
    const list = byType.get(u.room_type_id as string) ?? [];
    list.push({ id: u.id as string });
    byType.set(u.room_type_id as string, list);
  }

  const inserts: Array<{
    property_id: string;
    booking_id: string;
    room_unit_id: string;
    from_date: string;
    to_date: string;
  }> = [];
  let shortfall = 0;

  for (const [roomTypeId, demand] of demandByType) {
    const needed = Math.max(0, demand - (lockedByType.get(roomTypeId) ?? 0));
    const pool = (byType.get(roomTypeId) ?? []).filter(
      (u) => !occupied.has(u.id),
    );
    for (let p = preferredIds.length - 1; p >= 0; p--) {
      const prefIdx = pool.findIndex((u) => u.id === preferredIds[p]);
      if (prefIdx > 0) {
        const [pref] = pool.splice(prefIdx, 1);
        pool.unshift(pref);
      }
    }
    const take = Math.min(needed, pool.length);
    shortfall += Math.max(0, needed - take);
    for (let i = 0; i < take; i++) {
      const unitId = pool[i].id;
      occupied.add(unitId);
      inserts.push({
        property_id: propertyId,
        booking_id: bookingId,
        room_unit_id: unitId,
        from_date: checkIn,
        to_date: checkOut,
      });
    }
  }

  if (inserts.length) {
    const { error } = await admin.from("room_assignments").insert(inserts);
    if (error) {
      console.error("room_assignments insert failed", error);
      throw new Error("Could not assign physical rooms for this stay.");
    }
  }

  return {
    assigned: (lockedRows?.length ?? 0) + inserts.length,
    shortfall,
  };
}

/**
 * Build per-line assignment slots + available units for the check-in UI.
 */
export async function loadCheckInRoomOptions(
  admin: Admin,
  args: {
    propertyId: string;
    bookingId: string;
    checkIn: string;
    checkOut: string;
    lines: Array<{
      room_type_id: string;
      qty: number;
      inventory_kind: string;
      room_types?: { name: string; code: string } | null;
    }>;
  },
): Promise<{
  slots: CheckInAssignmentSlot[];
  units: CheckInRoomUnit[];
}> {
  const { propertyId, bookingId, checkIn, checkOut, lines } = args;
  const typeIds = [
    ...new Set(
      lines
        .filter((l) => ASSIGNABLE_KINDS.has(l.inventory_kind) && l.qty > 0)
        .map((l) => l.room_type_id),
    ),
  ];

  if (typeIds.length === 0) {
    return { slots: [], units: [] };
  }

  const [{ data: units }, { data: busy }, { data: blocks }, { data: current }] =
    await Promise.all([
      admin
        .from("room_units")
        .select(
          "id, label, floor_label, hk_status, room_type_id, sort_order, room_types(name, code, inventory_kind)",
        )
        .eq("property_id", propertyId)
        .in("room_type_id", typeIds)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true }),
      admin
        .from("room_assignments")
        .select("room_unit_id, booking_id, from_date, to_date")
        .eq("property_id", propertyId)
        .lt("from_date", checkOut)
        .gt("to_date", checkIn),
      admin
        .from("room_blocks")
        .select("room_unit_id, from_date, to_date, block_kind")
        .eq("property_id", propertyId)
        .is("released_at", null)
        .lt("from_date", checkOut)
        .gt("to_date", checkIn),
      admin
        .from("room_assignments")
        .select(
          "id, room_unit_id, room_units(id, label, room_type_id, room_types(inventory_kind, name))",
        )
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true }),
    ]);

  const busyOther = new Set<string>();
  for (const row of busy ?? []) {
    if ((row.booking_id as string) === bookingId) continue;
    if (
      rangesOverlap(
        checkIn,
        checkOut,
        row.from_date as string,
        row.to_date as string,
      )
    ) {
      busyOther.add(row.room_unit_id as string);
    }
  }

  const blocked = new Map<string, string>();
  for (const row of blocks ?? []) {
    if (
      rangesOverlap(
        checkIn,
        checkOut,
        row.from_date as string,
        row.to_date as string,
      )
    ) {
      blocked.set(
        row.room_unit_id as string,
        String(row.block_kind ?? "blocked").toUpperCase(),
      );
    }
  }

  const unitList: CheckInRoomUnit[] = (units ?? []).map((u) => {
    const rt = (
      Array.isArray(u.room_types) ? u.room_types[0] : u.room_types
    ) as {
      name?: string;
      code?: string;
      inventory_kind?: string;
    } | null;
    const id = u.id as string;
    const hk = u.hk_status as string;
    const isBlocked = blocked.has(id);
    const isBusy = busyOther.has(id);
    const ready = unitReadyForCheckIn(
      rt?.inventory_kind ?? "sellable_guest",
      hk,
      true,
    );
    let reason: string | undefined;
    if (isBlocked) reason = blocked.get(id);
    else if (isBusy) reason = "Occupied";
    else if (!ready) reason = hk;
    return {
      id,
      label: u.label as string,
      floorLabel: (u.floor_label as string | null) ?? null,
      hkStatus: hk,
      roomTypeId: u.room_type_id as string,
      roomTypeName: rt?.name ?? rt?.code ?? "Room",
      inventoryKind: rt?.inventory_kind ?? "sellable_guest",
      available: !isBlocked && !isBusy && ready,
      blocked: isBlocked,
      reason,
    };
  });

  // Current assignments for preselect, grouped by type+kind in order
  const currentByKey = new Map<string, Array<{ unitId: string; label: string }>>();
  for (const row of current ?? []) {
    const rawUnit = Array.isArray(row.room_units)
      ? row.room_units[0]
      : row.room_units;
    const unit = rawUnit as {
      id?: string;
      label?: string;
      room_type_id?: string;
      room_types?:
        | { inventory_kind?: string; name?: string }
        | { inventory_kind?: string; name?: string }[]
        | null;
    } | null;
    if (!unit?.id || !unit.room_type_id) continue;
    const rt = Array.isArray(unit.room_types)
      ? unit.room_types[0]
      : unit.room_types;
    const kind = rt?.inventory_kind ?? "sellable_guest";
    const key = `${unit.room_type_id}:${kind}`;
    const list = currentByKey.get(key) ?? [];
    list.push({ unitId: unit.id, label: unit.label ?? unit.id });
    currentByKey.set(key, list);
  }

  const slots: CheckInAssignmentSlot[] = [];
  for (const line of lines) {
    if (!ASSIGNABLE_KINDS.has(line.inventory_kind) || line.qty <= 0) continue;
    const key = `${line.room_type_id}:${line.inventory_kind}`;
    const assigned = currentByKey.get(key) ?? [];
    const typeName =
      line.room_types?.name ??
      unitList.find((u) => u.roomTypeId === line.room_type_id)?.roomTypeName ??
      line.inventory_kind;
    for (let i = 0; i < line.qty; i++) {
      const pref = assigned[i];
      slots.push({
        key: `${key}:${i}`,
        roomTypeId: line.room_type_id,
        roomTypeName: typeName,
        inventoryKind: line.inventory_kind,
        index: i,
        assignedUnitId: pref?.unitId ?? null,
        assignedLabel: pref?.label ?? null,
      });
    }
  }

  return { slots, units: unitList };
}

/**
 * Backfill assignments for active bookings in a date window that lack them.
 * Safe to call on calendar page load.
 */
export async function ensureAssignmentsInWindow(
  admin: Admin,
  propertyId: string,
  windowStart: string,
  windowEndExclusive: string,
): Promise<void> {
  const { data: bookings } = await admin
    .from("bookings")
    .select(
      "id, check_in, check_out, booking_rooms(room_type_id, qty, inventory_kind)",
    )
    .eq("property_id", propertyId)
    .lt("check_in", windowEndExclusive)
    .gt("check_out", windowStart)
    .in("status", ["held", "pending", "confirmed", "checked_in"])
    .limit(300);

  if (!bookings?.length) return;

  const bookingIds = bookings.map((b) => b.id as string);
  const { data: existing } = await admin
    .from("room_assignments")
    .select("booking_id")
    .in("booking_id", bookingIds);

  const hasAssign = new Set(
    (existing ?? []).map((r) => r.booking_id as string),
  );

  for (const b of bookings) {
    if (hasAssign.has(b.id as string)) continue;
    const lines = (b.booking_rooms as BookingRoomLine[] | null) ?? [];
    try {
      await assignRoomsForBooking(admin, {
        propertyId,
        bookingId: b.id as string,
        checkIn: b.check_in as string,
        checkOut: b.check_out as string,
        lines,
      });
    } catch (e) {
      console.error("ensureAssignmentsInWindow failed", b.id, e);
    }
  }
}
