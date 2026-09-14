/**
 * Menu engineering: popularity × contribution margin matrix.
 */

import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MenuEngineeringRow = {
  menuItemId: string;
  name: string;
  outlet: string;
  qtySold: number;
  salesBtn: number;
  unitPriceBtn: number;
  recipeCostBtn: number | null;
  marginBtn: number | null;
  marginPct: number | null;
  /** star | plowhorse | puzzle | dog — classic menu engineering. */
  class: "star" | "plowhorse" | "puzzle" | "dog" | "unknown";
};

export async function buildMenuEngineering(
  fromIso: string,
  toIso: string,
  admin?: Admin,
): Promise<MenuEngineeringRow[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);

  const { data: orders } = await client
    .from("orders")
    .select("id")
    .eq("property_id", propertyId)
    .is("voided_at", null)
    .not("settled_at", "is", null)
    .gte("settled_at", fromIso)
    .lte("settled_at", toIso);

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) return [];

  const { data: lines } = await client
    .from("order_items")
    .select(
      "menu_item_id, name_snapshot, qty, unit_price_btn, menu_items(outlet, price_btn)",
    )
    .in("order_id", orderIds)
    .is("voided_at", null);

  const qtyMap = new Map<
    string,
    { name: string; outlet: string; qty: number; sales: number; price: number }
  >();
  for (const line of lines ?? []) {
    const mid = (line.menu_item_id as string) || line.name_snapshot;
    const menu = line.menu_items as
      | { outlet?: string; price_btn?: number }
      | { outlet?: string; price_btn?: number }[]
      | null;
    const m = Array.isArray(menu) ? menu[0] : menu;
    const cur = qtyMap.get(mid) ?? {
      name: String(line.name_snapshot),
      outlet: String(m?.outlet ?? "other"),
      qty: 0,
      sales: 0,
      price: Number(line.unit_price_btn),
    };
    cur.qty += Number(line.qty);
    cur.sales = roundBtn(
      cur.sales + Number(line.qty) * Number(line.unit_price_btn),
    );
    qtyMap.set(mid, cur);
  }

  // Recipe cost: sum inventory unit costs if joined via menu_recipe_items
  const itemIds = [...qtyMap.keys()].filter((id) =>
    /^[0-9a-f-]{36}$/i.test(id),
  );
  const costMap = new Map<string, number>();
  if (itemIds.length > 0) {
    const { data: recipes } = await client
      .from("menu_recipe_items")
      .select("menu_item_id, qty, inventory_items(unit_cost_btn)")
      .in("menu_item_id", itemIds);
    for (const r of recipes ?? []) {
      const inv = r.inventory_items as
        | { unit_cost_btn?: number }
        | { unit_cost_btn?: number }[]
        | null;
      const row = Array.isArray(inv) ? inv[0] : inv;
      const unit = Number(row?.unit_cost_btn ?? 0);
      const add = unit * Number(r.qty ?? 0);
      costMap.set(
        r.menu_item_id as string,
        (costMap.get(r.menu_item_id as string) ?? 0) + add,
      );
    }
  }

  const rows: MenuEngineeringRow[] = [];
  let totalQty = 0;
  for (const v of qtyMap.values()) totalQty += v.qty;
  const avgQty = totalQty / Math.max(qtyMap.size, 1);

  const margins: number[] = [];
  for (const [id, v] of qtyMap) {
    const recipeCost = costMap.has(id) ? roundBtn(costMap.get(id)!) : null;
    const marginBtn =
      recipeCost != null ? roundBtn(v.price - recipeCost) : null;
    if (marginBtn != null) margins.push(marginBtn);
    rows.push({
      menuItemId: id,
      name: v.name,
      outlet: v.outlet,
      qtySold: v.qty,
      salesBtn: v.sales,
      unitPriceBtn: v.price,
      recipeCostBtn: recipeCost,
      marginBtn,
      marginPct:
        recipeCost != null && v.price > 0
          ? roundBtn(((v.price - recipeCost) / v.price) * 100)
          : null,
      class: "unknown",
    });
  }

  const avgMargin =
    margins.length > 0
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0;

  for (const r of rows) {
    const highPop = r.qtySold >= avgQty;
    const highMargin =
      r.marginBtn != null ? r.marginBtn >= avgMargin : false;
    if (r.marginBtn == null) {
      r.class = "unknown";
    } else if (highPop && highMargin) r.class = "star";
    else if (highPop && !highMargin) r.class = "plowhorse";
    else if (!highPop && highMargin) r.class = "puzzle";
    else r.class = "dog";
  }

  return rows.sort((a, b) => b.salesBtn - a.salesBtn);
}
