import type { MenuItem } from "@/lib/menu";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadMenuStockMap } from "@/lib/menu-stock";

/**
 * Seed IDs that were never uploaded to Cloudinary. Keep in sync with
 * `supabase/migrations/20260731000006_remap_broken_menu_images.sql` so a
 * stale row can never paint a broken URL on a public page.
 */
const MENU_IMAGE_REMAP: Record<string, string> = {
  "pelbu/menu/restaurant-butter-chicken-naan":
    "pelbu/menu/cafe-grilled-chicken-plate",
  "pelbu/menu/restaurant-chicken-thukpa": "pelbu/menu/cafe-thukpa-cup",
  "pelbu/menu/restaurant-mutton-curry-thali":
    "pelbu/restaurant/signature-plate",
  "pelbu/menu/restaurant-paneer-lababdar":
    "pelbu/menu/cafe-ema-datshi-rice-bowl",
  "pelbu/menu/restaurant-paratha-platter":
    "pelbu/menu/cafe-egg-cheese-paratha",
  "pelbu/menu/restaurant-red-rice-ema-datshi":
    "pelbu/menu/cafe-ema-datshi-rice-bowl",
  "pelbu/menu/restaurant-river-trout": "pelbu/restaurant/signature-plate",
  "pelbu/menu/restaurant-shakam-ema-datshi":
    "pelbu/menu/cafe-ema-datshi-rice-bowl",
  "pelbu/menu/pastry-apple-crumble-slice": "pelbu/cafe/morning-pastry",
  "pelbu/menu/pastry-butter-croissant": "pelbu/cafe/morning-pastry",
  "pelbu/menu/pastry-cardamom-bun": "pelbu/menu/cafe-suja-khabzay",
  "pelbu/menu/pastry-dark-chocolate-brownie":
    "pelbu/restaurant/signature-plate",
};

function resolveMenuImageId(publicId: string | null): string | null {
  if (!publicId) return null;
  return MENU_IMAGE_REMAP[publicId] ?? publicId;
}

export async function loadMenuByOutlets(
  outlets: string[],
): Promise<MenuItem[]> {
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data } = await admin
    .from("menu_items")
    .select(
      "id, outlet, category, name, description, price_btn, gst_applicable, sort_order, image_public_id, is_popular, prep_station",
    )
    .eq("property_id", propertyId)
    .eq("is_available", true)
    .in("outlet", outlets)
    .order("sort_order");

  const rows = data ?? [];
  const stock = await loadMenuStockMap(
    admin,
    propertyId,
    rows.map((row) => row.id as string),
  );

  return rows.map((row) => {
    const imagePublicId = resolveMenuImageId(
      (row.image_public_id as string | null) ?? null,
    );
    const itemStock = stock.get(row.id as string);
    return {
      id: row.id as string,
      outlet: row.outlet as string,
      category: row.category as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      price_btn: Number(row.price_btn),
      gst_applicable: Boolean(row.gst_applicable),
      sort_order: Number(row.sort_order),
      image_public_id: imagePublicId,
      image_src: imagePublicId
        ? cloudinaryUrl(imagePublicId, { width: 900, crop: "fill" })
        : null,
      is_popular: Boolean(row.is_popular),
      prep_station: (row.prep_station as MenuItem["prep_station"]) ?? "kitchen",
      stock_mode: itemStock?.mode ?? "untracked",
      stock_on_hand: itemStock?.availableSales ?? null,
      stock_unit: itemStock?.unit ?? null,
      sold_out: itemStock?.soldOut ?? false,
      stock_inventory_item_id: itemStock?.inventoryItemId ?? null,
      stock_qty_per_sale: itemStock?.qtyPerSale ?? 1,
    };
  });
}

export function groupMenuByCategory(
  items: MenuItem[],
): Map<string, MenuItem[]> {
  const byCategory = new Map<string, MenuItem[]>();
  for (const item of items) {
    const key =
      items.some((i) => i.outlet !== item.outlet)
        ? `${item.outlet} · ${item.category}`
        : item.category;
    const list = byCategory.get(key) ?? [];
    list.push(item);
    byCategory.set(key, list);
  }
  return byCategory;
}
