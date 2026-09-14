"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

export type OpsState = { ok: boolean; error?: string; message?: string };

export async function createHkAssignment(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const roomUnitId = trimRequired(formData.get("room_unit_id"), "Room");
    const staffId = optionalTrim(formData.get("staff_id"));
    const businessDate = trimRequired(formData.get("business_date"), "Date");
    const notes = optionalTrim(formData.get("notes"));
    const { error } = await admin.from("hk_assignments").insert({
      property_id: propertyId,
      room_unit_id: roomUnitId,
      staff_id: staffId || null,
      business_date: businessDate,
      notes,
      status: "open",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/housekeeping");
    return { ok: true, message: "Assignment created." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function updateHkAssignmentStatus(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const id = trimRequired(formData.get("id"), "Assignment");
    const status = trimRequired(formData.get("status"), "Status");
    const patch: Record<string, unknown> = { status };
    if (status === "done") patch.completed_at = new Date().toISOString();
    const { error } = await admin.from("hk_assignments").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/erp/housekeeping");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createMaintenanceOrder(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const title = trimRequired(formData.get("title"), "Title");
    const description = optionalTrim(formData.get("description"));
    const priority = optionalTrim(formData.get("priority")) ?? "normal";
    const roomUnitId = optionalTrim(formData.get("room_unit_id"));
    const assigned = optionalTrim(formData.get("assigned_staff_id"));
    const { error } = await admin.from("maintenance_orders").insert({
      property_id: propertyId,
      title,
      description,
      priority,
      room_unit_id: roomUnitId || null,
      assigned_staff_id: assigned || null,
      status: "open",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/maintenance");
    return { ok: true, message: "Work order created." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function updateMaintenanceStatus(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const id = trimRequired(formData.get("id"), "Order");
    const status = trimRequired(formData.get("status"), "Status");
    const patch: Record<string, unknown> = { status };
    if (status === "done") patch.completed_at = new Date().toISOString();
    const { error } = await admin
      .from("maintenance_orders")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/erp/maintenance");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createBookingGroup(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const name = trimRequired(formData.get("name"), "Group name");
    const agentId = optionalTrim(formData.get("agent_id"));
    const checkIn = optionalTrim(formData.get("check_in"));
    const checkOut = optionalTrim(formData.get("check_out"));
    const notes = optionalTrim(formData.get("notes"));
    const { data, error } = await admin
      .from("booking_groups")
      .insert({
        property_id: propertyId,
        name,
        agent_id: agentId || null,
        check_in: checkIn || null,
        check_out: checkOut || null,
        notes,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const bookingId = optionalTrim(formData.get("booking_id"));
    if (bookingId && data?.id) {
      await admin.from("booking_group_members").insert({
        group_id: data.id,
        booking_id: bookingId,
      });
    }
    revalidatePath("/erp/group");
    return { ok: true, message: "Group created." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function addBookingToGroup(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const groupId = trimRequired(formData.get("group_id"), "Group");
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const { error } = await admin.from("booking_group_members").insert({
      group_id: groupId,
      booking_id: bookingId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/group");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createAgentAllotment(
  _prev: OpsState,
  formData: FormData,
): Promise<OpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const roomTypeId = trimRequired(formData.get("room_type_id"), "Room type");
    const seasonKind = trimRequired(formData.get("season_kind"), "Season");
    const roomsPerWeek = Number(formData.get("rooms_per_week"));
    if (!Number.isFinite(roomsPerWeek) || roomsPerWeek < 1) {
      throw new Error("Rooms per week must be at least 1.");
    }
    const validFrom = trimRequired(formData.get("valid_from"), "From");
    const validTo = trimRequired(formData.get("valid_to"), "To");
    const notes = optionalTrim(formData.get("notes"));
    const { error } = await admin.from("agent_allotments").insert({
      property_id: propertyId,
      agent_id: agentId,
      room_type_id: roomTypeId,
      season_kind: seasonKind,
      rooms_per_week: roomsPerWeek,
      valid_from: validFrom,
      valid_to: validTo,
      notes,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/erp/allotments");
    return { ok: true, message: "Allotment saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
