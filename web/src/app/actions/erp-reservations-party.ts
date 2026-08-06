"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  loadCheckInRoomOptions,
  stayRangesOverlap,
  type CheckInAssignmentSlot,
  type CheckInRoomUnit,
} from "@/lib/room-assignments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PartyActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  groupId?: string;
};

export type RoomingGuest = {
  id: string | null;
  fullName: string;
  phone: string | null;
  nationality: string | null;
  passportOrCid: string | null;
  sortOrder: number;
};

export type RoomingLine = {
  bookingId: string;
  contactName: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  roomsSold: number;
  assignmentId: string | null;
  roomUnitId: string | null;
  roomLabel: string | null;
  roomTypeId: string | null;
  roomTypeName: string | null;
  guests: RoomingGuest[];
};

export type RoomingListPayload = {
  bookingId: string;
  slots: CheckInAssignmentSlot[];
  units: CheckInRoomUnit[];
  lines: RoomingLine[];
  partyBookingIds: string[];
  groupId: string | null;
  groupName: string | null;
};

function revalidatePartySurfaces() {
  revalidatePath("/erp/reservations");
  revalidatePath("/erp/group");
  revalidatePath("/erp/calendar");
  revalidatePath("/erp/arrivals");
}

/**
 * Link N bookings under one booking_groups master (rooming list pattern).
 * Idempotent for members already in the target group.
 */
