import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const FNB_INVENTORY_CATEGORIES = [
  "produce",
  "meat",
  "dairy",
  "dry",
  "beverage",
] as const;

export type FoodCostPeriod = {
  from: string;
  to: string;
  openingBtn: number;
  purchasesBtn: number;
  closingBtn: number;
  cogsBtn: number;
  fnbSalesBtn: number;
  foodCostPct: number;
  openingSource: "audit" | "estimate";
  closingSource: "audit" | "estimate";
};

async function inventoryValueFromAudit(
  admin: Admin,
  propertyId: string,
  onOrBefore: string,
): Promise<{ value: number; source: "audit" | "estimate" } | null> {
  const { data: audit } = await admin
    .from("inventory_audits")
    .select("id, business_date")
    .eq("property_id", propertyId)
    .eq("status", "posted")
    .lte("business_date", onOrBefore)
    .order("business_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!audit) return null;

  const { data: lines } = await admin
    .from("inventory_audit_lines")
    .select("counted_qty, inventory_items(category, unit_cost_btn)")
    .eq("audit_id", audit.id as string);

  let value = 0;
  for (const line of lines ?? []) {
    const item = line.inventory_items as {
      category?: string;
      unit_cost_btn?: number;
    } | null;
    if (
      !item?.category ||
      !FNB_INVENTORY_CATEGORIES.includes(
        item.category as (typeof FNB_INVENTORY_CATEGORIES)[number],
      )
    ) {
      continue;
    }
    const qty = Number(line.counted_qty ?? 0);
    value += qty * Number(item.unit_cost_btn ?? 0);
  }
  return { value: roundBtn(value), source: "audit" };
}

async function estimateInventoryValue(
  admin: Admin,
  propertyId: string,
): Promise<number> {
  const { data: items } = await admin
    .from("inventory_items")
    .select("qty_on_hand, unit_cost_btn, category")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .in("category", [...FNB_INVENTORY_CATEGORIES]);

  let value = 0;
  for (const item of items ?? []) {
    value += Number(item.qty_on_hand ?? 0) * Number(item.unit_cost_btn ?? 0);
  }
  return roundBtn(value);
}

/**
 * COGS = opening + purchases − closing.
 * Uses posted audits when available; otherwise estimates from current stock.
 */
export async function computeFoodCostPeriod(
  admin: Admin,
  propertyId: string,
  from: string,
  to: string,
): Promise<FoodCostPeriod> {
  const openingAudit = await inventoryValueFromAudit(admin, propertyId, from);
  const closingAudit = await inventoryValueFromAudit(admin, propertyId, to);

  const openingBtn =
    openingAudit?.value ??
    (await estimateInventoryValue(admin, propertyId));
  const closingBtn =
    closingAudit?.value ??
    (await estimateInventoryValue(admin, propertyId));

  const { data: fnbItems } = await admin
    .from("inventory_items")
    .select("id")
    .eq("property_id", propertyId)
    .in("category", [...FNB_INVENTORY_CATEGORIES]);
  const fnbIds = (fnbItems ?? []).map((i) => i.id as string);

  let purchasesBtn = 0;
  if (fnbIds.length > 0) {
    const { data: receives } = await admin
      .from("inventory_movements")
      .select("total_amount_btn, qty_delta, unit_cost_btn")
      .eq("property_id", propertyId)
      .eq("movement_kind", "receive")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .in("item_id", fnbIds);

    for (const row of receives ?? []) {
      const amt = Number(row.total_amount_btn ?? 0);
      if (amt > 0) {
        purchasesBtn += amt;
      } else {
        purchasesBtn += Math.abs(Number(row.qty_delta ?? 0)) *
          Number(row.unit_cost_btn ?? 0);
      }
    }
  }
  purchasesBtn = roundBtn(purchasesBtn);

  const cogsBtn = roundBtn(openingBtn + purchasesBtn - closingBtn);

  const { data: orders } = await admin
    .from("orders")
    .select("total_btn, status")
    .eq("property_id", propertyId)
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)
    .limit(2000);

  let fnbSalesBtn = 0;
  for (const o of orders ?? []) {
    if ((o.status as string) === "cancelled") continue;
    fnbSalesBtn += Number(o.total_btn ?? 0);
  }
  fnbSalesBtn = roundBtn(fnbSalesBtn);

  const foodCostPct =
    fnbSalesBtn > 0
      ? Math.round((cogsBtn / fnbSalesBtn) * 1000) / 10
      : 0;

  return {
    from,
    to,
    openingBtn,
    purchasesBtn,
    closingBtn,
    cogsBtn,
    fnbSalesBtn,
    foodCostPct,
    openingSource: openingAudit?.source ?? "estimate",
    closingSource: closingAudit?.source ?? "estimate",
  };
}
