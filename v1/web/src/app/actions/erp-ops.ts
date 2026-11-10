"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isShiftOutlet, shiftSaveErrorMessage } from "@/lib/shift-outlets";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ErpOpsState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const STAFF_ROLES = new Set([
  "front_desk",
  "reservation",
  "fnb",
  "kitchen",
  "housekeeping",
  "spa",
  "security",
  "maintenance",
  "manager",
  "other",
]);
const LEAVE_TYPES = new Set(["annual", "sick", "unpaid", "other"]);
const INV_UNITS = new Set(["ea", "kg", "g", "l", "ml", "case"]);
const MOVE_KINDS = new Set(["receive", "adjust", "waste", "issue", "count"]);
const HK_STATUSES = new Set(["clean", "dirty", "inspect", "ooo", "occupied"]);

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: Admin) {
  return resolveActivePropertyId(admin);
}

async function assertActiveStaffInProperty(
  admin: Admin,
  propertyId: string,
  staffId: string,
): Promise<void> {
  const { data } = await admin
    .from("staff_members")
    .select("id")
    .eq("id", staffId)
    .eq("property_id", propertyId)
    .in("status", ["active", "on_leave"])
    .maybeSingle();
  if (!data) {
    throw new Error("Staff member not found for this property.");
  }
}

function revalidateOps() {
  revalidatePath("/erp/hr");
  revalidatePath("/erp/inventory");
  revalidatePath("/erp/rooms");
  revalidatePath("/erp/reports");
  revalidatePath("/erp");
}

function parseQty(raw: FormDataEntryValue | null, label: string): number {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n === 0) {
    throw new Error(`${label} must be a non-zero number.`);
  }
  return roundBtn(n);
}

// --- HR --------------------------------------------------------------------

