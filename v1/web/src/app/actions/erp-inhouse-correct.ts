"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { ensureFolioEditSession } from "@/lib/folio/edit-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type InHouseCorrectState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export type InHouseRoomOption = {
  id: string;
  label: string;
  roomTypeId: string;
  roomTypeName: string;
};

export type InHouseCorrectForm = {
  bookingId: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  checkIn: string;
  checkOut: string;
  assignments: Array<{
    id: string;
    roomUnitId: string;
    label: string;
    roomTypeId: string;
    roomTypeName: string;
  }>;
  rooms: InHouseRoomOption[];
};

function overlaps(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): boolean {
  return aFrom < bTo && bFrom < aTo;
}

export async function loadInHouseCorrectForm(
  bookingId: string,
): Promise<{ ok: true; form: InHouseCorrectForm } | { ok: false; error: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const { data: booking, error } = await admin
      .from("bookings")
      .select("id, status, contact_name, contact_phone, notes, check_in, check_out")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error || !booking) {
      return { ok: false, error: error?.message ?? "Booking not found." };
    }
    if (booking.status !== "checked_in") {
      return { ok: false, error: "Correct is for an in-house stay." };
    }

    const checkIn = String(booking.check_in).slice(0, 10);
    const checkOut = String(booking.check_out).slice(0, 10);

    const [{ data: assignments }, { data: units }, { data: blocks }, { data: others }] =
      await Promise.all([
        admin
          .from("room_assignments")
          .select(
            "id, room_unit_id, from_date, to_date, room_units(label, room_type_id, room_types(name, inventory_kind))",
          )
          .eq("booking_id", bookingId)
          .eq("property_id", propertyId),
        admin
          .from("room_units")
          .select("id, label, room_type_id, room_types(name, inventory_kind)")
          .eq("property_id", propertyId)
          .order("label"),
        admin
          .from("room_blocks")
          .select("room_unit_id, from_date, to_date")
          .eq("property_id", propertyId)
          .is("released_at", null)
          .lt("from_date", checkOut)
          .gt("to_date", checkIn),
        admin
          .from("room_assignments")
          .select("room_unit_id, from_date, to_date, booking_id")
          .eq("property_id", propertyId)
          .neq("booking_id", bookingId)
          .lt("from_date", checkOut)
          .gt("to_date", checkIn),
      ]);

    const blocked = new Set<string>();
    for (const block of blocks ?? []) {
      if (
        overlaps(
          checkIn,
          checkOut,
          String(block.from_date),
          String(block.to_date),
        )
      ) {
        blocked.add(block.room_unit_id as string);
      }
    }
    for (const row of others ?? []) {
      if (
        overlaps(
          checkIn,
          checkOut,
          String(row.from_date),
          String(row.to_date),
        )
      ) {
        blocked.add(row.room_unit_id as string);
      }
    }

    type UnitJoin = {
      label?: string;
      room_type_id?: string;
      room_types?:
        | { name?: string; inventory_kind?: string }
        | { name?: string; inventory_kind?: string }[]
        | null;
    };

    function unitOf(raw: UnitJoin | UnitJoin[] | null): UnitJoin | null {
      if (!raw) return null;
      return Array.isArray(raw) ? (raw[0] ?? null) : raw;
    }
    function typeOf(unit: UnitJoin | null) {
      const rt = unit?.room_types;
      if (!rt) return null;
      return Array.isArray(rt) ? (rt[0] ?? null) : rt;
    }

    const currentIds = new Set<string>();
    const assignmentRows = (assignments ?? []).map((row) => {
      const unit = unitOf(row.room_units as UnitJoin | UnitJoin[] | null);
      const type = typeOf(unit);
      currentIds.add(row.room_unit_id as string);
      return {
        id: row.id as string,
        roomUnitId: row.room_unit_id as string,
        label: unit?.label ?? "Room",
        roomTypeId: unit?.room_type_id ?? "",
        roomTypeName: type?.name ?? "Room",
      };
    });

    const rooms: InHouseRoomOption[] = [];
    for (const unit of units ?? []) {
      const joined = unitOf({
        label: unit.label as string,
        room_type_id: unit.room_type_id as string,
        room_types: unit.room_types as UnitJoin["room_types"],
      });
      const type = typeOf(joined);
      if (type?.inventory_kind && type.inventory_kind !== "sellable_guest") {
        continue;
      }
      const id = unit.id as string;
      if (blocked.has(id) && !currentIds.has(id)) continue;
      rooms.push({
        id,
        label: (unit.label as string) ?? "Room",
        roomTypeId: (unit.room_type_id as string) ?? "",
        roomTypeName: type?.name ?? "Room",
      });
    }

    return {
      ok: true,
      form: {
        bookingId,
        contactName: (booking.contact_name as string | null) ?? "",
        contactPhone: (booking.contact_phone as string | null) ?? "",
        notes: (booking.notes as string | null) ?? "",
        checkIn,
        checkOut,
        assignments: assignmentRows,
        rooms,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not open the stay.",
    };
  }
}

