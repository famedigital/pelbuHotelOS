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

/** Pull preferred room numbers/labels from booking notes (eZee import, desk notes). */
export function extractPreferredRoomLabels(notes: string | null | undefined): string[] {
  if (!notes) return [];
  const found: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t || found.includes(t)) return;
    found.push(t);
  };
  // eZee import: "eZee room: 201"
  for (const m of notes.matchAll(/ezee\s*room\s*:\s*([A-Za-z0-9\-]+)/gi)) {
    push(m[1]);
  }
  // Free-text: "room 201", "#302", "rm:403"
  for (const m of notes.matchAll(
    /(?:\broom\b|\brm\b|#)\s*[:\-]?\s*([A-Za-z]?\d{2,4}[A-Za-z]?)/gi,
  )) {
    push(m[1]);
  }
  return found;
}

function unitMatchesPreferredLabel(
  unitLabel: string,
  preferred: string[],
): boolean {
  if (!preferred.length) return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const digits = (s: string) => s.replace(/\D/g, "");
  const ul = norm(unitLabel);
  const ud = digits(unitLabel);
  for (const p of preferred) {
    const pl = norm(p);
    const pd = digits(p);
    if (!pl) continue;
    if (ul === pl) return true;
    if (ul.endsWith(pl) || pl.endsWith(ul)) return true;
    if (pd && ud && pd === ud) return true;
  }
  return false;
}

/**
 * Packs a booking onto free physical room_units for [checkIn, checkOut).
 * Assigns sellable guest rooms and guide/driver complimentary beds.
 * preferredUnitIds are tried first (calendar drag selection), then preferredUnitId.
 * preferredLabels (e.g. eZee "201") match by unit label / trailing digits.
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
    preferredLabels?: string[] | null;
  },
): Promise<{ assigned: number; shortfall: number }> {
  const { propertyId, bookingId, checkIn, checkOut } = args;
  const preferredIds = [
    ...(args.preferredUnitIds ?? []),
    ...(args.preferredUnitId ? [args.preferredUnitId] : []),
  ].filter(Boolean);
  const preferredLabels = (args.preferredLabels ?? []).filter(Boolean);

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

  const byType = new Map<string, { id: string; label: string }[]>();
  for (const u of units ?? []) {
    const list = byType.get(u.room_type_id as string) ?? [];
    list.push({ id: u.id as string, label: String(u.label ?? "") });
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
    // Preferred labels (legacy room no) first, then preferred unit ids.
    if (preferredLabels.length) {
      const prefer = pool.filter((u) =>
        unitMatchesPreferredLabel(u.label, preferredLabels),
      );
      const rest = pool.filter(
        (u) => !unitMatchesPreferredLabel(u.label, preferredLabels),
      );
      pool.length = 0;
      pool.push(...prefer, ...rest);
    }
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
 * Fill only shortfall slots for a booking (does not delete existing assignments).
 * Returns how many new rows were inserted and remaining shortfall.
 */