export async function createStaffMember(
  _prev: ErpOpsState,
  formData: FormData,
): Promise<ErpOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const role = trimRequired(formData.get("role_label"), "Role").toLowerCase();
    if (!STAFF_ROLES.has(role)) throw new Error("Invalid staff role.");
    const employeeCode =
      optionalTrim(formData.get("employee_code"))?.toUpperCase().replace(/\s+/g, "-") ??
      `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const { data, error } = await admin
      .from("staff_members")
      .insert({
        property_id: pid,
        employee_code: employeeCode,
        full_name: trimRequired(formData.get("full_name"), "Name"),
        role_label: role,
        phone: optionalTrim(formData.get("phone")),
        email: optionalTrim(formData.get("email")),
        hired_on: optionalTrim(formData.get("hired_on")),
        notes: optionalTrim(formData.get("notes")),
        status: "active",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("staff_members insert failed", error);
      throw new Error("Could not save staff member.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "staff.create",
      entityType: "staff_members",
      entityId: data.id as string,
      summary: `Added staff ${trimRequired(formData.get("full_name"), "Name")}`,
    });

    revalidateOps();
    return { ok: true, message: "Staff member saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createStaffShift(
  _prev: ErpOpsState,
  formData: FormData,
): Promise<ErpOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const outletRaw = optionalTrim(formData.get("outlet"))?.toLowerCase();
    if (outletRaw && !isShiftOutlet(outletRaw)) {
      throw new Error("Invalid shift outlet.");
    }

    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    await assertActiveStaffInProperty(admin, pid, staffId);
    const shiftDate = trimRequired(formData.get("shift_date"), "Date");
    let startsAt = trimRequired(formData.get("starts_at"), "Start");
    let endsAt = trimRequired(formData.get("ends_at"), "End");
    if (/^\d{2}:\d{2}$/.test(startsAt)) startsAt = `${startsAt}:00`;
    if (/^\d{2}:\d{2}$/.test(endsAt)) endsAt = `${endsAt}:00`;
    if (endsAt <= startsAt) throw new Error("End time must be after start time.");

    const { assertNoOverlap } = await import("@/lib/rota/overlap");
    const { data: peers } = await admin
      .from("staff_shifts")
      .select("id, staff_id, shift_date, starts_at, ends_at, status")
      .eq("property_id", pid)
      .eq("staff_id", staffId)
      .eq("shift_date", shiftDate)
      .in("status", ["draft", "published"]);
    assertNoOverlap(
      {
        staffId,
        shiftDate,
        startsAt,
        endsAt,
      },
      (peers ?? []).map((peer) => ({
        id: peer.id as string,
        staffId: peer.staff_id as string,
        shiftDate: peer.shift_date as string,
        startsAt: peer.starts_at as string,
        endsAt: peer.ends_at as string,
        status: peer.status as string,
      })),
    );

    const { data, error } = await admin
      .from("staff_shifts")
      .insert({
        property_id: pid,
        staff_id: staffId,
        shift_date: shiftDate,
        starts_at: startsAt,
        ends_at: endsAt,
        outlet: outletRaw ?? null,
        notes: optionalTrim(formData.get("notes")),
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("staff_shifts insert failed", error);
      throw new Error(shiftSaveErrorMessage(error, "Could not save shift."));
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "shift.create",
      entityType: "staff_shifts",
      entityId: data.id as string,
      summary: "Created draft staff shift",
      meta: { staffId },
    });

    revalidateOps();
    return { ok: true, message: "Shift saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createStaffLeave(
  _prev: ErpOpsState,
  formData: FormData,
): Promise<ErpOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const leaveType = trimRequired(formData.get("leave_type"), "Leave type").toLowerCase();
    if (!LEAVE_TYPES.has(leaveType)) throw new Error("Invalid leave type.");

    const starts = trimRequired(formData.get("starts_on"), "Start date");
    const ends = trimRequired(formData.get("ends_on"), "End date");
    if (ends < starts) throw new Error("End date must be on or after start.");

    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    await assertActiveStaffInProperty(admin, pid, staffId);
    const { data, error } = await admin
      .from("staff_leave")
      .insert({
        property_id: pid,
        staff_id: staffId,
        leave_type: leaveType,
        starts_on: starts,
        ends_on: ends,
        status: "requested",
        notes: optionalTrim(formData.get("notes")),
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("staff_leave insert failed", error);
      throw new Error("Could not save leave.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "leave.request",
      entityType: "staff_leave",
      entityId: data.id as string,
      summary: "Recorded staff leave request",
      meta: { staffId, leaveType, starts, ends },
    });

    revalidateOps();
    return { ok: true, message: "Leave request recorded." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// --- Inventory -------------------------------------------------------------

export async function createInventoryItem(
  _prev: ErpOpsState,
  formData: FormData,
): Promise<ErpOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const category = trimRequired(formData.get("category"), "Category").toLowerCase();
    const unit = trimRequired(formData.get("unit"), "Unit").toLowerCase();
    const { data: catRow } = await admin
      .from("inventory_categories")
      .select("slug")
      .eq("property_id", pid)
      .eq("slug", category)
      .eq("is_active", true)
      .maybeSingle();
    if (!catRow) throw new Error("Invalid category.");
    if (!INV_UNITS.has(unit)) throw new Error("Invalid unit.");

    const qtyRaw = String(formData.get("qty_on_hand") ?? "0").trim();
    const qty = qtyRaw ? Number(qtyRaw.replace(/,/g, "")) : 0;
    if (!Number.isFinite(qty) || qty < 0) throw new Error("Qty must be ≥ 0.");

    const { data, error } = await admin
      .from("inventory_items")
      .insert({
        property_id: pid,
        sku: trimRequired(formData.get("sku"), "SKU").toUpperCase(),
        name: trimRequired(formData.get("name"), "Name"),
        category,
        unit,
        qty_on_hand: roundBtn(qty),
        reorder_level: roundBtn(
          Number(String(formData.get("reorder_level") ?? "0").replace(/,/g, "")) || 0,
        ),
        unit_cost_btn: roundBtn(
          Number(String(formData.get("unit_cost_btn") ?? "0").replace(/,/g, "")) || 0,
        ),
        notes: optionalTrim(formData.get("notes")),
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("inventory_items insert failed", error);
      throw new Error(error?.message?.includes("duplicate")
        ? "SKU already exists."
        : "Could not save item.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "inventory.create",
      entityType: "inventory_items",
      entityId: data.id as string,
      summary: `Created SKU ${trimRequired(formData.get("sku"), "SKU").toUpperCase()}`,
    });

    revalidateOps();
    return { ok: true, message: "Inventory item saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function postInventoryMovement(
  _prev: ErpOpsState,
  formData: FormData,
): Promise<ErpOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const itemId = trimRequired(formData.get("item_id"), "Item");
    const kind = trimRequired(formData.get("movement_kind"), "Movement").toLowerCase();
    if (!MOVE_KINDS.has(kind)) throw new Error("Invalid movement kind.");

    let delta = parseQty(formData.get("qty_delta"), "Quantity");
    if (kind === "waste" || kind === "issue") {
      delta = -Math.abs(delta);
    } else if (kind === "receive") {
      delta = Math.abs(delta);
    } else if (kind === "count") {
      // count: qty_delta is absolute new on-hand
      const { data: item } = await admin
        .from("inventory_items")
        .select("id, qty_on_hand")
        .eq("id", itemId)
        .eq("property_id", pid)
        .single();
      if (!item) throw new Error("Item not found.");
      const target = Math.abs(delta);
      delta = roundBtn(target - Number(item.qty_on_hand));
    }

    const { data: item, error: itemErr } = await admin
      .from("inventory_items")
      .select("id, qty_on_hand, name, sku")
      .eq("id", itemId)
      .eq("property_id", pid)
      .single();
    if (itemErr || !item) throw new Error("Item not found.");

    const nextQty = roundBtn(Number(item.qty_on_hand) + delta);
    if (nextQty < 0) throw new Error("That would take stock below zero.");

    const { error: moveErr } = await admin.from("inventory_movements").insert({
      property_id: pid,
      item_id: itemId,
      movement_kind: kind,
      qty_delta: delta,
      reference: optionalTrim(formData.get("reference")),
      notes: optionalTrim(formData.get("notes")),
      created_by: "desk",
    });
    if (moveErr) {
      console.error("inventory_movements insert failed", moveErr);
      throw new Error("Could not post movement.");
    }

    const { error: updErr } = await admin
      .from("inventory_items")
      .update({ qty_on_hand: nextQty })
      .eq("id", itemId);
    if (updErr) {
      console.error("inventory_items qty update failed", updErr);
      throw new Error("Movement saved but qty update failed.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "inventory.move",
      entityType: "inventory_items",
      entityId: itemId,
      summary: `${kind} ${delta} on ${item.sku as string} → ${nextQty}`,
      meta: { kind, delta, nextQty },
    });

    revalidateOps();
    return { ok: true, message: `Stock updated (${item.sku}: ${nextQty}).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// --- Housekeeping ----------------------------------------------------------

