"use server";

import { writeAuditEvent } from "@/lib/audit";
import { thimphuToday } from "@/lib/erp-lists";
import { deductRoomAmenityStock } from "@/lib/hk/amenity-stock";
import {
  bulkChoiceIsEmpty,
  hkBulkInsert,
  hkBulkPatch,
  parseBulkHkChoice,
} from "@/lib/hk/bulk-update";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type OpsState = { ok: boolean; error?: string; message?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateHk() {
  revalidatePath("/erp/rooms");
  revalidatePath("/erp/housekeeping");
  revalidatePath("/erp/calendar");
  revalidatePath("/erp/lost-found");
  revalidatePath("/erp/inventory");
}

/** FO marks one or more rooms as needing HK service; creates open assignments. */
export async function bulkRequestRoomService(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const unitIds = formData
      .getAll("room_unit_ids")
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (unitIds.length === 0) {
      throw new Error("Select at least one room.");
    }

    const today = thimphuToday();
    const now = new Date().toISOString();
    let created = 0;

    for (const roomUnitId of unitIds) {
      await admin
        .from("room_units")
        .update({ service_requested_at: now, hk_status: "dirty" })
        .eq("id", roomUnitId)
        .eq("property_id", propertyId);

      const { data: existing } = await admin
        .from("hk_assignments")
        .select("id")
        .eq("property_id", propertyId)
        .eq("room_unit_id", roomUnitId)
        .eq("business_date", today)
        .in("status", ["open", "in_progress"])
        .limit(1)
        .maybeSingle();

      if (!existing?.id) {
        const { error } = await admin.from("hk_assignments").insert({
          property_id: propertyId,
          room_unit_id: roomUnitId,
          staff_id: null,
          business_date: today,
          status: "open",
          requested_by: "front_desk",
          notes: "Service requested from rooms board",
        });
        if (!error) created += 1;
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "hk.service.request",
      entityType: "room_units",
      entityId: unitIds[0]!,
      summary: `Requested HK service · ${unitIds.length} room(s)`,
      meta: { room_unit_ids: unitIds, assignments_created: created },
    });

    revalidateHk();
    return {
      ok: true,
      message: `Service requested for ${unitIds.length} room(s)${created ? ` · ${created} new assignment(s)` : ""}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/**
 * One staff, status, or note change for every selected housekeeping task.
 * Pending rooms (needs assign) get an assignment. Existing tasks are patched.
 * Task type (dirty, check-in, stayover, due out, service) does not matter.
 */
export async function bulkUpdateHkTasks(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const businessDate = trimRequired(formData.get("business_date"), "Date");
    const keys = [
      ...new Set(
        formData
          .getAll("task_key")
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    ];
    if (keys.length === 0) throw new Error("Select at least one task.");

    const choice = parseBulkHkChoice({
      staffChoice: String(formData.get("staff_choice") ?? "keep"),
      statusChoice: String(formData.get("status_choice") ?? "keep"),
      notes: String(formData.get("notes") ?? ""),
    });
    if (bulkChoiceIsEmpty(choice)) {
      throw new Error("Choose a staff member, status, or note to apply.");
    }

    if (typeof choice.staff === "object") {
      const { data: staff } = await admin
        .from("staff_members")
        .select("id")
        .eq("id", choice.staff.id)
        .eq("property_id", propertyId)
        .eq("status", "active")
        .maybeSingle();
      if (!staff) throw new Error("Staff member not found.");
    }

    const pendingRoomIds: string[] = [];
    const assignmentIds: string[] = [];
    for (const key of keys) {
      if (key.startsWith("pending:")) {
        const roomId = key.slice("pending:".length).trim();
        if (!roomId) throw new Error("Invalid task.");
        pendingRoomIds.push(roomId);
      } else {
        assignmentIds.push(key);
      }
    }

    if (pendingRoomIds.length > 0) {
      const { data: rooms, error } = await admin
        .from("room_units")
        .select("id")
        .eq("property_id", propertyId)
        .in("id", pendingRoomIds);
      if (error) throw new Error(error.message);
      const found = new Set((rooms ?? []).map((room) => room.id as string));
      if (pendingRoomIds.some((id) => !found.has(id))) {
        throw new Error("One or more rooms are not on this property.");
      }
    }

    type TaskRef = { id: string; status: string; room_unit_id: string };
    const toUpdate: TaskRef[] = [];
    const toInsert: string[] = [];

    if (pendingRoomIds.length > 0) {
      const { data, error } = await admin
        .from("hk_assignments")
        .select("id, status, room_unit_id")
        .eq("property_id", propertyId)
        .eq("business_date", businessDate)
        .in("room_unit_id", pendingRoomIds)
        .in("status", ["open", "in_progress", "skipped"]);
      if (error) throw new Error(error.message);
      const existingByRoom = new Map<string, TaskRef>();
      for (const row of data ?? []) {
        existingByRoom.set(row.room_unit_id as string, {
          id: row.id as string,
          status: row.status as string,
          room_unit_id: row.room_unit_id as string,
        });
      }
      for (const roomId of pendingRoomIds) {
        const existing = existingByRoom.get(roomId);
        if (existing) toUpdate.push(existing);
        else toInsert.push(roomId);
      }
    }

    if (assignmentIds.length > 0) {
      const { data, error } = await admin
        .from("hk_assignments")
        .select("id, status, room_unit_id")
        .eq("property_id", propertyId)
        .in("id", assignmentIds);
      if (error) throw new Error(error.message);
      const found = new Map(
        (data ?? []).map((row) => [row.id as string, row]),
      );
      if (assignmentIds.some((id) => !found.has(id))) {
        throw new Error("One or more tasks were not found.");
      }
      for (const id of assignmentIds) {
        const row = found.get(id)!;
        toUpdate.push({
          id,
          status: row.status as string,
          room_unit_id: row.room_unit_id as string,
        });
      }
    }

    const seen = new Set<string>();
    const updates = toUpdate.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    const now = new Date().toISOString();
    const cleanRoomIds = new Set<string>();

    if (toInsert.length > 0) {
      const rows = toInsert.map((roomId) => {
        const draft = hkBulkInsert(choice);
        if (draft.markComplete) cleanRoomIds.add(roomId);
        return {
          property_id: propertyId,
          room_unit_id: roomId,
          staff_id: draft.staff_id ?? null,
          business_date: businessDate,
          status: draft.status,
          notes: draft.notes,
          completed_at: draft.markComplete ? now : null,
        };
      });
      const { error } = await admin.from("hk_assignments").insert(rows);
      if (error) throw new Error(error.message);
    }

    for (const row of updates) {
      const patch = hkBulkPatch(row.status, choice);
      if (!patch) continue;
      const dbPatch: Record<string, unknown> = {};
      if ("staff_id" in patch) dbPatch.staff_id = patch.staff_id;
      if (patch.status) dbPatch.status = patch.status;
      if ("notes" in patch) dbPatch.notes = patch.notes;
      if (patch.markComplete) {
        dbPatch.status = "done";
        dbPatch.completed_at = now;
        cleanRoomIds.add(row.room_unit_id);
      }
      const { error } = await admin
        .from("hk_assignments")
        .update(dbPatch)
        .eq("id", row.id)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    }

    if (cleanRoomIds.size > 0) {
      const { error } = await admin
        .from("room_units")
        .update({
          hk_status: "clean",
          service_requested_at: null,
          updated_at: now,
        })
        .eq("property_id", propertyId)
        .in("id", [...cleanRoomIds]);
      if (error) throw new Error(error.message);
    }

    const count = toInsert.length + updates.length;
    await writeAuditEvent(admin, {
      propertyId,
      action: "hk.tasks.bulk_update",
      entityType: "hk_assignments",
      entityId: updates[0]?.id ?? null,
      summary: `Bulk updated ${count} housekeeping task(s)`,
      meta: {
        count,
        created: toInsert.length,
        updated: updates.length,
        staff: choice.staff === "keep" || choice.staff === "clear" ? choice.staff : "set",
        status: choice.status,
        rooms_marked_clean: cleanRoomIds.size,
      },
    });

    revalidateHk();
    const cleanNote =
      choice.status === "done" ? " Rooms marked clean." : "";
    return {
      ok: true,
      message: `Updated ${count} task${count === 1 ? "" : "s"}.${cleanNote}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function completeHkChecklist(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const id = trimRequired(formData.get("id"), "Assignment");
    const cleanOk = formData.get("checklist_clean_ok") === "on";
    const linenOk = formData.get("checklist_linen_ok") === "on";
    const amenitiesOk = formData.get("checklist_amenities_ok") === "on";
    const markDone = formData.get("mark_done") === "on";

    if (markDone && (!cleanOk || !linenOk || !amenitiesOk)) {
      throw new Error(
        "Complete clean, linen, and amenities checklist before marking done.",
      );
    }

    const { data: assignment } = await admin
      .from("hk_assignments")
      .select("id, room_unit_id, room_units(label)")
      .eq("id", id)
      .eq("property_id", propertyId)
      .single();
    if (!assignment) throw new Error("Assignment not found.");

    const room = assignment.room_units as
      | { label?: string }
      | { label?: string }[]
      | null;
    const roomLabel = Array.isArray(room) ? room[0]?.label : room?.label;

    const patch: Record<string, unknown> = {
      checklist_clean_ok: cleanOk,
      checklist_linen_ok: linenOk,
      checklist_amenities_ok: amenitiesOk,
    };

    if (markDone) {
      patch.status = "done";
      patch.completed_at = new Date().toISOString();
      patch.checklist_completed_at = new Date().toISOString();
    }

    const { error } = await admin
      .from("hk_assignments")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);

    if (markDone && amenitiesOk) {
      await deductRoomAmenityStock(
        admin,
        propertyId,
        id,
        roomLabel ?? "Room",
      );
      await admin
        .from("room_units")
        .update({
          hk_status: "clean",
          service_requested_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignment.room_unit_id as string);
    }

    revalidateHk();
    return {
      ok: true,
      message: markDone ? "Checklist complete · room marked clean." : "Checklist saved.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createLostFoundItem(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const description = trimRequired(formData.get("description"), "Description");
    const roomUnitId = optionalTrim(formData.get("room_unit_id"));
    const staffId = optionalTrim(formData.get("found_by_staff_id"));
    const guestName = optionalTrim(formData.get("guest_name"));
    const guestContact = optionalTrim(formData.get("guest_contact"));
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("lost_found_items").insert({
      property_id: propertyId,
      room_unit_id: roomUnitId || null,
      found_by_staff_id: staffId || null,
      description,
      guest_name: guestName,
      guest_contact: guestContact,
      notes,
      status: "open",
    });
    if (error) throw new Error(error.message);

    revalidateHk();
    return { ok: true, message: "Lost & found item logged." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function updateLostFoundStatus(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const id = trimRequired(formData.get("id"), "Item");
    const status = trimRequired(formData.get("status"), "Status");
    if (!["open", "claimed", "disposed"].includes(status)) {
      throw new Error("Invalid status.");
    }

    const patch: Record<string, unknown> = { status };
    if (status === "claimed") patch.claimed_at = new Date().toISOString();

    const { error } = await admin
      .from("lost_found_items")
      .update(patch)
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidateHk();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
