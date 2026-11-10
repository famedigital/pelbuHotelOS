import "server-only";

import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Deduct room amenity par stock when HK completes amenities checklist. */
export async function deductRoomAmenityStock(
  admin: Admin,
  propertyId: string,
  assignmentId: string,
  roomLabel: string,
): Promise<void> {
  const { data: pars } = await admin
    .from("room_amenity_pars")
    .select("inventory_item_id, par_qty, inventory_items(sku, qty_on_hand)")
    .eq("property_id", propertyId)
    .eq("is_active", true);

  for (const par of pars ?? []) {
    const item = par.inventory_items as
      | { sku?: string; qty_on_hand?: number }
      | { sku?: string; qty_on_hand?: number }[]
      | null;
    const row = Array.isArray(item) ? item[0] : item;
    const sku = row?.sku ?? "item";
    const delta = -Number(par.par_qty ?? 0);
    if (delta >= 0) continue;

    const currentQty = Number(row?.qty_on_hand ?? 0);
    const nextQty = roundBtn(Math.max(0, currentQty + delta));

    await admin.from("inventory_movements").insert({
      property_id: propertyId,
      item_id: par.inventory_item_id as string,
      movement_kind: "issue",
      qty_delta: delta,
      reference: `HK ${assignmentId.slice(0, 8)} · ${roomLabel}`,
      notes: "Room turnover amenity restock",
      created_by: "hk_checklist",
    });

    await admin
      .from("inventory_items")
      .update({ qty_on_hand: nextQty })
      .eq("id", par.inventory_item_id as string);
  }
}
