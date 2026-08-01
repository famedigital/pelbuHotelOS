"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { resolveDeskActor } from "@/lib/desk/actor";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { voidFolioLineWithReversal } from "@/lib/folio/void-line";
import {
  isLaundryPhotoId,
  laundryBagScanPath,
  makeLaundryBagPublicCode,
  validateBagAllocations,
} from "@/lib/laundry";
import { autoPrepareDefaultBag } from "@/lib/laundry/prepare-default-bag";
import {
  createLaundryToken,
  hashLaundryToken,
} from "@/lib/laundry-session";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import type { LaundryBagState } from "@/app/actions/laundry-bags";

export type ErpLaundryState = {
  ok: boolean;
  message?: string;
  orderId?: string;
  labelsUrl?: string;
  error?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function refreshLaundry() {
  revalidatePath("/erp/laundry");
  revalidatePath("/staff/laundry");
  revalidatePath("/laundry");
}

export async function saveLaundryCatalogItem(
  _prev: ErpLaundryState,
  formData: FormData,
): Promise<ErpLaundryState> {
  try {
    await requireDesk();
    const itemId = optionalTrim(formData.get("item_id"));
    const name = trimRequired(formData.get("name"), "Service name");
    const category = optionalTrim(formData.get("category")) ?? "clothing";
    const unitLabel = optionalTrim(formData.get("unit_label")) ?? "piece";
    const price = Number(formData.get("price_btn"));
    const turnaround = Number(formData.get("turnaround_hours") ?? 24);
    if (!Number.isFinite(price) || price < 0 || price > 100_000) {
      throw new Error("Price must be between Nu 0 and Nu 100,000.");
    }
    if (!Number.isInteger(turnaround) || turnaround < 1 || turnaround > 168) {
      throw new Error("Turnaround must be between 1 and 168 hours.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const payload = {
      property_id: propertyId,
      name,
      category,
      unit_label: unitLabel,
      price_btn: price,
      gst_applicable: formData.get("gst_applicable") === "1",
      turnaround_hours: turnaround,
      is_active: formData.get("is_active") !== "0",
      sort_order: Number(formData.get("sort_order") ?? 0),
      updated_at: new Date().toISOString(),
    };
    const result = itemId
      ? await admin
          .from("laundry_catalog_items")
          .update(payload)
          .eq("id", itemId)
          .eq("property_id", propertyId)
          .select("id")
          .single()
      : await admin
          .from("laundry_catalog_items")
          .insert(payload)
          .select("id")
          .single();
    if (result.error || !result.data) {
      throw new Error("Could not save laundry service.");
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: itemId ? "laundry.catalog.update" : "laundry.catalog.create",
      entityType: "laundry_catalog_items",
      entityId: result.data.id as string,
      summary: `${itemId ? "Updated" : "Created"} laundry price: ${name}`,
      meta: { price, unitLabel, turnaround },
    });
    refreshLaundry();
    return { ok: true, message: "Laundry price saved." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not save laundry price.",
    };
  }
}

type DeskLine = { catalogItemId: string; qty: number };

function parseDeskLines(value: FormDataEntryValue | null): DeskLine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value ?? "[]"));
  } catch {
    throw new Error("Laundry item list is invalid.");
  }
  if (!Array.isArray(parsed)) throw new Error("Add at least one garment.");
  const lines = parsed.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const catalogItemId =
      "catalogItemId" in row ? String(row.catalogItemId) : "";
    const qty = "qty" in row ? Number(row.qty) : 0;
    return catalogItemId &&
      Number.isInteger(qty) &&
      qty >= 1 &&
      qty <= 200
      ? [{ catalogItemId, qty }]
      : [];
  });
  if (!lines.length) throw new Error("Add at least one garment.");
  return lines;
}

