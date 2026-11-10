"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { shiftInHouseRoom } from "@/app/actions/erp-room-shift";
import { revalidatePath } from "next/cache";

export type StayRoomOption = {
  id: string;
  label: string;
  floorLabel: string | null;
  typeName: string;
  roomTypeId: string;
  hkStatus: string;
  available: boolean;
  reason?: string | null;
  isCurrent: boolean;
};

export type StayRoomListResult =
  | {
      ok: true;
      bookingId: string;
      contactName: string;
      checkIn: string;
      checkOut: string;
      currentRoomUnitId: string | null;
      currentRoomLabel: string | null;
      currentAssignmentId: string | null;
      isInHouse: boolean;
      rooms: StayRoomOption[];
    }
  | { ok: false; error: string };

export type AssignRoomResult =
  | {
      ok: true;
      message: string;
      roomLabel: string;
      assignmentId: string;
    }
  | { ok: false; error: string };

function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom < bTo && bFrom < aTo;
}

/**
 * Loads all physical room units in the property and checks their availability
 * for the stay's date range [checkIn, checkOut).
 */
export async function loadStayAvailableRooms(bookingId: string): Promise<StayRoomListResult> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, contact_name, status, check_in, check_out, property_id")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (bErr || !booking) {
      return { ok: false, error: bErr?.message ?? "Stay reservation not found" };
    }

    const checkIn = String(booking.check_in ?? "").slice(0, 10);
    const checkOut = String(booking.check_out ?? "").slice(0, 10);
    const isInHouse = booking.status === "checked_in";

    // Fetch existing room assignments for this booking
    const { data: currentAssignments } = await admin
      .from("room_assignments")
      .select("id, room_unit_id, room_units(label)")
      .eq("booking_id", bookingId)
      .eq("property_id", propertyId);

    const activeAssign = (currentAssignments ?? [])[0] ?? null;
    const currentAssignmentId = (activeAssign?.id as string | null) ?? null;
    const currentRoomUnitId = (activeAssign?.room_unit_id as string | null) ?? null;
    const rawUnit = activeAssign?.room_units as { label?: string } | { label?: string }[] | null;
    const currentRoomLabel = Array.isArray(rawUnit) ? rawUnit[0]?.label ?? null : rawUnit?.label ?? null;

    // Fetch all room units for this property
    const { data: allUnits, error: uErr } = await admin
      .from("room_units")
      .select("id, label, floor_label, hk_status, sort_order, room_type_id, room_types(name, code, inventory_kind)")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (uErr) {
      return { ok: false, error: uErr.message };
    }

    // Fetch busy assignments overlapping this date range
    const { data: busyAssignments } = await admin
      .from("room_assignments")
      .select("room_unit_id, booking_id, from_date, to_date, bookings(contact_name, status)")
      .eq("property_id", propertyId)
      .neq("booking_id", bookingId)
      .lt("from_date", checkOut)
      .gt("to_date", checkIn);

    // Fetch room maintenance blocks
    const { data: blocks } = await admin
      .from("room_blocks")
      .select("room_unit_id, from_date, to_date, reason")
      .eq("property_id", propertyId)
      .is("released_at", null)
      .lt("from_date", checkOut)
      .gt("to_date", checkIn);

    const busyMap = new Map<string, string>();
    for (const ba of busyAssignments ?? []) {
      const bObj = Array.isArray(ba.bookings) ? ba.bookings[0] : ba.bookings;
      const bStatus = (bObj?.status as string | undefined)?.toLowerCase();
      if (bStatus === "cancelled" || bStatus === "no_show") continue;
      const cName = (bObj?.contact_name as string | undefined) ?? "Another Guest";
      busyMap.set(ba.room_unit_id, `Occupied (${cName})`);
    }

    for (const blk of blocks ?? []) {
      busyMap.set(blk.room_unit_id, `Maintenance Out of Order: ${blk.reason || "Block"}`);
    }

    const rooms: StayRoomOption[] = (allUnits ?? [])
      .filter((u) => {
        const isCurrent = u.id === currentRoomUnitId;
        const rt = Array.isArray(u.room_types) ? u.room_types[0] : u.room_types;
        const kind = rt?.inventory_kind ?? "sellable_guest";
        return kind === "sellable_guest" || isCurrent;
      })
      .map((u) => {
      const isCurrent = u.id === currentRoomUnitId;
      const busyReason = busyMap.get(u.id);
      const isAvailable = isCurrent || !busyReason;
      const rt = Array.isArray(u.room_types) ? u.room_types[0] : u.room_types;

      return {
        id: u.id,
        label: u.label,
        floorLabel: (u.floor_label as string | null) ?? null,
        typeName: rt?.name ?? "Standard Room",
        roomTypeId: u.room_type_id,
        hkStatus: (u.hk_status as string) ?? "clean",
        available: isAvailable,
        reason: isCurrent ? "Currently Assigned" : busyReason ?? null,
        isCurrent,
      };
    });

    return {
      ok: true,
      bookingId,
      contactName: (booking.contact_name as string) ?? "Guest",
      checkIn,
      checkOut,
      currentRoomUnitId,
      currentRoomLabel,
      currentAssignmentId,
      isInHouse,
      rooms,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load room options";
    return { ok: false, error: msg };
  }
}

