"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
import { calculateOrderTotals, roundBtn } from "@/lib/pricing";
import { absoluteUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import type { LaundryBagState } from "@/app/actions/laundry-bags";

export type ErpLaundryState = {
  ok: boolean;
  message?: string;
  orderId?: string;
  labelsUrl?: string;
  payUrl?: string;
  estimatedTotalBtn?: number;
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

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

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

async function createDeskWalkInOrder(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  formData: FormData,
  lines: DeskLine[],
): Promise<ErpLaundryState> {
  const guestName = trimRequired(formData.get("guest_name"), "Guest name");
  const guestPhone = normalizePhone(
    trimRequired(formData.get("guest_phone"), "Mobile number"),
  );
  if (guestName.length > 100) throw new Error("Name is too long.");
  if (guestPhone.length < 8 || guestPhone.length > 20) {
    throw new Error("Enter a valid mobile number.");
  }
  const roomHint = optionalTrim(formData.get("room_hint"))?.slice(0, 30);
  const notes = optionalTrim(formData.get("notes"));

  const { data: property } = await admin
    .from("properties")
    .select(
      "id, gst_rate, service_charge_rate, service_charge_default_on, bank_accounts",
    )
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) throw new Error("Property is not configured.");

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
    .select("id, name, unit_label, price_btn, gst_applicable")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .in("id", ids);
  if (!catalog || catalog.length !== new Set(ids).size) {
    throw new Error("One or more laundry services are unavailable.");
  }
  const byId = new Map(catalog.map((item) => [item.id as string, item]));
  const pricingLines = lines.map((line) => {
    const item = byId.get(line.catalogItemId)!;
    return {
      qty: line.qty,
      unitPriceBtn: Number(item.price_btn),
      gstApplicable: Boolean(item.gst_applicable),
    };
  });
  const totals = calculateOrderTotals(pricingLines, {
    gstRate: Number(property.gst_rate ?? 0.07),
    serviceChargeRate: Number(property.service_charge_rate ?? 0),
    applyServiceCharge: Boolean(property.service_charge_default_on),
  });
  if (totals.totalBtn <= 0) {
    throw new Error("Order total must be greater than zero.");
  }

  const { data: order, error: orderError } = await admin
    .from("laundry_orders")
    .insert({
      property_id: propertyId,
      booking_id: null,
      room_unit_id: null,
      guest_name: guestName,
      guest_phone: guestPhone,
      room_label_snapshot: roomHint || "Walk-in",
      source: "walk_in",
      requested_notes: notes,
      intake_photo_public_ids: photos,
      subtotal_btn: totals.subtotalBtn,
      service_charge_btn: totals.serviceChargeBtn,
      gst_btn: totals.gstBtn,
      total_btn: totals.totalBtn,
    })
    .select("id")
    .single();
  if (orderError || !order) throw new Error("Could not create walk-in laundry order.");

  const { error: itemError } = await admin.from("laundry_order_items").insert(
    lines.map((line) => {
      const item = byId.get(line.catalogItemId)!;
      return {
        order_id: order.id,
        catalog_item_id: line.catalogItemId,
        name_snapshot: item.name as string,
        unit_label_snapshot: item.unit_label as string,
        requested_qty: line.qty,
      };
    }),
  );
  if (itemError) {
    await admin.from("laundry_orders").delete().eq("id", order.id);
    throw new Error("Could not save laundry items.");
  }

  const banks = (property.bank_accounts as { hint?: string }[] | null) ?? [];
  const bankHint =
    banks.find((b) => b.hint)?.hint ??
    "BoB / BNB / TBank / DrukPNB — quote laundry ref in remarks";
  const token = createHash("sha256")
    .update(randomBytes(24))
    .digest("hex")
    .slice(0, 24);
  const expires = new Date();
  expires.setDate(expires.getDate() + 3);

  const { data: link, error: linkError } = await admin
    .from("payment_links")
    .insert({
      property_id: propertyId,
      token,
      amount_btn: roundBtn(totals.totalBtn),
      purpose: "balance",
      payee_name: guestName,
      payee_phone: guestPhone,
      bank_hint: bankHint,
      expires_at: expires.toISOString(),
      notes: `Laundry walk-in · order ${String(order.id).slice(0, 8).toUpperCase()}`,
      status: "open",
    })
    .select("id, token")
    .single();
  if (linkError || !link) {
    await admin.from("laundry_orders").delete().eq("id", order.id);
    throw new Error("Could not create payment link.");
  }

  await admin
    .from("laundry_orders")
    .update({ payment_link_id: link.id })
    .eq("id", order.id);

  await admin.from("laundry_order_events").insert({
    property_id: propertyId,
    order_id: order.id,
    event_type: "front_desk_intake",
    to_status: "requested",
    notes: notes ?? "Walk-in desk intake",
    photo_public_ids: photos,
    actor_kind: "front_desk",
  });

  await writeAuditEvent(admin, {
    propertyId,
    action: "laundry.order.create",
    entityType: "laundry_orders",
    entityId: order.id as string,
    summary: `Walk-in laundry · ${guestName} · ${guestPhone}`,
    meta: { source: "walk_in", photoCount: photos.length },
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
  const payUrl = absoluteUrl(`/pay/${link.token as string}`);
  const orderRef = String(order.id).slice(0, 8).toUpperCase();
  return {
    ok: true,
    orderId: order.id as string,
    labelsUrl,
    payUrl,
    estimatedTotalBtn: totals.totalBtn,
    message: bagResult.ok && bagResult.bags.length
      ? `Walk-in ${orderRef} created · send pay link (${formatDeskTotal(totals.totalBtn)}) before processing.`
      : `Walk-in ${orderRef} created · send pay link (${formatDeskTotal(totals.totalBtn)}).`,
  };
}

function formatDeskTotal(total: number): string {
  return `Nu ${total.toFixed(2)}`;
}

export async function createDeskLaundryOrder(
  _prev: ErpLaundryState,
  formData: FormData,
): Promise<ErpLaundryState> {
  try {
    await requireDesk();
    const intakeMode = optionalTrim(formData.get("intake_mode")) ?? "in_house";
    const lines = parseDeskLines(formData.get("items"));
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    if (intakeMode === "walk_in") {
      return await createDeskWalkInOrder(admin, propertyId, formData, lines);
    }

    const bookingId = trimRequired(formData.get("booking_id"), "Guest stay");
    const roomUnitId = trimRequired(formData.get("room_unit_id"), "Room");
    const guestName = trimRequired(formData.get("guest_name"), "Guest name");
    const notes = optionalTrim(formData.get("notes"));
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

    const { sealPreparedBagTokens } = await import(
      "@/lib/laundry-issue-labels"
    );
    await sealPreparedBagTokens(
      admin,
      propertyId,
      prepared.map((bag) => ({ id: bag.id, rawToken: bag.rawToken })),
    );

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
  options?: { rotate?: boolean },
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
    const { issueOrderBagLabelTokens } = await import(
      "@/lib/laundry-issue-labels"
    );
    const issued = await issueOrderBagLabelTokens(admin, {
      propertyId,
      orderId,
      staffId,
      actorKind: "front_desk",
      rotate: options?.rotate === true,
    });
    refreshLaundry();
    revalidatePath(`/erp/laundry/orders/${orderId}/labels`);
    return {
      ok: true,
      orderId,
      message: issued.message,
      bags: issued.bags,
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