export async function createDeskLaundryOrder(
  _prev: ErpLaundryState,
  formData: FormData,
): Promise<ErpLaundryState> {
  try {
    await requireDesk();
    const bookingId = trimRequired(formData.get("booking_id"), "Guest stay");
    const roomUnitId = trimRequired(formData.get("room_unit_id"), "Room");
    const guestName = trimRequired(formData.get("guest_name"), "Guest name");
    const lines = parseDeskLines(formData.get("items"));
    const notes = optionalTrim(formData.get("notes"));
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: assignment } = await admin
      .from("room_assignments")
      .select("id, room_units(label), bookings!inner(id, status)")
      .eq("property_id", propertyId)
      .eq("booking_id", bookingId)
      .eq("room_unit_id", roomUnitId)
      .maybeSingle();
    const bookingRaw = assignment
      ? Array.isArray(assignment.bookings)
        ? assignment.bookings[0]
        : assignment.bookings
      : null;
    if (!assignment || !bookingRaw || bookingRaw.status !== "checked_in") {
      throw new Error("Select a currently checked-in room.");
    }
    const roomRaw = Array.isArray(assignment.room_units)
      ? assignment.room_units[0]
      : assignment.room_units;
    const roomLabel = roomRaw?.label as string | undefined;
    if (!roomLabel) throw new Error("Room assignment is invalid.");

    let photos: string[] = [];
    try {
      const parsed = JSON.parse(String(formData.get("photo_public_ids") ?? "[]"));
      if (Array.isArray(parsed)) {
        photos = parsed
          .map(String)
          .filter((id) => isLaundryPhotoId(id, propertyId))
          .slice(0, 4);
      }
    } catch {
      throw new Error("Photo reference is invalid.");
    }
    const ids = lines.map((line) => line.catalogItemId);
    const { data: catalog } = await admin
      .from("laundry_catalog_items")
      .select("id, name, unit_label")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .in("id", ids);
    if (!catalog || catalog.length !== new Set(ids).size) {
      throw new Error("One or more laundry services are unavailable.");
    }
    const { data: order, error } = await admin
      .from("laundry_orders")
      .insert({
        property_id: propertyId,
        booking_id: bookingId,
        room_unit_id: roomUnitId,
        guest_name: guestName,
        room_label_snapshot: roomLabel,
        source: "front_desk",
        requested_notes: notes,
        intake_photo_public_ids: photos,
      })
      .select("id")
      .single();
    if (error || !order) throw new Error("Could not create laundry order.");
    const byId = new Map(catalog.map((item) => [item.id as string, item]));
    const { error: itemError } = await admin.from("laundry_order_items").insert(
      lines.map((line) => ({
        order_id: order.id,
        catalog_item_id: line.catalogItemId,
        name_snapshot: byId.get(line.catalogItemId)?.name as string,
        unit_label_snapshot: byId.get(line.catalogItemId)?.unit_label as string,
        requested_qty: line.qty,
      })),
    );
    if (itemError) {
      await admin.from("laundry_orders").delete().eq("id", order.id);
      throw new Error("Could not save laundry items.");
    }
    await admin.from("laundry_order_events").insert({
      property_id: propertyId,
      order_id: order.id,
      event_type: "front_desk_intake",
      to_status: "requested",
      notes,
      photo_public_ids: photos,
      actor_kind: "front_desk",
    });
    await writeAuditEvent(admin, {
      propertyId,
      action: "laundry.order.create",
      entityType: "laundry_orders",
      entityId: order.id as string,
      summary: `Laundry intake · Room ${roomLabel} · ${guestName}`,
      meta: { bookingId, roomUnitId, photoCount: photos.length },
    });

    const optionalStaffId = optionalTrim(formData.get("prepared_by_staff_id"));
    const bagResult = await autoPrepareDefaultBag(
      admin,
      propertyId,
      order.id as string,
      "front_desk",
      optionalStaffId,
    );

    refreshLaundry();
    const labelsUrl = `/erp/laundry/orders/${order.id}/labels`;
    return {
      ok: true,
      orderId: order.id as string,
      labelsUrl,
      message: bagResult.ok && bagResult.bags.length
        ? `Laundry ${String(order.id).slice(0, 8).toUpperCase()} created with bag label ready to print.`
        : bagResult.ok
          ? `Laundry ${String(order.id).slice(0, 8).toUpperCase()} created.`
          : `Laundry ${String(order.id).slice(0, 8).toUpperCase()} created, but bag label failed: ${bagResult.error}`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not create laundry.",
    };
  }
}