export async function updateRoomHkStatus(
  _prev: ErpOpsState,
  formData: FormData,
): Promise<ErpOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const unitId = trimRequired(formData.get("room_unit_id"), "Room");
    const status = trimRequired(formData.get("hk_status"), "Status").toLowerCase();
    if (!HK_STATUSES.has(status)) throw new Error("Invalid housekeeping status.");

    if (status === "clean") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: openAssignment } = await admin
        .from("hk_assignments")
        .select(
          "id, checklist_clean_ok, checklist_linen_ok, checklist_amenities_ok, status",
        )
        .eq("property_id", pid)
        .eq("room_unit_id", unitId)
        .eq("business_date", today)
        .in("status", ["open", "in_progress"])
        .limit(1)
        .maybeSingle();

      if (
        openAssignment &&
        (!openAssignment.checklist_clean_ok ||
          !openAssignment.checklist_linen_ok ||
          !openAssignment.checklist_amenities_ok)
      ) {
        throw new Error(
          "Complete HK turnover checklist on Housekeeping before marking clean.",
        );
      }
    }

    const { data, error } = await admin
      .from("room_units")
      .update({
        hk_status: status,
        updated_at: new Date().toISOString(),
        notes: optionalTrim(formData.get("notes")),
      })
      .eq("id", unitId)
      .eq("property_id", pid)
      .select("id, label")
      .single();
    if (error || !data) {
      console.error("room_units update failed", error);
      throw new Error("Could not update room status.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "hk.status",
      entityType: "room_units",
      entityId: unitId,
      summary: `${data.label as string} → ${status}`,
    });

    revalidateOps();
    return { ok: true, message: `${data.label as string} marked ${status}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