/**
 * Assigns or shifts a room for the stay.
 * If in-house with an active assignment, delegates to shiftInHouseRoom (handling split dates & ledger).
 * If arrival/unassigned, creates or updates the room_assignments record.
 */
export async function assignOrMoveStayRoom(input: {
  bookingId: string;
  targetRoomUnitId: string;
  assignmentId?: string | null;
  isInHouse?: boolean;
  upgradeChoice?: "complimentary" | "top_up";
  topUpAmount?: number;
  managerPin?: string;
  reason?: string;
}): Promise<AssignRoomResult> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, contact_name, status, check_in, check_out, property_id")
      .eq("id", input.bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (bErr || !booking) {
      return { ok: false, error: "Booking not found" };
    }

    const { data: targetUnit } = await admin
      .from("room_units")
      .select("id, label, room_type_id")
      .eq("id", input.targetRoomUnitId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!targetUnit) {
      return { ok: false, error: "Target room unit not found" };
    }

    const checkIn = String(booking.check_in ?? "").slice(0, 10);
    const checkOut = String(booking.check_out ?? "").slice(0, 10);

    // Case 1: In-House stay with an active assignment -> use shiftInHouseRoom
    if (booking.status === "checked_in" && input.assignmentId) {
      const shiftRes = await shiftInHouseRoom(input.assignmentId, input.targetRoomUnitId, {
        choice: input.upgradeChoice ?? "complimentary",
        topUpBalanceBtn: input.topUpAmount ?? 0,
        managerPin: input.managerPin?.trim() || undefined,
        reason: input.reason?.trim() || "StayHub room move",
      });

      if (!shiftRes.ok) {
        return { ok: false, error: shiftRes.error };
      }

      revalidatePath("/erp/calendar");
      revalidatePath("/erp/today");
      revalidatePath("/erp/housekeeping");

      return {
        ok: true,
        message: shiftRes.message,
        roomLabel: shiftRes.roomLabel,
        assignmentId: shiftRes.assignmentId,
      };
    }

    // Case 2: Arrival or Not In-House -> Check overlap and assign directly
    const { data: overlap } = await admin
      .from("room_assignments")
      .select("id, booking_id")
      .eq("property_id", propertyId)
      .eq("room_unit_id", input.targetRoomUnitId)
      .neq("booking_id", input.bookingId)
      .lt("from_date", checkOut)
      .gt("to_date", checkIn)
      .limit(1);

    if (overlap && overlap.length > 0) {
      return { ok: false, error: `Room ${targetUnit.label} is already reserved by another guest for these dates.` };
    }

    // Check if an existing assignment exists for this booking
    const { data: existingAssignments } = await admin
      .from("room_assignments")
      .select("id")
      .eq("booking_id", input.bookingId)
      .eq("property_id", propertyId);

    let assignedId = "";
    if (existingAssignments && existingAssignments.length > 0) {
      // Update existing assignment
      const firstId = existingAssignments[0].id;
      const { error: upErr } = await admin
        .from("room_assignments")
        .update({
          room_unit_id: input.targetRoomUnitId,
          from_date: checkIn,
          to_date: checkOut,
        })
        .eq("id", firstId);

      if (upErr) return { ok: false, error: upErr.message };
      assignedId = firstId;
    } else {
      // Insert new assignment
      const { data: inserted, error: inErr } = await admin
        .from("room_assignments")
        .insert({
          property_id: propertyId,
          booking_id: input.bookingId,
          room_unit_id: input.targetRoomUnitId,
          from_date: checkIn,
          to_date: checkOut,
          is_locked: false,
        })
        .select("id")
        .single();

      if (inErr || !inserted) {
        return { ok: false, error: inErr?.message ?? "Failed to create assignment" };
      }
      assignedId = inserted.id;
    }

    // Sync booking_rooms.room_type_id if the target unit has a different category
    const { data: bookingLines } = await admin
      .from("booking_rooms")
      .select("id, room_type_id, inventory_kind")
      .eq("booking_id", input.bookingId);

    const guestLine = (bookingLines ?? []).find(
      (l) => l.inventory_kind === "sellable_guest"
    );
    if (guestLine && guestLine.room_type_id !== targetUnit.room_type_id) {
      await admin
        .from("booking_rooms")
        .update({ room_type_id: targetUnit.room_type_id })
        .eq("id", guestLine.id);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "stayhub.room.assign",
      entityType: "bookings",
      entityId: input.bookingId,
      summary: `${booking.contact_name ?? "Guest"} assigned to Room ${targetUnit.label}`,
      meta: {
        room_unit_id: input.targetRoomUnitId,
        room_label: targetUnit.label,
        assignment_id: assignedId,
      },
    });

    revalidatePath("/erp/calendar");
    revalidatePath("/erp/today");
    revalidatePath("/erp/housekeeping");

    return {
      ok: true,
      message: `✓ Room ${targetUnit.label} assigned to ${booking.contact_name ?? "guest"}!`,
      roomLabel: targetUnit.label,
      assignmentId: assignedId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to assign room";
    return { ok: false, error: msg };
  }
}

