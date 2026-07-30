"use server";

import { revalidatePath } from "next/cache";
import { postFolioLine } from "@/lib/accounting/posting";
import {
  canWorkLaundry,
  isLaundryPhotoId,
  LAUNDRY_TRANSITIONS,
  type LaundryOrder,
  type LaundryStatus,
} from "@/lib/laundry";
import { requireStaffSession, type StaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";

export type LaundryStaffState = {
  ok: boolean;
  message?: string;
  error?: string;
};

async function requireLaundryStaff() {
  const session = await requireStaffSession();
  if (!canWorkLaundry(session)) {
    throw new Error("Your staff account is not assigned to laundry.");
  }
  return session;
}

function refreshLaundry() {
  revalidatePath("/staff/laundry");
  revalidatePath("/erp/laundry");
  revalidatePath("/laundry");
}

function parseCounts(value: FormDataEntryValue | null): Map<string, number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value ?? "[]"));
  } catch {
    throw new Error("Garment counts are invalid.");
  }
  if (!Array.isArray(parsed)) throw new Error("Confirm garment counts.");
  const result = new Map<string, number>();
  for (const row of parsed) {
    const itemId =
      row && typeof row === "object" && "itemId" in row
        ? String(row.itemId)
        : "";
    const qty =
      row && typeof row === "object" && "qty" in row
        ? Number(row.qty)
        : -1;
    if (itemId && Number.isInteger(qty) && qty >= 0 && qty <= 200) {
      result.set(itemId, qty);
    }
  }
  if (result.size === 0) throw new Error("Confirm garment counts.");
  return result;
}

