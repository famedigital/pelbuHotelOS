import { z } from "zod";
import type { AdapterCtx } from "./types.js";
import { loadIdempotent, saveIdempotent } from "./idempotency.js";
import { ensureOpenFolio, postChargeAtomic } from "./folio-rpc.js";

export async function listPosMenu(ctx: AdapterCtx) {
  const { data: items, error } = await ctx.admin
    .from("menu_items")
    .select(
      "id, name, price_btn, category, outlet, is_available, prep_station, sort_order",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .eq("is_available", true)
    .order("category")
    .order("sort_order")
    .order("name");
  if (error) throw error;

  const outlets = [
    ...new Set((items ?? []).map((i) => String(i.outlet || "restaurant"))),
  ].map((code) => ({
    id: code,
    name: code.replace(/_/g, " "),
    code,
    kind: code,
  }));

  return {
    outlets: outlets.length
      ? outlets
      : [
          {
            id: "restaurant",
            name: "Restaurant",
            code: "restaurant",
            kind: "restaurant",
          },
        ],
    items: (items ?? []).map((i) => ({
      id: i.id as string,
      name: i.name as string,
      priceBtn: Number(i.price_btn || 0),
      category: (i.category as string) || "General",
      outletId: (i.outlet as string) || "restaurant",
      prepStation: i.prep_station as string | null,
    })),
  };
}

const orderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  bookingId: z.string().uuid().optional().nullable(),
  outletId: z.string().optional(),
  tableLabel: z.string().optional(),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().uuid().optional(),
        name: z.string().min(1),
        qty: z.number().int().positive(),
        unitPriceBtn: z.number().nonnegative(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
  fireKot: z.boolean().default(true),
});

export async function createPosOrder(ctx: AdapterCtx, raw: unknown) {
  const input = orderSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const subtotal = input.lines.reduce(
    (s, l) => s + l.qty * l.unitPriceBtn,
    0,
  );
  const total = Math.round(subtotal * 100) / 100;
  const outlet = input.outletId || "restaurant";
  let folioId: string | null = null;
  if (input.bookingId) {
    folioId = await ensureOpenFolio(ctx, input.bookingId);
  }

  const { data: order, error } = await ctx.admin
    .from("orders")
    .insert({
      property_id: ctx.jwt.propertyId,
      outlet,
      booking_id: input.bookingId || null,
      folio_id: folioId,
      customer_name: input.tableLabel || "Desk POS",
      delivery_type: "pickup",
      status: "received",
      kot_status: "new",
      order_source: input.bookingId ? "room_charge" : "desk",
      subtotal_btn: total,
      gst_btn: 0,
      total_btn: total,
      server_staff_id: ctx.jwt.staffId,
      notes: input.tableLabel || null,
      posted_to_folio_at: null,
    })
    .select("id, status, kot_status, total_btn")
    .single();
  if (error) {
    console.error("[createPosOrder] order insert failed", error);
    throw new Error(error.message ?? "Could not create order");
  }

  const { error: iErr } = await ctx.admin.from("order_items").insert(
    input.lines.map((l) => ({
      order_id: order.id,
      menu_item_id: l.menuItemId || null,
      name_snapshot: l.name,
      qty: l.qty,
      unit_price_btn: l.unitPriceBtn,
      list_unit_price_btn: l.unitPriceBtn,
      gst_applicable: false,
      line_notes: l.notes || null,
      kot_status: "new",
    })),
  );
  if (iErr) {
    console.error("[createPosOrder] items failed", iErr);
    await ctx.admin.from("orders").delete().eq("id", order.id);
    throw new Error(iErr.message ?? "Could not save order items");
  }

  if (folioId && input.bookingId) {
    try {
      await postChargeAtomic(ctx, {
        folioId,
        bookingId: input.bookingId,
        idempotencyKey: input.idempotencyKey,
        description:
          `POS · ${input.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}`.slice(
            0,
            180,
          ),
        amountBtn: total,
        sourceType: "order",
        sourceId: order.id as string,
      });
      await ctx.admin
        .from("orders")
        .update({ posted_to_folio_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("property_id", ctx.jwt.propertyId);
    } catch (err) {
      console.error("[createPosOrder] folio charge failed — rolling back order", {
        orderId: order.id,
        err,
      });
      await ctx.admin.from("order_items").delete().eq("order_id", order.id);
      await ctx.admin.from("orders").delete().eq("id", order.id);
      throw err;
    }
  }

  const result = {
    ok: true,
    orderId: order.id as string,
    status: order.status as string,
    kotStatus: order.kot_status as string,
    totalBtn: Number(order.total_btn),
    kotId: order.id as string,
    folioId,
  };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "pos_order",
    result,
  );
  return result;
}

export async function listKdsTickets(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("orders")
    .select(
      `id, status, kot_status, outlet, customer_name, table_id, total_btn, created_at, ready_at, booking_id,
       order_items(id, name_snapshot, qty, line_notes, kot_status, voided_at)`,
    )
    .eq("property_id", ctx.jwt.propertyId)
    .is("voided_at", null)
    .in("kot_status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  return {
    tickets: (data ?? []).map((o) => ({
      id: o.id,
      status: o.kot_status,
      station: o.outlet || "kitchen",
      created_at: o.created_at,
      updated_at: o.ready_at,
      orders: {
        id: o.id,
        table_label: o.customer_name,
        booking_id: o.booking_id,
        total_btn: o.total_btn,
        status: o.status,
        order_lines: ((o.order_items as Array<Record<string, unknown>>) || [])
          .filter((l) => !l.voided_at)
          .map((l) => ({
            id: l.id,
            name: l.name_snapshot,
            qty: l.qty,
            notes: l.line_notes,
            status: l.kot_status,
          })),
      },
    })),
  };
}

const kotStatusSchema = z.object({
  kotId: z.string().uuid(),
  status: z.enum([
    "queued",
    "preparing",
    "ready",
    "served",
    "cancelled",
    "new",
  ]),
  idempotencyKey: z.string().uuid(),
});

export async function updateKotStatus(ctx: AdapterCtx, raw: unknown) {
  const input = kotStatusSchema.parse(raw);
  const cached = await loadIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
  );
  if (cached) return { ...cached, replayed: true };

  const map: Record<string, string> = {
    queued: "new",
    preparing: "preparing",
    ready: "ready",
    served: "served",
    cancelled: "cancelled",
    new: "new",
  };
  const kotStatus = map[input.status] || input.status;
  const patch: Record<string, unknown> = { kot_status: kotStatus };
  if (kotStatus === "ready") {
    patch.ready_at = new Date().toISOString();
    patch.ready_by = ctx.jwt.staffId;
  }
  if (kotStatus === "served") {
    patch.served_at = new Date().toISOString();
    patch.served_by = ctx.jwt.staffId;
  }

  const { data: updated, error } = await ctx.admin
    .from("orders")
    .update(patch)
    .eq("id", input.kotId)
    .eq("property_id", ctx.jwt.propertyId)
    .select("id");
  if (error) throw error;
  // Only touch items once the order is proven to belong to this property.
  if (!updated?.length) throw new Error("Order not found for property");

  const { error: itemErr } = await ctx.admin
    .from("order_items")
    .update({ kot_status: kotStatus })
    .eq("order_id", input.kotId)
    .is("voided_at", null);
  if (itemErr) throw itemErr;

  const result = { ok: true, kotId: input.kotId, status: kotStatus };
  await saveIdempotent(
    ctx.admin,
    ctx.jwt.propertyId,
    input.idempotencyKey,
    "kot_status",
    result,
  );
  return result;
}
