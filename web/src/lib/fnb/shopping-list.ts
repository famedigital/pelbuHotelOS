/**
 * Suggested market shopping list from low stock.
 */

import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ShoppingListLine = {
  inventoryItemId: string;
  name: string;
  unit: string;
  onHand: number;
  reorderAt: number;
  suggestedQty: number;
};

export async function buildShoppingList(
  admin?: Admin,
): Promise<ShoppingListLine[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);

  const [{ data: items }, { data: bals }] = await Promise.all([
    client
      .from("inventory_items")
      .select("id, name, unit, reorder_level, qty_on_hand")
      .eq("property_id", propertyId),
    client
      .from("inventory_balances")
      .select("item_id, qty_on_hand")
      .eq("property_id", propertyId),
  ]);

  const balMap = new Map<string, number>();
  for (const b of bals ?? []) {
    const id = b.item_id as string;
    balMap.set(id, (balMap.get(id) ?? 0) + Number(b.qty_on_hand ?? 0));
  }

  const lines: ShoppingListLine[] = [];
  for (const item of items ?? []) {
    const reorderAt = Number(item.reorder_level ?? 0);
    if (reorderAt <= 0) continue;
    const onHand = balMap.has(item.id as string)
      ? (balMap.get(item.id as string) as number)
      : Number(item.qty_on_hand ?? 0);
    if (onHand > reorderAt) continue;
    const suggestedQty = Math.max(reorderAt * 2 - onHand, reorderAt);
    lines.push({
      inventoryItemId: item.id as string,
      name: String(item.name),
      unit: String(item.unit ?? "ea"),
      onHand,
      reorderAt,
      suggestedQty: Math.ceil(suggestedQty * 1000) / 1000,
    });
  }

  return lines.sort((a, b) => a.name.localeCompare(b.name));
}