export async function assignLaundryOrder(formData: FormData): Promise<void> {
  await requireDesk();
  const orderId = trimRequired(formData.get("order_id"), "Laundry order");
  const staffRaw = optionalTrim(formData.get("staff_id"));
  const staffId = staffRaw === "__unassigned__" ? null : staffRaw;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  if (staffId) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff) throw new Error("Staff member not found.");
  }
  await admin
    .from("laundry_orders")
    .update({ assigned_staff_id: staffId, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("property_id", propertyId);
  refreshLaundry();
}

export async function reopenLaundryCorrection(
  _prev: ErpLaundryState,
  formData: FormData,
): Promise<ErpLaundryState> {
  try {
    await requireMoneyDesk();
    const orderId = trimRequired(formData.get("order_id"), "Laundry order");
    const reason = trimRequired(formData.get("reason"), "Correction reason");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: order } = await admin
      .from("laundry_orders")
      .select("id, status, folio_line_id, folio_id, total_btn, property_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) throw new Error("Laundry order not found.");
    assertDeskProperty(propertyId, order.property_id as string, "Laundry order");
    if (!order.folio_line_id) throw new Error("Laundry has not been billed.");
    if (order.status === "delivered") {
      throw new Error("Delivered laundry must be corrected from the folio.");
    }
    const now = new Date().toISOString();
    const { actor } = await resolveDeskActor();
    const voidResult = await voidFolioLineWithReversal(admin, propertyId, {
      lineId: order.folio_line_id as string,
      reason: `Laundry correction · ${reason}`,
      voidedBy: actor,
    });

    const { count: voidedCount, error: lineError } = await admin
      .from("folio_lines")
      .select("id", { count: "exact", head: true })
      .eq("id", order.folio_line_id)
      .eq("status", "voided");
    if (lineError || (voidedCount ?? 0) === 0) {
      throw new Error("Could not void the original folio charge.");
    }

    await admin
      .from("laundry_order_bags")
      .update({
        status: "voided",
        voided_at: now,
        void_reason: `Billing correction · ${reason}`,
        updated_at: now,
      })
      .eq("order_id", orderId)
      .eq("property_id", propertyId)
      .neq("status", "voided");

    await admin
      .from("laundry_order_items")
      .update({
        unit_price_btn: null,
        gst_applicable: null,
        line_total_btn: null,
      })
      .eq("order_id", orderId);
    const { error } = await admin
      .from("laundry_orders")
      .update({
        status: "requested",
        folio_line_id: null,
        subtotal_btn: null,
        service_charge_rate: null,
        service_charge_btn: null,
        gst_rate: null,
        gst_btn: null,
        total_btn: null,
        billed_at: null,
        billed_by: null,
        received_at: null,
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not reopen laundry for correction.");
    await admin.from("laundry_order_events").insert({
      property_id: propertyId,
      order_id: orderId,
      event_type: "billing_correction",
      from_status: order.status,
      to_status: "requested",
      notes: reason,
      actor_kind: "front_desk",
    });
    await writeAuditEvent(admin, {
      propertyId,
      action: "laundry.billing.correct",
      entityType: "laundry_orders",
      entityId: orderId,
      summary: `Laundry charge reopened for correction · ${reason}`,
      meta: {
        folioId: order.folio_id,
        voidedLineId: order.folio_line_id,
        reversalLineId: voidResult.reversalLineId,
        journalReversed: voidResult.journalReversed,
        previousTotalBtn: Number(order.total_btn ?? 0),
      },
    });
    await autoPrepareDefaultBag(admin, propertyId, orderId, "front_desk");
    refreshLaundry();
    return {
      ok: true,
      message: "Original folio line voided. Maid must reconfirm the count.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not reopen laundry.",
    };
  }
}

function parseDeskBagDrafts(value: FormDataEntryValue | null) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value ?? "[]"));
  } catch {
    throw new Error("Bag allocation payload is invalid.");
  }
  if (!Array.isArray(parsed)) throw new Error("Add at least one bag.");
  return parsed.map((row, index) => {
    if (!row || typeof row !== "object") {
      throw new Error(`Bag ${index + 1} is invalid.`);
    }
    const itemsRaw =
      "items" in row && Array.isArray(row.items) ? row.items : [];
    const notes =
      "notes" in row && row.notes != null ? String(row.notes).trim() : undefined;
    const items = itemsRaw.flatMap((line: unknown) => {
      if (!line || typeof line !== "object") return [];
      const orderItemId =
        "orderItemId" in line ? String(line.orderItemId) : "";
      const qty = "qty" in line ? Number(line.qty) : 0;
      return orderItemId && Number.isInteger(qty) && qty >= 1
        ? [{ orderItemId, qty }]
        : [];
    });
    return { items, notes: notes || undefined };
  });
}