export async function confirmLaundryReceipt(
  _prev: LaundryStaffState,
  formData: FormData,
): Promise<LaundryStaffState> {
  try {
    const session = await requireLaundryStaff();
    const orderId = trimRequired(formData.get("order_id"), "Laundry order");
    const counts = parseCounts(formData.get("counts"));
    const conditionNotes = optionalTrim(formData.get("condition_notes"));
    const admin = createSupabaseAdminClient();
    const { data: order } = await admin
      .from("laundry_orders")
      .select("id, property_id, folio_line_id")
      .eq("id", orderId)
      .eq("property_id", session.propertyId)
      .maybeSingle();
    if (!order) throw new Error("Laundry order not found.");

    const { data: items } = await admin
      .from("laundry_order_items")
      .select("id")
      .eq("order_id", orderId);
    const validIds = new Set((items ?? []).map((item) => item.id as string));
    if ([...counts.keys()].some((id) => !validIds.has(id))) {
      throw new Error("A garment line does not belong to this order.");
    }
    for (const [itemId, qty] of counts) {
      const { error } = await admin
        .from("laundry_order_items")
        .update({ confirmed_qty: qty })
        .eq("id", itemId)
        .eq("order_id", orderId);
      if (error) throw new Error("Could not save garment counts.");
    }
    await admin
      .from("laundry_orders")
      .update({
        condition_notes: conditionNotes,
        assigned_staff_id: session.staffId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("property_id", session.propertyId);

    const { data: result, error: rpcError } = await admin.rpc(
      "laundry_confirm_receipt",
      { p_order_id: orderId, p_staff_id: session.staffId },
    );
    if (rpcError) throw new Error(rpcError.message);
    const folioLineId = String(
      (result as { folio_line_id?: string } | null)?.folio_line_id ?? "",
    );
    if (folioLineId) {
      const { data: line } = await admin
        .from("folio_lines")
        .select("id, source_type, description, total_btn, gst_btn, created_at")
        .eq("id", folioLineId)
        .single();
      if (line) {
        await postFolioLine(admin, session.propertyId, {
          id: line.id as string,
          source_type: line.source_type as string,
          description: line.description as string | null,
          total_btn: Number(line.total_btn),
          gst_btn: Number(line.gst_btn),
          created_at: line.created_at as string,
        });
      }
    }
    refreshLaundry();
    return {
      ok: true,
      message: `Receipt confirmed. Folio charge Nu ${Number(
        (result as { total_btn?: number } | null)?.total_btn ?? 0,
      ).toFixed(2)}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not confirm receipt.",
    };
  }
}

export async function advanceLaundryStatus(
  _prev: LaundryStaffState,
  formData: FormData,
): Promise<LaundryStaffState> {
  try {
    const session = await requireLaundryStaff();
    const orderId = trimRequired(formData.get("order_id"), "Laundry order");
    const next = trimRequired(formData.get("next_status"), "Next status") as LaundryStatus;
    const notes = optionalTrim(formData.get("notes"));
    let photos: string[] = [];
    try {
      const parsed = JSON.parse(String(formData.get("photo_public_ids") ?? "[]"));
      if (Array.isArray(parsed)) {
        photos = parsed
          .map(String)
          .filter((id) => isLaundryPhotoId(id, session.propertyId))
          .slice(0, 4);
      }
    } catch {
      throw new Error("Photo reference is invalid.");
    }

    const admin = createSupabaseAdminClient();
    const { data: order } = await admin
      .from("laundry_orders")
      .select("id, status, assigned_staff_id, billed_at")
      .eq("id", orderId)
      .eq("property_id", session.propertyId)
      .maybeSingle();
    if (!order) throw new Error("Laundry order not found.");
    const current = order.status as LaundryStatus;
    if (!LAUNDRY_TRANSITIONS[current]?.includes(next)) {
      throw new Error(`Cannot move laundry from ${current} to ${next}.`);
    }
    if (current === "requested" && next === "received" && !order.billed_at) {
      throw new Error("Confirm garment counts before marking received.");
    }
    if (next === "delivered") {
      const { count } = await admin
        .from("laundry_order_bags")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .eq("property_id", session.propertyId)
        .neq("status", "voided");
      if ((count ?? 0) > 0) {
        const { data: fullyAllocated, error: allocError } = await admin.rpc(
          "laundry_bags_fully_allocated",
          { p_order_id: orderId },
        );
        if (allocError) throw new Error("Could not verify bag allocation.");
        if (!fullyAllocated) {
          throw new Error(
            "Assign every confirmed garment to a bag before delivery.",
          );
        }
      }
    }
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: next,
      assigned_staff_id: order.assigned_staff_id ?? session.staffId,
      updated_at: now,
    };
    if (next === "ready") patch.ready_at = now;
    if (next === "delivered") patch.delivered_at = now;
    if (next === "exception") patch.exception_notes = notes;
    if (photos.length) patch.completion_photo_public_ids = photos;
    const { error } = await admin
      .from("laundry_orders")
      .update(patch)
      .eq("id", orderId)
      .eq("property_id", session.propertyId)
      .eq("status", current);
    if (error) throw new Error("Could not update laundry status.");
    await admin.from("laundry_order_events").insert({
      property_id: session.propertyId,
      order_id: orderId,
      event_type: next === "exception" ? "exception" : "status_changed",
      from_status: current,
      to_status: next,
      notes,
      photo_public_ids: photos,
      actor_kind: "staff",
      actor_staff_id: session.staffId,
      client_event_id: optionalTrim(formData.get("client_event_id")),
    });
    refreshLaundry();
    return { ok: true, message: `Laundry marked ${next.replace("_", " ")}.` };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not update laundry.",
    };
  }
}

export async function claimLaundryOrder(formData: FormData): Promise<void> {
  const session = await requireLaundryStaff();
  const orderId = trimRequired(formData.get("order_id"), "Laundry order");
  const admin = createSupabaseAdminClient();
  await admin
    .from("laundry_orders")
    .update({ assigned_staff_id: session.staffId, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("property_id", session.propertyId)
    .is("assigned_staff_id", null);
  refreshLaundry();
}

export async function loadLaundryStaffOrders(
  session: StaffSession,
): Promise<LaundryOrder[]> {
  if (!canWorkLaundry(session)) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("laundry_orders")
    .select(
      "id, booking_id, room_unit_id, guest_name, room_label_snapshot, source, status, assigned_staff_id, requested_notes, condition_notes, exception_notes, intake_photo_public_ids, completion_photo_public_ids, total_btn, requested_at, received_at, ready_at, delivered_at, billed_at, laundry_order_items(id, catalog_item_id, name_snapshot, unit_label_snapshot, requested_qty, confirmed_qty, unit_price_btn, line_total_btn)",
    )
    .eq("property_id", session.propertyId)
    .not("status", "in", "(delivered,cancelled)")
    .order("requested_at");
  return (data ?? []).map((row) => ({
    ...row,
    total_btn: row.total_btn == null ? null : Number(row.total_btn),
    intake_photo_public_ids:
      (row.intake_photo_public_ids as string[] | null) ?? [],
    completion_photo_public_ids:
      (row.completion_photo_public_ids as string[] | null) ?? [],
    laundry_order_items: (
      (row.laundry_order_items as LaundryOrder["laundry_order_items"]) ?? []
    ).map((item) => ({
      ...item,
      unit_price_btn:
        item.unit_price_btn == null ? null : Number(item.unit_price_btn),
      line_total_btn:
        item.line_total_btn == null ? null : Number(item.line_total_btn),
    })),
  })) as LaundryOrder[];
}