export async function correctInHouseStay(
  _prev: InHouseCorrectState,
  formData: FormData,
): Promise<InHouseCorrectState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const session = await ensureFolioEditSession({
      admin,
      propertyId,
      pin: optionalTrim(formData.get("manager_pin")),
    });
    if (!session.ok) return { ok: false, error: session.error };

    const loaded = await loadInHouseCorrectForm(bookingId);
    if (!loaded.ok) return loaded;

    const name = trimRequired(formData.get("contact_name"), "Guest name");
    const phone = optionalTrim(formData.get("contact_phone"));
    const notes = optionalTrim(formData.get("notes"));
    const roomsRaw = String(formData.get("rooms_json") ?? "[]");
    let picks: { assignmentId: string; roomUnitId: string }[] = [];
    try {
      const parsed = JSON.parse(roomsRaw) as unknown;
      if (!Array.isArray(parsed)) throw new Error("bad");
      picks = parsed
        .map((row) => {
          const item = row as { assignmentId?: string; roomUnitId?: string };
          return {
            assignmentId: String(item.assignmentId ?? ""),
            roomUnitId: String(item.roomUnitId ?? ""),
          };
        })
        .filter((row) => row.assignmentId && row.roomUnitId);
    } catch {
      return { ok: false, error: "Choose a room for each assignment." };
    }

    const allowed = new Set(loaded.form.rooms.map((room) => room.id));
    const seen = new Set<string>();
    for (const pick of picks) {
      if (!allowed.has(pick.roomUnitId)) {
        return { ok: false, error: "That room is not free for these dates." };
      }
      if (seen.has(pick.roomUnitId)) {
        return { ok: false, error: "Each room can be used once on this stay." };
      }
      seen.add(pick.roomUnitId);
    }

    const previousName = loaded.form.contactName;
    const { error: nameErr } = await admin
      .from("bookings")
      .update({
        contact_name: name,
        contact_phone: phone,
        notes,
      })
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .eq("status", "checked_in");
    if (nameErr) return { ok: false, error: nameErr.message };

    if (previousName && previousName !== name) {
      await admin
        .from("booking_guests")
        .update({ full_name: name })
        .eq("booking_id", bookingId)
        .eq("full_name", previousName);
    }

    const roomMoves: { from: string; to: string }[] = [];
    for (const current of loaded.form.assignments) {
      const pick = picks.find((row) => row.assignmentId === current.id);
      if (!pick || pick.roomUnitId === current.roomUnitId) continue;
      const next = loaded.form.rooms.find((room) => room.id === pick.roomUnitId);
      if (!next) continue;

      const { data: stayFolios } = await admin
        .from("folios")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("property_id", propertyId);
      const folioIds = (stayFolios ?? []).map((folio) => folio.id as string);

      const { error: moveErr } = await admin
        .from("room_assignments")
        .update({ room_unit_id: next.id })
        .eq("id", current.id)
        .eq("booking_id", bookingId);
      if (moveErr) return { ok: false, error: moveErr.message };

      if (next.roomTypeId && next.roomTypeId !== current.roomTypeId) {
        await admin
          .from("booking_rooms")
          .update({ room_type_id: next.roomTypeId })
          .eq("booking_id", bookingId)
          .eq("room_type_id", current.roomTypeId);
      }

      if (folioIds.length > 0) {
        await admin
          .from("folio_lines")
          .update({ room_unit_id: next.id })
          .in("folio_id", folioIds)
          .eq("room_unit_id", current.roomUnitId)
          .eq("status", "posted");

        const { data: lines } = await admin
          .from("folio_lines")
          .select("id, description")
          .in("folio_id", folioIds)
          .eq("room_unit_id", next.id)
          .eq("status", "posted");
        for (const line of lines ?? []) {
          const description = String(line.description ?? "");
          if (!description.includes(current.label)) continue;
          await admin
            .from("folio_lines")
            .update({
              description: description.replaceAll(current.label, next.label),
            })
            .eq("id", line.id as string);
        }
      }

      await admin
        .from("room_units")
        .update({ hk_status: "dirty" })
        .eq("id", current.roomUnitId)
        .eq("property_id", propertyId);
      await admin
        .from("room_units")
        .update({ hk_status: "occupied" })
        .eq("id", next.id)
        .eq("property_id", propertyId);

      roomMoves.push({ from: current.label, to: next.label });
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "booking.inhouse_correct",
      entityType: "bookings",
      entityId: bookingId,
      actor: session.actor,
      summary: `Corrected in-house stay ${name}${
        roomMoves.length
          ? ` · ${roomMoves.map((move) => `${move.from} → ${move.to}`).join(", ")}`
          : ""
      }`,
      meta: {
        previous_name: previousName,
        contact_name: name,
        contact_phone: phone,
        room_moves: roomMoves,
      },
    });

    revalidatePath("/erp/in-house");
    revalidatePath("/erp/reservations");
    revalidatePath("/erp/calendar");
    revalidatePath("/erp/housekeeping");

    return {
      ok: true,
      message:
        roomMoves.length > 0
          ? `Updated ${name}. Room ${roomMoves.map((move) => move.to).join(", ")}.`
          : `Updated ${name}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not correct the stay.",
    };
  }
}