export async function prepareDeskLaundryBags(
  _prev: LaundryBagState,
  formData: FormData,
): Promise<LaundryBagState> {
  try {
    await requireDesk();
    const orderId = trimRequired(formData.get("order_id"), "Laundry order");
    const staffId = trimRequired(formData.get("staff_id"), "Prepared by");
    const drafts = parseDeskBagDrafts(formData.get("bags"));
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff) throw new Error("Select a valid laundry staff member.");
    const { data: order } = await admin
      .from("laundry_orders")
      .select(
        "id, status, laundry_order_items(id, confirmed_qty, requested_qty)",
      )
      .eq("id", orderId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!order) throw new Error("Laundry order not found.");
    const items = (order.laundry_order_items ?? []) as {
      id: string;
      confirmed_qty: number | null;
      requested_qty: number;
    }[];
    const validation = validateBagAllocations(items, drafts, {
      requireFull: true,
    });
    if (!validation.ok) throw new Error(validation.error);

    const prepared = drafts.map((draft, index) => {
      const id = randomUUID();
      const rawToken = createLaundryToken();
      return {
        id,
        bagSeq: index + 1,
        publicCode: makeLaundryBagPublicCode(orderId, index + 1),
        rawToken,
        tokenHash: hashLaundryToken(rawToken),
        notes: draft.notes,
        items: draft.items,
      };
    });

    const { data: result, error } = await admin.rpc("laundry_prepare_bags", {
      p_order_id: orderId,
      p_staff_id: staffId,
      p_bags: prepared.map((bag) => ({
        id: bag.id,
        token_hash: bag.tokenHash,
        public_code: bag.publicCode,
        notes: bag.notes ?? null,
        items: bag.items.map((item: { orderItemId: string; qty: number }) => ({
          order_item_id: item.orderItemId,
          qty: item.qty,
        })),
      })),
      p_actor_kind: "front_desk",
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "laundry.bags.prepare",
      entityType: "laundry_orders",
      entityId: orderId,
      summary: `Prepared ${prepared.length} laundry bag label(s)`,
      meta: { bagCount: prepared.length, staffId },
    });
    refreshLaundry();
    revalidatePath(`/erp/laundry/orders/${orderId}/labels`);
    return {
      ok: true,
      orderId,
      message: `Prepared ${Number((result as { bag_count?: number } | null)?.bag_count ?? prepared.length)} bag label(s).`,
      bags: prepared.map((bag) => ({
        id: bag.id,
        bagSeq: bag.bagSeq,
        publicCode: bag.publicCode,
        rawToken: bag.rawToken,
        scanPath: laundryBagScanPath(bag.id, bag.rawToken),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not prepare bags.",
    };
  }
}

export async function issueDeskLaundryBagLabelTokens(
  orderId: string,
  staffId: string,
): Promise<LaundryBagState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff) throw new Error("Select a valid staff member for the audit trail.");
    const { data: bags } = await admin
      .from("laundry_order_bags")
      .select("id, bag_seq, public_code")
      .eq("order_id", orderId)
      .eq("property_id", propertyId)
      .neq("status", "voided")
      .order("bag_seq");
    if (!bags?.length) throw new Error("No active bags to print.");
    const issued = [];
    for (const bag of bags) {
      const rawToken = createLaundryToken();
      const { error } = await admin
        .from("laundry_order_bags")
        .update({
          scan_token_hash: hashLaundryToken(rawToken),
          label_printed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bag.id)
        .eq("property_id", propertyId);
      if (error) throw new Error("Could not rotate bag scan token.");
      await admin.from("laundry_bag_events").insert({
        property_id: propertyId,
        bag_id: bag.id,
        order_id: orderId,
        event_type: "label_printed",
        notes: "Scan token rotated for label print",
        actor_kind: "front_desk",
        actor_staff_id: staffId,
      });
      issued.push({
        id: bag.id as string,
        bagSeq: Number(bag.bag_seq),
        publicCode: bag.public_code as string,
        rawToken,
        scanPath: laundryBagScanPath(bag.id as string, rawToken),
      });
    }
    refreshLaundry();
    revalidatePath(`/erp/laundry/orders/${orderId}/labels`);
    return {
      ok: true,
      orderId,
      message: `Print codes ready for ${issued.length} bag(s). Previous stickers are invalidated.`,
      bags: issued,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not issue label codes.",
    };
  }
}

