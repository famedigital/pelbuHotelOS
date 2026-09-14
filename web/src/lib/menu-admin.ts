import { cloudinaryUrl } from "@/lib/cloudinary";
import type { MenuItem } from "@/lib/menu";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  formatMenuStockLabel,
  loadMenuStockMap,
} from "@/lib/menu-stock";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Admin loader — returns every menu item for the active property, including
 * unavailable ones (`is_available = false`). The public `loadMenuByOutlets`
 * deliberately hides these rows, so the admin grid needs its own loader.
 */
export async function loadAllMenuItems(admin?: Admin): Promise<MenuItem[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const { data } = await client
    .from("menu_items")
    .select(
      "id, outlet, category, name, description, price_btn, gst_applicable, sort_order, image_public_id, is_popular, prep_station, is_available, family_id, sell_size",
    )
    .eq("property_id", propertyId)
    .order("outlet")
    .order("category")
    .order("sort_order")
    .order("name");

  const rows = data ?? [];
  const stock = await loadMenuStockMap(
    client,
    propertyId,
    rows.map((row) => row.id as string),
  );

  return rows.map((row) => {
    const itemStock = stock.get(row.id as string);
    const sellSize = (row.sell_size as MenuItem["sell_size"]) ?? null;
    const stock_label = formatMenuStockLabel(
      itemStock?.availableSales,
      sellSize,
      itemStock?.mode,
    );
    return {
      id: row.id as string,
      outlet: row.outlet as string,
      category: row.category as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      price_btn: Number(row.price_btn),
      gst_applicable: Boolean(row.gst_applicable),
      sort_order: Number(row.sort_order ?? 0),
      image_public_id: (row.image_public_id as string | null) ?? null,
      image_src: row.image_public_id
        ? cloudinaryUrl(row.image_public_id as string, {
            width: 480,
            crop: "fill",
          })
        : null,
      is_popular: Boolean(row.is_popular),
      prep_station:
        (row.prep_station as MenuItem["prep_station"] | null) ?? "kitchen",
      is_available: Boolean(row.is_available),
      stock_mode: itemStock?.mode ?? "untracked",
      stock_on_hand: itemStock?.availableSales ?? null,
      stock_unit: itemStock?.unit ?? null,
      sold_out: itemStock?.soldOut ?? false,
      stock_inventory_item_id: itemStock?.inventoryItemId ?? null,
      stock_qty_per_sale: itemStock?.qtyPerSale ?? 1,
      family_id: (row.family_id as string | null) ?? null,
      sell_size: sellSize,
      stock_label,
    };
  });
}

export async function loadMenuCategories(
  admin?: Admin,
): Promise<
  { id: string; name: string; sort_order: number; is_active: boolean }[]
> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const { data } = await client
    .from("menu_categories")
    .select("id, name, sort_order, is_active")
    .eq("property_id", propertyId)
    .order("sort_order")
    .order("name");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    sort_order: Number(row.sort_order ?? 0),
    is_active: Boolean(row.is_active),
  }));
}
