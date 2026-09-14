import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MenuStockSnapshot = {
  mode: "untracked" | "finished_good" | "recipe";
  inventoryItemId: string | null;
  qtyPerSale: number;
  autoDisable: boolean;
  availableSales: number | null;
  unit: string | null;
  soldOut: boolean;
};

const UNTRACKED: MenuStockSnapshot = {
  mode: "untracked",
  inventoryItemId: null,
  qtyPerSale: 1,
  autoDisable: true,
  availableSales: null,
  unit: null,
  soldOut: false,
};

/** Human label for remaining stock (peks / bottles / generic servings). */
export function formatMenuStockLabel(
  availableSales: number | null | undefined,
  sellSize?: "pek" | "bottle" | "single" | "case" | null,
  mode?: MenuStockSnapshot["mode"],
): string | null {
  if (availableSales == null) return null;
  if (sellSize === "pek") {
    return `${availableSales} pek${availableSales === 1 ? "" : "s"} left`;
  }
  if (sellSize === "bottle") {
    return `${availableSales} bottle${availableSales === 1 ? "" : "s"} left`;
  }
  if (sellSize === "single" || sellSize === "case") {
    return `${availableSales} left`;
  }
  if (mode && mode !== "untracked") {
    return `${availableSales} left`;
  }
  return null;
}

/** Compute menu availability from the inventory ledger without duplicating stock. */
export async function loadMenuStockMap(
  admin: Admin,
  propertyId: string,
  menuItemIds: string[],
): Promise<Map<string, MenuStockSnapshot>> {
  const result = new Map<string, MenuStockSnapshot>();
  if (menuItemIds.length === 0) return result;

  const [{ data: profiles }, { data: recipes }] = await Promise.all([
    admin
      .from("menu_stock_profiles")
      .select(
        "menu_item_id, stock_mode, inventory_item_id, qty_per_sale, auto_disable",
      )
      .eq("property_id", propertyId)
      .in("menu_item_id", menuItemIds),
    admin
      .from("menu_recipe_items")
      .select("menu_item_id, inventory_item_id, qty_per_sale")
      .eq("property_id", propertyId)
      .in("menu_item_id", menuItemIds),
  ]);

  const inventoryIds = new Set<string>();
  for (const p of profiles ?? []) {
    if (p.inventory_item_id) inventoryIds.add(p.inventory_item_id as string);
  }
  for (const r of recipes ?? []) {
    inventoryIds.add(r.inventory_item_id as string);
  }

  const inventory = new Map<
    string,
    { qty: number; unit: string; active: boolean }
  >();
  if (inventoryIds.size > 0) {
    const { data } = await admin
      .from("inventory_items")
      .select("id, qty_on_hand, unit, is_active")
      .eq("property_id", propertyId)
      .in("id", [...inventoryIds]);
    for (const row of data ?? []) {
      inventory.set(row.id as string, {
        qty: Number(row.qty_on_hand ?? 0),
        unit: (row.unit as string) ?? "ea",
        active: Boolean(row.is_active),
      });
    }
  }

  const recipeByMenu = new Map<
    string,
    { inventoryItemId: string; qtyPerSale: number }[]
  >();
  for (const row of recipes ?? []) {
    const menuItemId = row.menu_item_id as string;
    const list = recipeByMenu.get(menuItemId) ?? [];
    list.push({
      inventoryItemId: row.inventory_item_id as string,
      qtyPerSale: Number(row.qty_per_sale),
    });
    recipeByMenu.set(menuItemId, list);
  }

  for (const row of profiles ?? []) {
    const menuItemId = row.menu_item_id as string;
    const mode = (row.stock_mode as MenuStockSnapshot["mode"]) ?? "untracked";
    const qtyPerSale = Number(row.qty_per_sale ?? 1);
    const autoDisable = Boolean(row.auto_disable);
    let availableSales: number | null = null;
    let unit: string | null = null;

    if (mode === "finished_good" && row.inventory_item_id) {
      const item = inventory.get(row.inventory_item_id as string);
      availableSales =
        item?.active && qtyPerSale > 0
          ? Math.max(0, Math.floor(item.qty / qtyPerSale))
          : 0;
      unit = item?.unit ?? "ea";
    } else if (mode === "recipe") {
      const recipe = recipeByMenu.get(menuItemId) ?? [];
      availableSales =
        recipe.length === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                ...recipe.map((component) => {
                  const item = inventory.get(component.inventoryItemId);
                  if (!item?.active || component.qtyPerSale <= 0) return 0;
                  return Math.floor(item.qty / component.qtyPerSale);
                }),
              ),
            );
      unit = "servings";
    }

    result.set(menuItemId, {
      mode,
      inventoryItemId:
        (row.inventory_item_id as string | null | undefined) ?? null,
      qtyPerSale,
      autoDisable,
      availableSales,
      unit,
      soldOut:
        mode !== "untracked" && autoDisable && (availableSales ?? 0) <= 0,
    });
  }

  for (const id of menuItemIds) {
    if (!result.has(id)) result.set(id, UNTRACKED);
  }
  return result;
}
