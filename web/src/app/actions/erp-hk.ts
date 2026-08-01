"use server";

import { writeAuditEvent } from "@/lib/audit";
import { thimphuToday } from "@/lib/erp-lists";
import { deductRoomAmenityStock } from "@/lib/hk/amenity-stock";
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