export async function mergeBookingsIntoGroup(
  bookingIds: string[],
  groupName?: string | null,
  existingGroupId?: string | null,
): Promise<PartyActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired. Sign in again." };
    }
    const ids = [...new Set(bookingIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length < 2 && !existingGroupId) {
      return { ok: false, error: "Select at least two reservations to group." };
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { data: bookings, error: bookErr } = await admin
      .from("bookings")
      .select(
        "id, agent_id, check_in, check_out, contact_name, agents(company_name)",
      )
      .eq("property_id", propertyId)
      .in("id", ids);

    if (bookErr) throw new Error(bookErr.message);
    if (!bookings?.length) {
      return { ok: false, error: "No matching bookings at this property." };
    }
    if (bookings.length !== ids.length) {
      return {
        ok: false,
        error: "Some selected bookings are missing or at another property.",
      };
    }

    let groupId = existingGroupId?.trim() || null;

    if (groupId) {
      const { data: existing } = await admin
        .from("booking_groups")
        .select("id")
        .eq("id", groupId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (!existing) {
        return { ok: false, error: "Group not found at this property." };
      }
    } else {
      const head = bookings[0]!;
      const agentRaw = head.agents as
        | { company_name?: string }
        | { company_name?: string }[]
        | null;
      const agentName = Array.isArray(agentRaw)
        ? agentRaw[0]?.company_name
        : agentRaw?.company_name;
      const name =
        groupName?.trim() ||
        [agentName, head.contact_name, "party"]
          .filter(Boolean)
          .slice(0, 2)
          .join(" · ") ||
        "Rooming party";

      const checkIns = bookings
        .map((b) => b.check_in as string)
        .filter(Boolean)
        .sort();
      const checkOuts = bookings
        .map((b) => b.check_out as string)
        .filter(Boolean)
        .sort();

      const agentIds = [
        ...new Set(
          bookings
            .map((b) => b.agent_id as string | null)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const { data: group, error: gErr } = await admin
        .from("booking_groups")
        .insert({
          property_id: propertyId,
          name,
          agent_id: agentIds.length === 1 ? agentIds[0] : null,
          check_in: checkIns[0] ?? null,
          check_out: checkOuts[checkOuts.length - 1] ?? null,
          status: "open",
          notes: `Linked ${bookings.length} reservations from desk.`,
        })
        .select("id")
        .single();
      if (gErr || !group) throw new Error(gErr?.message ?? "Could not create group.");
      groupId = group.id as string;
    }

    const { data: already } = await admin
      .from("booking_group_members")
      .select("booking_id")
      .eq("group_id", groupId!);

    const alreadySet = new Set(
      (already ?? []).map((r) => r.booking_id as string),
    );
    const toInsert = bookings
      .map((b) => b.id as string)
      .filter((id) => !alreadySet.has(id))
      .map((booking_id) => ({
        group_id: groupId!,
        booking_id,
      }));

    if (toInsert.length) {
      const { error: mErr } = await admin
        .from("booking_group_members")
        .insert(toInsert);
      if (mErr) throw new Error(mErr.message);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "reservations.party.merge",
      entityType: "booking_groups",
      entityId: groupId!,
      summary: `Linked ${bookings.length} booking(s) into party`,
      meta: { booking_ids: bookings.map((b) => b.id) },
    });

    revalidatePartySurfaces();
    return {
      ok: true,
      groupId: groupId!,
      message: `Linked ${bookings.length} reservation(s) as one party.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not link party.",
    };
  }
}

/** Load rooming list for a booking, expanding formal group siblings when present. */
export async function fetchRoomingList(
  bookingId: string,
): Promise<
  { ok: true; data: RoomingListPayload } | { ok: false; error: string }
> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { data: membership } = await admin
      .from("booking_group_members")
      .select("group_id, booking_groups(id, name)")
      .eq("booking_id", bookingId)
      .maybeSingle();

    let partyBookingIds = [bookingId];
    let groupId: string | null = null;
    let groupName: string | null = null;

    if (membership?.group_id) {
      groupId = membership.group_id as string;
      const gRaw = membership.booking_groups as
        | { id?: string; name?: string }
        | { id?: string; name?: string }[]
        | null;
      const g = Array.isArray(gRaw) ? gRaw[0] : gRaw;
      groupName = g?.name ?? null;

      const { data: siblings } = await admin
        .from("booking_group_members")
        .select("booking_id")
        .eq("group_id", groupId);
      partyBookingIds = (siblings ?? []).map((s) => s.booking_id as string);
      if (!partyBookingIds.includes(bookingId)) {
        partyBookingIds.push(bookingId);
      }
    }

    const { data: bookings, error } = await admin
      .from("bookings")
      .select(
        `
        id, contact_name, contact_phone, check_in, check_out, status, rooms,
        booking_rooms(qty, inventory_kind, room_type_id, room_types(name, code)),
        room_assignments(
          id, room_unit_id, from_date, to_date,
          room_units(id, label, room_type_id, room_types(id, name))
        ),
        booking_guests(
          id, full_name, nationality, passport_or_cid, sort_order, room_assignment_id
        )
      `,
      )
      .eq("property_id", propertyId)
      .in("id", partyBookingIds)
      .order("check_in", { ascending: true });

    if (error) return { ok: false, error: error.message };
    if (!bookings?.length) return { ok: false, error: "Booking not found" };

    const anchor =
      bookings.find((b) => b.id === bookingId) ?? bookings[0]!;

    type LoadLine = {
      room_type_id: string;
      qty: number;
      inventory_kind: string;
      room_types: { name: string; code: string } | null;
    };

    const toLoadLine = (l: {
      qty: number;
      inventory_kind: string;
      room_type_id: string;
      room_types?: { name?: string; code?: string } | null;
    }): LoadLine => ({
      room_type_id: l.room_type_id,
      qty: Number(l.qty),
      inventory_kind: l.inventory_kind,
      room_types: l.room_types
        ? {
            name: l.room_types.name ?? l.room_types.code ?? "Room",
            code: l.room_types.code ?? "",
          }
        : null,
    });

    const linesRaw: LoadLine[] = (
      (anchor.booking_rooms as Array<{
        qty: number;
        inventory_kind: string;
        room_type_id: string;
        room_types?: { name?: string; code?: string } | null;
      }> | null) ?? []
    ).map(toLoadLine);

    // Include room types sold on sibling party bookings so multi-booking
    // agent groups can pick unit numbers for every room type.
    for (const b of bookings) {
      if ((b.id as string) === (anchor.id as string)) continue;
      for (const l of (b.booking_rooms as Array<{
        qty: number;
        inventory_kind: string;
        room_type_id: string;
        room_types?: { name?: string; code?: string } | null;
      }> | null) ?? []) {
        if (
          !linesRaw.some(
            (x) =>
              x.room_type_id === l.room_type_id &&
              x.inventory_kind === l.inventory_kind,
          )
        ) {
          linesRaw.push(toLoadLine(l));
        }
      }
    }

    // When a party booking has no booking_rooms (import edge), fall back to
    // a synthetic sellable slot so the UI still offers free units.
    if (linesRaw.length === 0) {
      for (const b of bookings) {
        const assigns =
          (b.room_assignments as Array<{
            room_units:
              | {
                  room_type_id?: string;
                  room_types?: { name?: string; code?: string } | null;
                }
              | {
                  room_type_id?: string;
                  room_types?: { name?: string; code?: string } | null;
                }[]
              | null;
          }> | null) ?? [];
        for (const a of assigns) {
          const ru = Array.isArray(a.room_units)
            ? a.room_units[0]
            : a.room_units;
          if (!ru?.room_type_id) continue;
          if (!linesRaw.some((x) => x.room_type_id === ru.room_type_id)) {
            linesRaw.push({
              room_type_id: ru.room_type_id,
              qty: 1,
              inventory_kind: "sellable_guest",
              room_types: {
                name: ru.room_types?.name ?? ru.room_types?.code ?? "Room",
                code: ru.room_types?.code ?? "",
              },
            });
          }
        }
      }
    }

    // Window: earliest in → latest out across party (rack free-set)
    const partyIn = [...bookings]
      .map((b) => b.check_in as string)
      .sort()[0]!;
    const partyOut = [...bookings]
      .map((b) => b.check_out as string)
      .sort()
      .at(-1)!;

    const { slots, units } = await loadCheckInRoomOptions(admin, {
      propertyId,
      bookingId: anchor.id as string,
      checkIn: partyIn,
      checkOut: partyOut,
      lines: linesRaw,
    });

    // If still no room types (lines empty after filter), load all sellable units
    // for the property window so desk can pick any free room.
    let freeUnits = units;
    if (freeUnits.length === 0) {
      const { data: allUnits } = await admin
        .from("room_units")
        .select(
          "id, label, floor_label, hk_status, room_type_id, sort_order, room_types(name, code, inventory_kind)",
        )
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true })
        .limit(200);
      const { data: busy } = await admin
        .from("room_assignments")
        .select("room_unit_id, booking_id, from_date, to_date")
        .eq("property_id", propertyId)
        .lt("from_date", partyOut)
        .gt("to_date", partyIn);
      const partySet = new Set(partyBookingIds);
      const busyOther = new Set(
        (busy ?? [])
          .filter((r) => !partySet.has(r.booking_id as string))
          .map((r) => r.room_unit_id as string),
      );
      freeUnits = (allUnits ?? []).map((u) => {
        const rt = (
          Array.isArray(u.room_types) ? u.room_types[0] : u.room_types
        ) as {
          name?: string;
          code?: string;
          inventory_kind?: string;
        } | null;
        const id = u.id as string;
        const busyU = busyOther.has(id);
        return {
          id,
          label: u.label as string,
          floorLabel: (u.floor_label as string | null) ?? null,
          hkStatus: (u.hk_status as string) ?? "unknown",
          roomTypeId: u.room_type_id as string,
          roomTypeName: rt?.name ?? rt?.code ?? "Room",
          inventoryKind: rt?.inventory_kind ?? "sellable_guest",
          available: !busyU,
          blocked: false,
          reason: busyU ? "Occupied" : undefined,
        };
      });
    }

    const lines: RoomingLine[] = [];
    for (const b of bookings) {
      const assigns =
        (b.room_assignments as Array<{
          id: string;
          room_unit_id: string;
          room_units:
            | {
                id?: string;
                label?: string;
                room_type_id?: string;
                room_types?:
                  | { id?: string; name?: string }
                  | { id?: string; name?: string }[]
                  | null;
              }
            | {
                id?: string;
                label?: string;
                room_type_id?: string;
                room_types?:
                  | { id?: string; name?: string }
                  | { id?: string; name?: string }[]
                  | null;
              }[]
            | null;
        }> | null) ?? [];

      const guestsRaw =
        (b.booking_guests as Array<{
          id: string;
          full_name: string;
          nationality?: string | null;
          passport_or_cid?: string | null;
          sort_order?: number | null;
          room_assignment_id?: string | null;
        }> | null) ?? [];

      const guestToLine = (
        assignmentId: string | null,
      ): RoomingGuest[] => {
        const linked = guestsRaw
          .filter((g) =>
            assignmentId
              ? g.room_assignment_id === assignmentId
              : !g.room_assignment_id,
          )
          .sort(
            (a, c) => Number(a.sort_order ?? 0) - Number(c.sort_order ?? 0),
          )
          .map((g) => ({
            id: g.id,
            fullName: g.full_name,
            phone: null,
            nationality: g.nationality ?? null,
            passportOrCid: g.passport_or_cid ?? null,
            sortOrder: Number(g.sort_order ?? 0),
          }));
        return linked;
      };

      const roomsSold = Math.max(1, Number(b.rooms ?? 1));
      const bookLines =
        (b.booking_rooms as Array<{
          qty: number;
          room_type_id: string;
          room_types?: { name?: string } | null;
        }> | null) ?? [];

      if (assigns.length === 0) {
        // Expand sold quantity into empty rooming rows (PMS rooming list).
        const openSlots: Array<{
          roomTypeId: string | null;
          roomTypeName: string | null;
        }> = [];
        if (bookLines.length > 0) {
          for (const bl of bookLines) {
            const rtName = bl.room_types?.name ?? null;
            for (let i = 0; i < Math.max(1, Number(bl.qty)); i++) {
              openSlots.push({
                roomTypeId: bl.room_type_id,
                roomTypeName: rtName,
              });
            }
          }
        } else {
          for (let i = 0; i < roomsSold; i++) {
            openSlots.push({ roomTypeId: null, roomTypeName: null });
          }
        }

        const unlinked = guestToLine(null);
        openSlots.forEach((slot, idx) => {
          const guest =
            unlinked[idx] ??
            (idx === 0
              ? {
                  id: null as string | null,
                  fullName: (b.contact_name as string) || "",
                  phone: (b.contact_phone as string | null) ?? null,
                  nationality: null as string | null,
                  passportOrCid: null as string | null,
                  sortOrder: idx,
                }
              : {
                  id: null,
                  fullName: "",
                  phone: null,
                  nationality: null,
                  passportOrCid: null,
                  sortOrder: idx,
                });
          lines.push({
            bookingId: b.id as string,
            contactName: (b.contact_name as string | null) ?? null,
            checkIn: b.check_in as string,
            checkOut: b.check_out as string,
            status: b.status as string,
            roomsSold,
            assignmentId: null,
            roomUnitId: null,
            roomLabel: null,
            roomTypeId: slot.roomTypeId,
            roomTypeName: slot.roomTypeName,
            guests: [guest],
          });
        });
      } else {
        for (const a of assigns) {
          const ru = Array.isArray(a.room_units)
            ? a.room_units[0]
            : a.room_units;
          const rt = ru?.room_types
            ? Array.isArray(ru.room_types)
              ? ru.room_types[0]
              : ru.room_types
            : null;
          const g = guestToLine(a.id);
          lines.push({
            bookingId: b.id as string,
            contactName: (b.contact_name as string | null) ?? null,
            checkIn: b.check_in as string,
            checkOut: b.check_out as string,
            status: b.status as string,
            roomsSold,
            assignmentId: a.id,
            roomUnitId: a.room_unit_id,
            roomLabel: ru?.label ?? null,
            roomTypeId: ru?.room_type_id ?? null,
            roomTypeName: rt?.name ?? null,
            guests:
              g.length > 0
                ? g
                : [
                    {
                      id: null,
                      fullName: (b.contact_name as string) || "",
                      phone: null,
                      nationality: null,
                      passportOrCid: null,
                      sortOrder: 0,
                    },
                  ],
          });
        }
        // Open slots if sold > assigned
        const shortfall = roomsSold - assigns.length;
        for (let i = 0; i < shortfall; i++) {
          lines.push({
            bookingId: b.id as string,
            contactName: (b.contact_name as string | null) ?? null,
            checkIn: b.check_in as string,
            checkOut: b.check_out as string,
            status: b.status as string,
            roomsSold,
            assignmentId: null,
            roomUnitId: null,
            roomLabel: null,
            roomTypeId: null,
            roomTypeName: null,
            guests: [
              {
                id: null,
                fullName: "",
                phone: null,
                nationality: null,
                passportOrCid: null,
                sortOrder: assigns.length + i,
              },
            ],
          });
        }
      }
    }

    return {
      ok: true,
      data: {
        bookingId,
        slots,
        units: freeUnits,
        lines,
        partyBookingIds,
        groupId,
        groupName,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load rooming list.",
    };
  }
}

/**
 * Assign (or re-assign) a physical unit on a reservation before/at stay.
 * Does not wipe locked assignments of other units on the same booking when
 * adding; replaces an existing assignment row when assignmentId is provided.
 */
export async function assignBookingRoomUnit(input: {
  bookingId: string;
  roomUnitId: string;
  assignmentId?: string | null;
}): Promise<PartyActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bookingId = input.bookingId.trim();
    const roomUnitId = input.roomUnitId.trim();
    if (!bookingId || !roomUnitId) {
      return { ok: false, error: "Booking and room are required." };
    }

    const [{ data: booking }, { data: unit }] = await Promise.all([
      admin
        .from("bookings")
        .select("id, property_id, check_in, check_out, status, rooms")
        .eq("id", bookingId)
        .eq("property_id", propertyId)
        .maybeSingle(),
      admin
        .from("room_units")
        .select("id, label, property_id, room_type_id")
        .eq("id", roomUnitId)
        .eq("property_id", propertyId)
        .maybeSingle(),
    ]);

    if (!booking) return { ok: false, error: "Booking not found." };
    if (!unit) return { ok: false, error: "Room unit not found." };
    if (
      ["cancelled", "no_show", "expired", "checked_out"].includes(
        booking.status as string,
      )
    ) {
      return { ok: false, error: "Cannot assign rooms on a closed reservation." };
    }

    const checkIn = booking.check_in as string;
    const checkOut = booking.check_out as string;

    const { data: busy } = await admin
      .from("room_assignments")
      .select("id, booking_id, from_date, to_date")
      .eq("property_id", propertyId)
      .eq("room_unit_id", roomUnitId)
      .lt("from_date", checkOut)
      .gt("to_date", checkIn);

    const conflict = (busy ?? []).find((row) => {
      if ((row.booking_id as string) === bookingId) return false;
      if (
        input.assignmentId &&
        (row.id as string) === input.assignmentId
      ) {
        return false;
      }
      return stayRangesOverlap(
        checkIn,
        checkOut,
        row.from_date as string,
        row.to_date as string,
      );
    });
    if (conflict) {
      return {
        ok: false,
        error: `Room ${unit.label} is already assigned for these dates.`,
      };
    }

    if (input.assignmentId) {
      const { data: existing } = await admin
        .from("room_assignments")
        .select("id, is_locked")
        .eq("id", input.assignmentId)
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (!existing) {
        return { ok: false, error: "Assignment not found on this booking." };
      }
      if (existing.is_locked) {
        return {
          ok: false,
          error: "Assignment is locked. Unlock on the calendar first.",
        };
      }
      const { error } = await admin
        .from("room_assignments")
        .update({ room_unit_id: roomUnitId })
        .eq("id", input.assignmentId);
      if (error) throw new Error(error.message);
    } else {
      const { data: current } = await admin
        .from("room_assignments")
        .select("id")
        .eq("booking_id", bookingId);
      const sold = Math.max(1, Number(booking.rooms ?? 1));
      if ((current?.length ?? 0) >= sold) {
        // Replace first unlocked when over capacity of rooms sold
        const { data: unlocked } = await admin
          .from("room_assignments")
          .select("id")
          .eq("booking_id", bookingId)
          .eq("is_locked", false)
          .limit(1)
          .maybeSingle();
        if (unlocked?.id) {
          const { error } = await admin
            .from("room_assignments")
            .update({ room_unit_id: roomUnitId })
            .eq("id", unlocked.id);
          if (error) throw new Error(error.message);
        } else {
          return {
            ok: false,
            error: `This stay already has ${sold} room(s) assigned and locked.`,
          };
        }
      } else {
        const { error } = await admin.from("room_assignments").insert({
          property_id: propertyId,
          booking_id: bookingId,
          room_unit_id: roomUnitId,
          from_date: checkIn,
          to_date: checkOut,
        });
        if (error) throw new Error(error.message);
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "reservations.room.assign",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Assigned room ${unit.label}`,
      meta: { room_unit_id: roomUnitId, assignment_id: input.assignmentId ?? null },
    });

    revalidatePartySurfaces();
    return {
      ok: true,
      message: `Assigned ${unit.label}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not assign room.",
    };
  }
}

/** Upsert primary guest on a room (rooming list) and optionally link to assignment. */
export async function upsertRoomingGuest(input: {
  bookingId: string;
  guestId?: string | null;
  assignmentId?: string | null;
  fullName: string;
  nationality?: string | null;
  passportOrCid?: string | null;
  sortOrder?: number;
}): Promise<PartyActionState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const name = input.fullName.trim();
    if (!name) return { ok: false, error: "Guest name is required." };

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { data: booking } = await admin
      .from("bookings")
      .select("id, contact_name")
      .eq("id", input.bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!booking) return { ok: false, error: "Booking not found." };

    const payload = {
      full_name: name,
      nationality: input.nationality?.trim() || null,
      passport_or_cid: input.passportOrCid?.trim() || null,
      room_assignment_id: input.assignmentId?.trim() || null,
      sort_order: input.sortOrder ?? 0,
    };

    if (input.guestId) {
      const { error } = await admin
        .from("booking_guests")
        .update(payload)
        .eq("id", input.guestId)
        .eq("booking_id", input.bookingId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("booking_guests").insert({
        booking_id: input.bookingId,
        ...payload,
      });
      if (error) throw new Error(error.message);
    }

    // Keep contact_name aligned when empty or was first guest name
    const contact = (booking.contact_name as string | null)?.trim();
    if (!contact || contact === name || input.sortOrder === 0) {
      await admin
        .from("bookings")
        .update({ contact_name: name })
        .eq("id", input.bookingId)
        .eq("property_id", propertyId);
    }

    revalidatePartySurfaces();
    return { ok: true, message: "Guest saved." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save guest.",
    };
  }
}