/**
 * 1-Tap Auto Assign: Automatically picks the best clean available physical room
 * and assigns it to this reservation.
 */
export async function autoAssignStayBestRoom(bookingId: string): Promise<AssignRoomResult> {
  try {
    const list = await loadStayAvailableRooms(bookingId);
    if (!list.ok) return { ok: false, error: list.error };

    // Find best free clean room (prefer non-current room if re-assigning)
    const cleanAvailable = list.rooms.find((r) => r.available && !r.isCurrent && r.hkStatus === "clean") || list.rooms.find((r) => r.available && r.hkStatus === "clean");
    const inspectedAvailable = list.rooms.find((r) => r.available && !r.isCurrent && r.hkStatus === "inspected") || list.rooms.find((r) => r.available && r.hkStatus === "inspected");
    const anyAvailable = list.rooms.find((r) => r.available && !r.isCurrent) || list.rooms.find((r) => r.available);

    const chosen = cleanAvailable || inspectedAvailable || anyAvailable;
    if (!chosen) {
      return { ok: false, error: "No physical rooms are currently free for this stay's dates." };
    }

    return await assignOrMoveStayRoom({
      bookingId,
      targetRoomUnitId: chosen.id,
      assignmentId: list.currentAssignmentId,
      isInHouse: list.isInHouse,
      reason: "1-Tap Best Room Auto-Assign",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Auto-assignment failed";
    return { ok: false, error: msg };
  }
}
