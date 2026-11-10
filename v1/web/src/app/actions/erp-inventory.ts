"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type InvState = { ok: boolean; error?: string; message?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateInv() {
  revalidatePath("/erp/inventory");
  revalidatePath("/erp/inventory/locations");
  revalidatePath("/erp/inventory/moves");
  revalidatePath("/erp/inventory/audits");
  revalidatePath("/erp/inventory/purchase-orders");
  revalidatePath("/erp/inventory/assets");
  revalidatePath("/erp/housekeeping");
  revalidatePath("/erp/kitchen");
}

async function assertCategorySlug(
  admin: Admin,
  propertyId: string,
  slug: string,
): Promise<void> {
  const normalized = slug.trim().toLowerCase().replace(/\s+/g, "_");
  const { data } = await admin
    .from("inventory_categories")
    .select("slug")
    .eq("property_id", propertyId)
    .eq("slug", normalized)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) throw new Error("Pick a valid category or create one first.");
}

function slugifyCategory(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

async function nextPoNumber(admin: Admin, propertyId: string): Promise<string> {
  const prefix = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const { count } = await admin
    .from("inventory_purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .like("po_number", `${prefix}%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}

async function defaultStoreLocationId(
  admin: Admin,
  propertyId: string,
): Promise<string> {
  const { data: loc } = await admin
    .from("inventory_locations")
    .select("id")
    .eq("property_id", propertyId)
    .eq("code", "STORE")
    .maybeSingle();
  if (!loc?.id) throw new Error("Main store location not found.");
  return loc.id as string;
}

function parsePositiveQty(raw: FormDataEntryValue | null, label: string): number {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return roundBtn(n);
}

function parseMoney(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? "0").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be ≥ 0.");
  return roundBtn(n);
}

async function upsertBalance(
  admin: Admin,
  propertyId: string,
  itemId: string,
  locationId: string,
  delta: number,
): Promise<number> {
  const { data: existing } = await admin
    .from("inventory_balances")
    .select("id, qty_on_hand")
    .eq("item_id", itemId)
    .eq("location_id", locationId)
    .maybeSingle();

  const current = Number(existing?.qty_on_hand ?? 0);
  const next = roundBtn(current + delta);
  if (next < 0) throw new Error("That would take location stock below zero.");

  if (existing?.id) {
    await admin
      .from("inventory_balances")
      .update({ qty_on_hand: next, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else if (next > 0) {
    await admin.from("inventory_balances").insert({
      property_id: propertyId,
      item_id: itemId,
      location_id: locationId,
      qty_on_hand: next,
    });
  }
  return next;
}

async function syncItemTotal(
  admin: Admin,
  propertyId: string,
  itemId: string,
): Promise<number> {
  const { data: rows } = await admin
    .from("inventory_balances")
    .select("qty_on_hand")
    .eq("property_id", propertyId)
    .eq("item_id", itemId);
  const total = roundBtn(
    (rows ?? []).reduce((s, r) => s + Number(r.qty_on_hand), 0),
  );
  await admin
    .from("inventory_items")
    .update({ qty_on_hand: total })
    .eq("id", itemId)
    .eq("property_id", propertyId);
  return total;
}

/** Receive stock: qty × unit price × optional receipt photo. */
export async function receiveInventoryStock(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const itemId = trimRequired(formData.get("item_id"), "Item");
    const locationId = trimRequired(formData.get("location_id"), "Location");
    const qty = parsePositiveQty(formData.get("qty"), "Quantity");
    const unitCostRaw = formData.get("unit_cost_btn");
    if (
      unitCostRaw === null ||
      unitCostRaw === undefined ||
      String(unitCostRaw).trim() === ""
    ) {
      throw new Error("Unit cost (Nu) is required on receive.");
    }
    const unitCost = parseMoney(unitCostRaw);
    if (Number.isNaN(unitCost) || unitCost < 0) {
      throw new Error("Unit cost must be zero or a positive Nu amount.");
    }
    const totalAmount = roundBtn(qty * unitCost);
    const photoUrl = optionalTrim(formData.get("photo_url"));
    const reference = optionalTrim(formData.get("reference"));
    const notes = optionalTrim(formData.get("notes"));

    const { data: item } = await admin
      .from("inventory_items")
      .select("id, sku, name")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .single();
    if (!item) throw new Error("Item not found.");

    await upsertBalance(admin, propertyId, itemId, locationId, qty);

    const { error: moveErr } = await admin.from("inventory_movements").insert({
      property_id: propertyId,
      item_id: itemId,
      movement_kind: "receive",
      qty_delta: qty,
      unit_cost_btn: unitCost,
      total_amount_btn: totalAmount,
      location_id: locationId,
      photo_url: photoUrl || null,
      reference,
      notes,
      created_by: "desk",
    });
    if (moveErr) throw new Error(moveErr.message);

    if (unitCost > 0) {
      await admin
        .from("inventory_items")
        .update({ unit_cost_btn: unitCost })
        .eq("id", itemId);
    }

    await syncItemTotal(admin, propertyId, itemId);

    await writeAuditEvent(admin, {
      propertyId,
      action: "inventory.receive",
      entityType: "inventory_items",
      entityId: itemId,
      summary: `Received ${qty} × ${item.sku as string}`,
      meta: { location_id: locationId, total_amount_btn: totalAmount },
    });

    revalidateInv();
    return { ok: true, message: `Received ${qty} · ${formatNu(totalAmount)}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Record damage with replace now/later and optional photo. */
export async function recordInventoryDamage(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const itemId = trimRequired(formData.get("item_id"), "Item");
    const locationId = trimRequired(formData.get("location_id"), "Location");
    const qty = parsePositiveQty(formData.get("qty"), "Quantity");
    const replaceMode = trimRequired(formData.get("damage_replace_mode"), "Replace mode");
    if (!["now", "later", "transfer", "purchase"].includes(replaceMode)) {
      throw new Error("Invalid replace mode.");
    }
    const photoUrl = optionalTrim(formData.get("photo_url"));
    const notes = optionalTrim(formData.get("notes"));

    const { data: item } = await admin
      .from("inventory_items")
      .select("id, sku, unit_cost_btn")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .single();
    if (!item) throw new Error("Item not found.");

    await upsertBalance(admin, propertyId, itemId, locationId, -qty);

    const unitCost = Number(item.unit_cost_btn ?? 0);
    const { error: moveErr } = await admin.from("inventory_movements").insert({
      property_id: propertyId,
      item_id: itemId,
      movement_kind: "damage",
      qty_delta: -qty,
      unit_cost_btn: unitCost,
      total_amount_btn: roundBtn(qty * unitCost),
      location_id: locationId,
      photo_url: photoUrl || null,
      damage_replace_mode: replaceMode,
      notes,
      created_by: "desk",
    });
    if (moveErr) throw new Error(moveErr.message);

    await syncItemTotal(admin, propertyId, itemId);

    if (replaceMode === "now" || replaceMode === "transfer") {
      const toLocationId = optionalTrim(formData.get("replace_location_id")) ?? locationId;
      await upsertBalance(admin, propertyId, itemId, toLocationId, qty);
      await admin.from("inventory_movements").insert({
        property_id: propertyId,
        item_id: itemId,
        movement_kind: "transfer",
        qty_delta: qty,
        location_id: toLocationId,
        notes: `Replace after damage · ${replaceMode}`,
        created_by: "desk",
      });
      await syncItemTotal(admin, propertyId, itemId);
    }

    revalidateInv();
    return {
      ok: true,
      message:
        replaceMode === "later" || replaceMode === "purchase"
          ? `Damage logged · replace ${replaceMode}.`
          : "Damage logged · stock replaced.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Transfer qty between locations. */
export async function transferInventoryStock(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const itemId = trimRequired(formData.get("item_id"), "Item");
    const fromLocationId = trimRequired(formData.get("from_location_id"), "From location");
    const toLocationId = trimRequired(formData.get("to_location_id"), "To location");
    if (fromLocationId === toLocationId) {
      throw new Error("Pick two different locations.");
    }
    const qty = parsePositiveQty(formData.get("qty"), "Quantity");
    const notes = optionalTrim(formData.get("notes"));

    const { data: item } = await admin
      .from("inventory_items")
      .select("id, sku")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .single();
    if (!item) throw new Error("Item not found.");

    await upsertBalance(admin, propertyId, itemId, fromLocationId, -qty);
    await upsertBalance(admin, propertyId, itemId, toLocationId, qty);

    const { error: moveErr } = await admin.from("inventory_movements").insert({
      property_id: propertyId,
      item_id: itemId,
      movement_kind: "transfer",
      qty_delta: qty,
      location_id: fromLocationId,
      to_location_id: toLocationId,
      notes,
      created_by: "desk",
    });
    if (moveErr) throw new Error(moveErr.message);

    await syncItemTotal(admin, propertyId, itemId);

    revalidateInv();
    return { ok: true, message: `Transferred ${qty} · ${item.sku as string}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Update room amenity par qty from Settings. */
export async function updateRoomAmenityPar(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const parId = trimRequired(formData.get("par_id"), "Par row");
    const parQty = parsePositiveQty(formData.get("par_qty"), "Par qty");
    const isActive = formData.get("is_active") === "on";

    const { error } = await admin
      .from("room_amenity_pars")
      .update({ par_qty: parQty, is_active: isActive })
      .eq("id", parId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/settings");
    revalidatePath("/erp/housekeeping");
    return { ok: true, message: "Par level saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Assign HK staff to an existing assignment (inline on board). */
export async function assignHkStaff(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const assignmentId = trimRequired(formData.get("assignment_id"), "Assignment");
    const staffId = optionalTrim(formData.get("staff_id"));

    if (staffId) {
      const { data: staff } = await admin
        .from("staff_members")
        .select("id")
        .eq("id", staffId)
        .eq("property_id", propertyId)
        .eq("status", "active")
        .maybeSingle();
      if (!staff) throw new Error("Staff member not found.");
    }

    const patch: Record<string, unknown> = {
      staff_id: staffId || null,
      status: staffId ? "in_progress" : "open",
    };

    const { error } = await admin
      .from("hk_assignments")
      .update(patch)
      .eq("id", assignmentId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/housekeeping");
    revalidatePath("/erp/rooms");
    return { ok: true, message: staffId ? "Attendant assigned." : "Assignment unassigned." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

function formatNu(n: number): string {
  return `Nu ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Create draft PO with line items. */
export async function createPurchaseOrder(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const vendorName = trimRequired(formData.get("vendor_name"), "Vendor");
    const notes = optionalTrim(formData.get("notes"));
    const receiveLocationId =
      optionalTrim(formData.get("receive_location_id")) ??
      (await defaultStoreLocationId(admin, propertyId));

    const itemIds = formData.getAll("line_item_id").map(String).filter(Boolean);
    const qtys = formData.getAll("line_qty").map(String);
    const costs = formData.getAll("line_unit_cost").map(String);
    if (itemIds.length === 0) throw new Error("Add at least one line item.");

    const lines: {
      item_id: string;
      sku_snapshot: string;
      name_snapshot: string;
      qty_ordered: number;
      unit_cost_btn: number;
    }[] = [];

    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i];
      const qty = parsePositiveQty(qtys[i] ?? null, "Line qty");
      const unitCost = parseMoney(costs[i] ?? null);
      const { data: item } = await admin
        .from("inventory_items")
        .select("id, sku, name")
        .eq("id", itemId)
        .eq("property_id", propertyId)
        .single();
      if (!item) throw new Error("Item not found.");
      lines.push({
        item_id: itemId,
        sku_snapshot: item.sku as string,
        name_snapshot: item.name as string,
        qty_ordered: qty,
        unit_cost_btn: unitCost,
      });
    }

    const poNumber = await nextPoNumber(admin, propertyId);
    const { data: po, error: poErr } = await admin
      .from("inventory_purchase_orders")
      .insert({
        property_id: propertyId,
        po_number: poNumber,
        vendor_name: vendorName,
        status: "draft",
        notes,
        receive_location_id: receiveLocationId,
      })
      .select("id")
      .single();
    if (poErr || !po) throw new Error(poErr?.message ?? "Could not create PO.");

    const { error: lineErr } = await admin.from("inventory_purchase_order_lines").insert(
      lines.map((l) => ({
        purchase_order_id: po.id,
        item_id: l.item_id,
        sku_snapshot: l.sku_snapshot,
        name_snapshot: l.name_snapshot,
        qty_ordered: l.qty_ordered,
        unit_cost_btn: l.unit_cost_btn,
      })),
    );
    if (lineErr) {
      await admin.from("inventory_purchase_orders").delete().eq("id", po.id);
      throw new Error(lineErr.message);
    }

    revalidateInv();
    return { ok: true, message: `Draft ${poNumber} created.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Approve draft PO → ordered. */
export async function approvePurchaseOrder(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const poId = trimRequired(formData.get("po_id"), "PO");

    const { data: po } = await admin
      .from("inventory_purchase_orders")
      .select("id, po_number, status")
      .eq("id", poId)
      .eq("property_id", propertyId)
      .single();
    if (!po) throw new Error("PO not found.");
    if ((po.status as string) !== "draft") {
      throw new Error("Only draft POs can be approved.");
    }

    const { error } = await admin
      .from("inventory_purchase_orders")
      .update({
        status: "ordered",
        ordered_at: new Date().toISOString(),
      })
      .eq("id", poId);
    if (error) throw new Error(error.message);

    revalidateInv();
    return { ok: true, message: `${po.po_number as string} marked ordered.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Receive PO lines into stock. */
export async function receivePurchaseOrder(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const poId = trimRequired(formData.get("po_id"), "PO");

    const { data: po } = await admin
      .from("inventory_purchase_orders")
      .select("id, po_number, status, receive_location_id")
      .eq("id", poId)
      .eq("property_id", propertyId)
      .single();
    if (!po) throw new Error("PO not found.");
    if (!["ordered", "partial"].includes(po.status as string)) {
      throw new Error("PO must be ordered or partial to receive.");
    }

    const locationId =
      (po.receive_location_id as string | null) ??
      (await defaultStoreLocationId(admin, propertyId));

    const lineIds = formData.getAll("line_id").map(String).filter(Boolean);
    const receiveQtys = formData.getAll("receive_qty").map(String);
    if (lineIds.length === 0) throw new Error("Select lines to receive.");

    let receivedAny = false;
    for (let i = 0; i < lineIds.length; i++) {
      const lineId = lineIds[i];
      const qtyRaw = receiveQtys[i];
      if (!qtyRaw || Number(qtyRaw) <= 0) continue;
      const qty = parsePositiveQty(qtyRaw, "Receive qty");

      const { data: line } = await admin
        .from("inventory_purchase_order_lines")
        .select(
          "id, item_id, qty_ordered, qty_received, unit_cost_btn, sku_snapshot",
        )
        .eq("id", lineId)
        .eq("purchase_order_id", poId)
        .single();
      if (!line?.item_id) continue;

      const remaining =
        Number(line.qty_ordered) - Number(line.qty_received ?? 0);
      if (qty > remaining + 0.001) {
        throw new Error(`Receive qty exceeds remaining on ${line.sku_snapshot}.`);
      }

      const itemId = line.item_id as string;
      const unitCost = Number(line.unit_cost_btn);
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error(
          `Unit cost required on PO line ${line.sku_snapshot ?? lineId}.`,
        );
      }
      await upsertBalance(admin, propertyId, itemId, locationId, qty);

      await admin.from("inventory_movements").insert({
        property_id: propertyId,
        item_id: itemId,
        movement_kind: "receive",
        qty_delta: qty,
        unit_cost_btn: unitCost,
        total_amount_btn: roundBtn(qty * unitCost),
        location_id: locationId,
        reference: po.po_number as string,
        notes: `PO receive · ${po.po_number}`,
        created_by: "desk",
      });

      await admin
        .from("inventory_purchase_order_lines")
        .update({ qty_received: roundBtn(Number(line.qty_received) + qty) })
        .eq("id", lineId);

      if (unitCost > 0) {
        await admin
          .from("inventory_items")
          .update({ unit_cost_btn: unitCost })
          .eq("id", itemId);
      }
      await syncItemTotal(admin, propertyId, itemId);
      receivedAny = true;
    }

    if (!receivedAny) throw new Error("Enter receive quantities.");

    const { data: allLines } = await admin
      .from("inventory_purchase_order_lines")
      .select("qty_ordered, qty_received")
      .eq("purchase_order_id", poId);

    const allReceived = (allLines ?? []).every(
      (l) => Number(l.qty_received) >= Number(l.qty_ordered),
    );
    const anyReceived = (allLines ?? []).some((l) => Number(l.qty_received) > 0);

    await admin
      .from("inventory_purchase_orders")
      .update({
        status: allReceived ? "received" : anyReceived ? "partial" : po.status,
        received_at: allReceived ? new Date().toISOString() : null,
      })
      .eq("id", poId);

    revalidateInv();
    return {
      ok: true,
      message: allReceived
        ? `${po.po_number as string} fully received.`
        : "Partial receive recorded.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Start stock audit at a location — seeds lines from balances. */
export async function startInventoryAudit(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const locationId = optionalTrim(formData.get("location_id"));
    const notes = optionalTrim(formData.get("notes"));
    const businessDate =
      optionalTrim(formData.get("business_date")) ??
      new Date().toISOString().slice(0, 10);

    const { data: openAudit } = await admin
      .from("inventory_audits")
      .select("id")
      .eq("property_id", propertyId)
      .eq("status", "open")
      .maybeSingle();
    if (openAudit?.id) {
      throw new Error("Finish or cancel the open audit first.");
    }

    const { data: audit, error: auditErr } = await admin
      .from("inventory_audits")
      .insert({
        property_id: propertyId,
        location_id: locationId || null,
        business_date: businessDate,
        status: "open",
        notes,
        created_by: "desk",
      })
      .select("id")
      .single();
    if (auditErr || !audit) throw new Error(auditErr?.message ?? "Could not start audit.");

    let balanceQuery = admin
      .from("inventory_balances")
      .select("item_id, qty_on_hand, location_id")
      .eq("property_id", propertyId);
    if (locationId) balanceQuery = balanceQuery.eq("location_id", locationId);

    const { data: balances } = await balanceQuery;
    const byItem = new Map<string, number>();
    for (const b of balances ?? []) {
      const itemId = b.item_id as string;
      byItem.set(itemId, roundBtn((byItem.get(itemId) ?? 0) + Number(b.qty_on_hand)));
    }

    if (byItem.size === 0) {
      const { data: items } = await admin
        .from("inventory_items")
        .select("id, qty_on_hand")
        .eq("property_id", propertyId)
        .eq("is_active", true);
      for (const item of items ?? []) {
        byItem.set(item.id as string, Number(item.qty_on_hand));
      }
    }

    const auditLines = [...byItem.entries()].map(([itemId, expected]) => ({
      audit_id: audit.id,
      item_id: itemId,
      expected_qty: expected,
    }));

    if (auditLines.length > 0) {
      await admin.from("inventory_audit_lines").insert(auditLines);
    }

    revalidateInv();
    return { ok: true, message: "Audit started — enter counts and post." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Save counted qty on audit lines (batch). */
export async function saveInventoryAuditCounts(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const auditId = trimRequired(formData.get("audit_id"), "Audit");

    const { data: audit } = await admin
      .from("inventory_audits")
      .select("id, status")
      .eq("id", auditId)
      .eq("property_id", propertyId)
      .single();
    if (!audit) throw new Error("Audit not found.");
    if ((audit.status as string) !== "open") throw new Error("Audit is not open.");

    const lineIds = formData.getAll("line_id").map(String);
    const countedQtys = formData.getAll("counted_qty").map(String);

    for (let i = 0; i < lineIds.length; i++) {
      const lineId = lineIds[i];
      const raw = countedQtys[i];
      if (raw === undefined || raw === "") continue;
      const counted = roundBtn(Number(String(raw).replace(/,/g, "")));
      if (!Number.isFinite(counted) || counted < 0) {
        throw new Error("Counted qty must be zero or positive.");
      }

      const { data: line } = await admin
        .from("inventory_audit_lines")
        .select("expected_qty")
        .eq("id", lineId)
        .eq("audit_id", auditId)
        .single();
      if (!line) continue;

      const variance = roundBtn(counted - Number(line.expected_qty));
      await admin
        .from("inventory_audit_lines")
        .update({ counted_qty: counted, variance_qty: variance })
        .eq("id", lineId);
    }

    revalidateInv();
    return { ok: true, message: "Counts saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Post audit — apply variances as count adjustments. */
export async function postInventoryAudit(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const auditId = trimRequired(formData.get("audit_id"), "Audit");

    const { data: audit } = await admin
      .from("inventory_audits")
      .select("id, status, location_id, business_date")
      .eq("id", auditId)
      .eq("property_id", propertyId)
      .single();
    if (!audit) throw new Error("Audit not found.");
    if ((audit.status as string) !== "open") throw new Error("Audit already posted.");

    const locationId =
      (audit.location_id as string | null) ??
      (await defaultStoreLocationId(admin, propertyId));

    const { data: lines } = await admin
      .from("inventory_audit_lines")
      .select(
        "id, item_id, expected_qty, counted_qty, variance_qty, inventory_items(sku, unit_cost_btn)",
      )
      .eq("audit_id", auditId);

    let adjusted = 0;
    for (const line of lines ?? []) {
      const counted = line.counted_qty;
      if (counted == null) continue;
      const variance =
        line.variance_qty != null
          ? Number(line.variance_qty)
          : roundBtn(Number(counted) - Number(line.expected_qty));
      if (Math.abs(variance) < 0.001) continue;

      const itemId = line.item_id as string;
      const item = line.inventory_items as {
        sku?: string;
        unit_cost_btn?: number;
      } | null;
      await upsertBalance(admin, propertyId, itemId, locationId, variance);

      const unitCost = Number(item?.unit_cost_btn ?? 0);
      await admin.from("inventory_movements").insert({
        property_id: propertyId,
        item_id: itemId,
        movement_kind: "count",
        qty_delta: variance,
        unit_cost_btn: unitCost,
        total_amount_btn: roundBtn(Math.abs(variance) * unitCost),
        location_id: locationId,
        reference: `AUDIT-${String(audit.business_date)}`,
        notes: `Stock audit post · expected ${line.expected_qty} counted ${counted}`,
        created_by: "desk",
      });
      await syncItemTotal(admin, propertyId, itemId);
      adjusted += 1;
    }

    await admin
      .from("inventory_audits")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
      })
      .eq("id", auditId);

    revalidateInv();
    return {
      ok: true,
      message:
        adjusted === 0
          ? "Audit posted — no variances."
          : `Audit posted · ${adjusted} SKU${adjusted === 1 ? "" : "s"} adjusted.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Staff-defined stock category. */
export async function createInventoryCategory(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const name = trimRequired(formData.get("name"), "Category name");
    const slug = slugifyCategory(name);
    if (!slug) throw new Error("Category name is too short.");

    const { error } = await admin.from("inventory_categories").insert({
      property_id: propertyId,
      slug,
      name: name.trim(),
      sort_order: 50,
    });
    if (error) {
      if (error.message.includes("duplicate")) {
        throw new Error("That category already exists.");
      }
      throw new Error(error.message);
    }

    revalidateInv();
    return { ok: true, message: `Category “${name.trim()}” added.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

type BulkItemInput = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  reorder_level?: number;
  unit_cost_btn?: number;
  default_location_id?: string | null;
};

const INV_UNITS = new Set(["ea", "kg", "g", "l", "ml", "case"]);

/** Table/sheet bulk add — one row per SKU. */
export async function bulkCreateInventoryItems(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const raw = trimRequired(formData.get("rows_json"), "Rows");
    let rows: BulkItemInput[];
    try {
      rows = JSON.parse(raw) as BulkItemInput[];
    } catch {
      throw new Error("Could not read item rows.");
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Add at least one item row.");
    }
    if (rows.length > 50) throw new Error("Save up to 50 items at a time.");

    let saved = 0;
    for (const row of rows) {
      const sku = row.sku?.trim().toUpperCase();
      const name = row.name?.trim();
      const category = row.category?.trim().toLowerCase();
      const unit = row.unit?.trim().toLowerCase() || "ea";
      if (!sku || !name || !category) continue;
      if (!INV_UNITS.has(unit)) throw new Error(`Invalid unit on ${sku}.`);
      await assertCategorySlug(admin, propertyId, category);

      const reorder = roundBtn(Number(row.reorder_level) || 0);
      const unitCost = roundBtn(Number(row.unit_cost_btn) || 0);
      const locationId = row.default_location_id?.trim() || null;

      const { data, error } = await admin
        .from("inventory_items")
        .insert({
          property_id: propertyId,
          sku,
          name,
          category,
          unit,
          qty_on_hand: 0,
          reorder_level: reorder,
          unit_cost_btn: unitCost,
          default_location_id: locationId,
        })
        .select("id")
        .single();
      if (error) {
        throw new Error(
          error.message.includes("duplicate")
            ? `SKU ${sku} already exists.`
            : error.message,
        );
      }

      await writeAuditEvent(admin, {
        propertyId,
        action: "inventory.create",
        entityType: "inventory_items",
        entityId: data.id as string,
        summary: `Created SKU ${sku}`,
      });
      saved += 1;
    }

    if (saved === 0) throw new Error("No valid rows to save.");

    revalidateInv();
    return {
      ok: true,
      message: `${saved} item${saved === 1 ? "" : "s"} added to catalog.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const LOC_DEPARTMENTS = new Set([
  "room",
  "pantry",
  "store",
  "fnb",
  "kitchen",
  "maintenance",
  "laundry",
  "other",
]);

/** Add a stock location (store, pantry, kitchen cart, etc.). */
export async function createInventoryLocation(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const code = trimRequired(formData.get("code"), "Code")
      .toUpperCase()
      .replace(/\s+/g, "-")
      .slice(0, 24);
    const name = trimRequired(formData.get("name"), "Name");
    const department = trimRequired(formData.get("department"), "Department").toLowerCase();
    if (!LOC_DEPARTMENTS.has(department)) throw new Error("Invalid department.");

    const { count } = await admin
      .from("inventory_locations")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId);
    const sortOrder = (count ?? 0) + 1;

    const { error } = await admin.from("inventory_locations").insert({
      property_id: propertyId,
      code,
      name: name.trim(),
      department,
      sort_order: sortOrder,
    });
    if (error) {
      throw new Error(
        error.message.includes("duplicate") ? "Location code already exists." : error.message,
      );
    }

    revalidateInv();
    return { ok: true, message: `Location ${code} added.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Register fixed asset (lite). */
export async function registerFixedAsset(
  _prev: InvState,
  formData: FormData,
): Promise<InvState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const assetCode = trimRequired(formData.get("asset_code"), "Asset code");
    const name = trimRequired(formData.get("name"), "Name");
    const category = optionalTrim(formData.get("category")) ?? "equipment";
    const purchaseDate = trimRequired(formData.get("purchase_date"), "Purchase date");
    const costBtn = parseMoney(formData.get("cost_btn"));
    const usefulLifeMonths = Number(formData.get("useful_life_months") ?? 60);
    if (!Number.isFinite(usefulLifeMonths) || usefulLifeMonths <= 0) {
      throw new Error("Useful life must be positive months.");
    }
    const notes = optionalTrim(formData.get("notes"));

    const { error } = await admin.from("accounting_fixed_assets").insert({
      property_id: propertyId,
      asset_code: assetCode.toUpperCase(),
      name,
      category,
      purchase_date: purchaseDate,
      cost_btn: costBtn,
      useful_life_months: usefulLifeMonths,
      notes,
    });
    if (error) throw new Error(error.message);

    revalidateInv();
    return { ok: true, message: `Asset ${assetCode.toUpperCase()} registered.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