export async function cancelLaundryOrder(
  _prev: ErpLaundryState,
  formData: FormData,
): Promise<ErpLaundryState> {
  try {
    await requireMoneyDesk();
    const orderId = trimRequired(formData.get("order_id"), "Laundry order");
    const reason = trimRequired(formData.get("reason"), "Cancel reason");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: order } = await admin
      .from("laundry_orders")
      .select("id, status, folio_line_id, folio_id, total_btn, property_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) throw new Error("Laundry order not found.");
    assertDeskProperty(propertyId, order.property_id as string, "Laundry order");
    if (order.status === "delivered") {
      throw new Error("Delivered laundry cannot be cancelled from the desk.");
    }
    if (order.status === "cancelled") {
      throw new Error("Laundry is already cancelled.");
    }

    const now = new Date().toISOString();
    const { actor } = await resolveDeskActor();
    if (order.folio_line_id) {
      const voidResult = await voidFolioLineWithReversal(admin, propertyId, {
        lineId: order.folio_line_id as string,
        reason: `Laundry cancelled · ${reason}`,
        voidedBy: actor,
      });
      const { count: voidedCount, error: lineError } = await admin
        .from("folio_lines")
        .select("id", { count: "exact", head: true })
        .eq("id", order.folio_line_id)
        .eq("status", "voided");
      if (lineError || (voidedCount ?? 0) === 0) {
        throw new Error("Could not void the folio charge for this laundry.");
      }
      await admin
        .from("laundry_order_items")
        .update({
          unit_price_btn: null,
          gst_applicable: null,
          line_total_btn: null,
        })
        .eq("order_id", orderId);
      await writeAuditEvent(admin, {
        propertyId,
        action: "laundry.billing.cancel_void",
        entityType: "laundry_orders",
        entityId: orderId,
        summary: `Laundry folio voided on cancel · ${reason}`,
        meta: {
          folioId: order.folio_id,
          voidedLineId: order.folio_line_id,
          reversalLineId: voidResult.reversalLineId,
          journalReversed: voidResult.journalReversed,
        },
      });
    }

    await admin
      .from("laundry_order_bags")
      .update({
        status: "voided",
        voided_at: now,
        void_reason: `Order cancelled · ${reason}`,
        updated_at: now,
      })
      .eq("order_id", orderId)
      .eq("property_id", propertyId)
      .neq("status", "voided");

    const { error } = await admin
      .from("laundry_orders")
      .update({
        status: "cancelled",
        folio_line_id: null,
        subtotal_btn: null,
        service_charge_rate: null,
        service_charge_btn: null,
        gst_rate: null,
        gst_btn: null,
        total_btn: null,
        billed_at: null,
        billed_by: null,
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not cancel laundry order.");

    await admin.from("laundry_order_events").insert({
      property_id: propertyId,
      order_id: orderId,
      event_type: "cancelled",
      from_status: order.status,
      to_status: "cancelled",
      notes: reason,
      actor_kind: "front_desk",
    });
    await writeAuditEvent(admin, {
      propertyId,
      action: "laundry.order.cancel",
      entityType: "laundry_orders",
      entityId: orderId,
      summary: `Laundry cancelled · ${reason}`,
      meta: { previousStatus: order.status, hadFolio: Boolean(order.folio_line_id) },
    });
    refreshLaundry();
    return { ok: true, message: "Laundry order cancelled." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not cancel laundry.",
    };
  }
}

export async function voidDeskLaundryBag(
  _prev: LaundryBagState,
  formData: FormData,
): Promise<LaundryBagState> {
  try {
    await requireDesk();
    const bagId = trimRequired(formData.get("bag_id"), "Bag");
    const reason = trimRequired(formData.get("reason"), "Void reason");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: bag } = await admin
      .from("laundry_order_bags")
      .select("id, order_id, status, property_id")
      .eq("id", bagId)
      .maybeSingle();
    if (!bag || bag.status === "voided") throw new Error("Bag not found.");
    assertDeskProperty(propertyId, bag.property_id as string, "Laundry bag");
    if (bag.status === "delivered") {
      throw new Error("Delivered bags cannot be voided.");
    }
    const { error } = await admin
      .from("laundry_order_bags")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        void_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bagId);
    if (error) throw new Error("Could not void bag label.");
    await admin.from("laundry_bag_events").insert({
      property_id: propertyId,
      bag_id: bagId,
      order_id: bag.order_id,
      event_type: "voided",
      from_status: bag.status,
      to_status: "voided",
      notes: reason,
      actor_kind: "front_desk",
    });
    refreshLaundry();
    revalidatePath(`/erp/laundry/orders/${bag.order_id}/labels`);
    return { ok: true, message: "Bag label voided." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not void bag.",
    };
  }
}