export async function fillMissingRoomAssignments(
  admin: Admin,
  args: {
    propertyId: string;
    bookingId: string;
    checkIn: string;
    checkOut: string;
    lines: BookingRoomLine[];
    preferredLabels?: string[] | null;
    preferredUnitIds?: string[] | null;
  },
): Promise<{ inserted: number; shortfall: number; preferredHit: number }> {
  const { propertyId, bookingId, checkIn, checkOut } = args;
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return { inserted: 0, shortfall: 0, preferredHit: 0 };
  }

  const demandByType = new Map<string, number>();
  for (const line of args.lines) {
    if (!ASSIGNABLE_KINDS.has(line.inventory_kind) || line.qty <= 0) continue;
    demandByType.set(
      line.room_type_id,
      (demandByType.get(line.room_type_id) ?? 0) + line.qty,
    );
  }
  if (demandByType.size === 0) {
    return { inserted: 0, shortfall: 0, preferredHit: 0 };
  }

  const typeIds = [...demandByType.keys()];
  const preferredLabels = (args.preferredLabels ?? []).filter(Boolean);
  const preferredIds = (args.preferredUnitIds ?? []).filter(Boolean);

  const [{ data: units }, { data: busy }, { data: current }] = await Promise.all([
    admin
      .from("room_units")
      .select("id, room_type_id, sort_order, label")
      .eq("property_id", propertyId)
      .in("room_type_id", typeIds)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    admin
      .from("room_assignments")
      .select("room_unit_id, from_date, to_date, booking_id")
      .eq("property_id", propertyId)
      .lt("from_date", checkOut)
      .gt("to_date", checkIn),
    admin
      .from("room_assignments")
      .select("room_unit_id, room_units(room_type_id)")
      .eq("booking_id", bookingId),
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

  const assignedByType = new Map<string, number>();
  for (const row of current ?? []) {
    const rawUnit = row.room_units as
      | { room_type_id?: string }
      | { room_type_id?: string }[]
      | null;
    const unit = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
    if (!unit?.room_type_id) continue;
    assignedByType.set(
      unit.room_type_id,
      (assignedByType.get(unit.room_type_id) ?? 0) + 1,
    );
  }

  const byType = new Map<string, { id: string; label: string }[]>();
  for (const u of units ?? []) {
    const list = byType.get(u.room_type_id as string) ?? [];
    list.push({ id: u.id as string, label: String(u.label ?? "") });
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
  let preferredHit = 0;

  for (const [roomTypeId, demand] of demandByType) {
    const already = assignedByType.get(roomTypeId) ?? 0;
    const needed = Math.max(0, demand - already);
    if (needed === 0) continue;

    const pool = (byType.get(roomTypeId) ?? []).filter(
      (u) => !occupied.has(u.id),
    );
    if (preferredLabels.length) {
      const prefer = pool.filter((u) =>
        unitMatchesPreferredLabel(u.label, preferredLabels),
      );
      const rest = pool.filter(
        (u) => !unitMatchesPreferredLabel(u.label, preferredLabels),
      );
      pool.length = 0;
      pool.push(...prefer, ...rest);
    }
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
      const pick = pool[i];
      if (unitMatchesPreferredLabel(pick.label, preferredLabels)) preferredHit++;
      occupied.add(pick.id);
      inserts.push({
        property_id: propertyId,
        booking_id: bookingId,
        room_unit_id: pick.id,
        from_date: checkIn,
        to_date: checkOut,
      });
    }
  }

  if (inserts.length) {
    const { error } = await admin.from("room_assignments").insert(inserts);
    if (error) {
      console.error("fillMissingRoomAssignments insert failed", error);
      // Exclusion constraint race — treat as shortfall, do not throw hard.
      if (
        /exclusion|overlap|conflict|room_assignments/i.test(error.message ?? "")
      ) {
        return {
          inserted: 0,
          shortfall: shortfall + inserts.length,
          preferredHit: 0,
        };
      }
      throw new Error("Could not assign rooms (overlap check failed).");
    }
  }

  return { inserted: inserts.length, shortfall, preferredHit };
}

export type BulkAutoAssignResult = {
  processed: number;
  fullyAssigned: number;
  partial: number;
  alreadyComplete: number;
  skippedInvalid: number;
  insertedAssignments: number;
  preferredHits: number;
  shortfalls: Array<{
    bookingId: string;
    contactName: string | null;
    checkIn: string;
    checkOut: string;
    shortfall: number;
    externalRef: string | null;
  }>;
};

/**
 * Auto-assign free rooms for every under-assigned active booking.
 * Order: check-in, then check-out, then external_ref — so early stays pack first.
 * Never double-books a unit (exclusion constraint + in-query occupancy).
 */
export async function bulkAutoAssignUnassignedBookings(
  admin: Admin,
  args: {
    propertyId: string;
    /** When set, only bookings overlapping this window. */
    windowStart?: string | null;
    windowEndExclusive?: string | null;
    limit?: number;
  },
): Promise<BulkAutoAssignResult> {
  const { propertyId } = args;
  const limit = Math.min(Math.max(args.limit ?? 2000, 1), 5000);

  let q = admin
    .from("bookings")
    .select(
      "id, contact_name, check_in, check_out, notes, external_ref, booking_rooms(room_type_id, qty, inventory_kind)",
    )
    .eq("property_id", propertyId)
    .in("status", ["held", "pending", "confirmed", "checked_in"])
    .order("check_in", { ascending: true })
    .order("check_out", { ascending: true })
    .limit(limit);

  if (args.windowStart) {
    q = q.gt("check_out", args.windowStart);
  }
  if (args.windowEndExclusive) {
    q = q.lt("check_in", args.windowEndExclusive);
  }

  const { data: bookings, error } = await q;
  if (error) throw new Error(error.message);
  if (!bookings?.length) {
    return {
      processed: 0,
      fullyAssigned: 0,
      partial: 0,
      alreadyComplete: 0,
      skippedInvalid: 0,
      insertedAssignments: 0,
      preferredHits: 0,
      shortfalls: [],
    };
  }

  const result: BulkAutoAssignResult = {
    processed: 0,
    fullyAssigned: 0,
    partial: 0,
    alreadyComplete: 0,
    skippedInvalid: 0,
    insertedAssignments: 0,
    preferredHits: 0,
    shortfalls: [],
  };

  for (const b of bookings) {
    result.processed++;
    const checkIn = b.check_in as string;
    const checkOut = b.check_out as string;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      result.skippedInvalid++;
      continue;
    }
    const lines = (b.booking_rooms as BookingRoomLine[] | null) ?? [];
    if (!lines.some((l) => ASSIGNABLE_KINDS.has(l.inventory_kind) && l.qty > 0)) {
      result.skippedInvalid++;
      continue;
    }

    const preferredLabels = extractPreferredRoomLabels(
      (b.notes as string | null) ?? null,
    );

    try {
      const fill = await fillMissingRoomAssignments(admin, {
        propertyId,
        bookingId: b.id as string,
        checkIn,
        checkOut,
        lines,
        preferredLabels,
      });
      result.insertedAssignments += fill.inserted;
      result.preferredHits += fill.preferredHit;

      if (fill.shortfall === 0 && fill.inserted === 0) {
        // Either already full, or nothing to do.
        // Re-check assignment completeness cheaply via demand when shortfall is 0 after fill=0.
        result.alreadyComplete++;
        continue;
      }
      if (fill.shortfall === 0) {
        result.fullyAssigned++;
      } else {
        result.partial++;
        result.shortfalls.push({
          bookingId: b.id as string,
          contactName: (b.contact_name as string | null) ?? null,
          checkIn,
          checkOut,
          shortfall: fill.shortfall,
          externalRef: (b.external_ref as string | null) ?? null,
        });
      }
    } catch (e) {
      result.partial++;
      result.shortfalls.push({
        bookingId: b.id as string,
        contactName: (b.contact_name as string | null) ?? null,
        checkIn,
        checkOut,
        shortfall: -1,
        externalRef: (b.external_ref as string | null) ?? null,
      });
      console.error("bulkAutoAssign failed", b.id, e);
    }
  }

  return result;
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
  await bulkAutoAssignUnassignedBookings(admin, {
    propertyId,
    windowStart,
    windowEndExclusive,
    limit: 300,
  });
}
