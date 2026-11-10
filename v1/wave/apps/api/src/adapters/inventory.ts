import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";

/**
 * Inventory + POs. Real tables: inventory_locations, inventory_items,
 * inventory_purchase_orders (no total column — computed from lines),
 * inventory_purchase_order_lines. PO number format matches Innora:
 * PO-YYYYMMDD-NNN, unique per property.
 */
export async function listInventory(ctx: AdapterCtx) {
  const [locations, items, pos] = await Promise.all([
    ctx.admin
      .from("inventory_locations")
      .select("id, code, name, department, is_active")
      .eq("property_id", ctx.jwt.propertyId)
      .order("sort_order"),
    ctx.admin
      .from("inventory_items")
      .select("id, name, sku, category, unit, qty_on_hand, reorder_level, unit_cost_btn, is_active")
      .eq("property_id", ctx.jwt.propertyId)
      .eq("is_active", true)
      .order("name")
      .limit(500),
    ctx.admin
      .from("inventory_purchase_orders")
      .select(
        "id, po_number, vendor_name, status, notes, ordered_at, received_at, created_at, inventory_purchase_order_lines(qty_ordered, qty_received, unit_cost_btn)",
      )
      .eq("property_id", ctx.jwt.propertyId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (locations.error) throw locations.error;
  if (items.error) throw items.error;
  if (pos.error) throw pos.error;

  return {
    locations: (locations.data ?? []).map((l) => ({ ...l, kind: l.department })),
    items: items.data ?? [],
    purchaseOrders: (pos.data ?? []).map((po) => {
      const lines = (po.inventory_purchase_order_lines ?? []) as Array<{
        qty_ordered: number;
        unit_cost_btn: number;
      }>;
      const total = lines.reduce(
        (s, l) => s + Number(l.qty_ordered) * Number(l.unit_cost_btn),
        0,
      );
      return {
        id: po.id,
        po_number: po.po_number,
        vendor_name: po.vendor_name,
        status: po.status,
        notes: po.notes,
        ordered_at: po.ordered_at,
        received_at: po.received_at,
        created_at: po.created_at,
        line_count: lines.length,
        total_btn: Math.round(total * 100) / 100,
      };
    }),
  };
}

const poSchema = z.object({
  vendorName: z.string().min(1),
  notes: z.string().optional(),
  receiveLocationId: z.string().uuid().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid().optional(),
        name: z.string().min(1),
        qty: z.number().positive(),
        unitCostBtn: z.number().nonnegative(),
      }),
    )
    .min(1),
  idempotencyKey: z.string().min(8),
});

async function nextPoNumber(ctx: AdapterCtx, attempt: number): Promise<string> {
  const day = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" })
    .replace(/-/g, "");
  const prefix = `PO-${day}`;
  const { count, error } = await ctx.admin
    .from("inventory_purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("property_id", ctx.jwt.propertyId)
    .like("po_number", `${prefix}%`);
  if (error) throw error;
  return `${prefix}-${String((count ?? 0) + 1 + attempt).padStart(3, "0")}`;
}

export async function createPurchaseOrder(ctx: AdapterCtx, raw: unknown) {
  const input = poSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  // Resolve catalog items (property-scoped) for sku snapshots.
  const itemIds = input.lines.map((l) => l.itemId).filter((x): x is string => Boolean(x));
  const skuById = new Map<string, { sku: string; name: string }>();
  if (itemIds.length) {
    const { data, error } = await ctx.admin
      .from("inventory_items")
      .select("id, sku, name")
      .eq("property_id", ctx.jwt.propertyId)
      .in("id", itemIds);
    if (error) throw error;
    for (const it of data ?? []) {
      skuById.set(it.id as string, { sku: it.sku as string, name: it.name as string });
    }
    if (skuById.size !== new Set(itemIds).size) {
      throw new Error("One or more items do not belong to this property");
    }
  }

  let po: { id: string; po_number: string; status: string } | null = null;
  for (let attempt = 0; attempt < 4 && !po; attempt++) {
    const poNumber = await nextPoNumber(ctx, attempt);
    const { data, error } = await ctx.admin
      .from("inventory_purchase_orders")
      .insert({
        property_id: ctx.jwt.propertyId,
        po_number: poNumber,
        vendor_name: input.vendorName,
        status: "draft",
        notes: input.notes ?? null,
        receive_location_id: input.receiveLocationId ?? null,
      })
      .select("id, po_number, status")
      .single();
    if (!error && data) {
      po = data as { id: string; po_number: string; status: string };
    } else if (error && error.code !== "23505") {
      throw error;
    }
  }
  if (!po) throw new Error("Could not allocate a PO number — try again");

  const { error: lineErr } = await ctx.admin
    .from("inventory_purchase_order_lines")
    .insert(
      input.lines.map((l) => ({
        purchase_order_id: po!.id,
        item_id: l.itemId ?? null,
        sku_snapshot: l.itemId ? (skuById.get(l.itemId)?.sku ?? null) : null,
        name_snapshot: l.itemId ? (skuById.get(l.itemId)?.name ?? l.name) : l.name,
        qty_ordered: l.qty,
        unit_cost_btn: Math.round(l.unitCostBtn * 100) / 100,
      })),
    );
  if (lineErr) {
    await ctx.admin.from("inventory_purchase_orders").delete().eq("id", po.id);
    throw lineErr;
  }

  const total = input.lines.reduce((s, l) => s + l.qty * l.unitCostBtn, 0);
  const result = {
    ok: true,
    purchaseOrderId: po.id,
    poNumber: po.po_number,
    totalBtn: Math.round(total * 100) / 100,
    status: po.status,
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "create_po",
    result,
  );
  return result;
}
