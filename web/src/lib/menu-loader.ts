import type { MenuItem } from "@/lib/menu";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  cachedPublicByProperty,
  menuCatalogTag,
} from "@/lib/public-cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  formatMenuStockLabel,
  loadMenuStockMap,
} from "@/lib/menu-stock";
import { cache } from "react";

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

type CatalogRow = Omit<
  MenuItem,
  | "stock_mode"
  | "stock_on_hand"
  | "stock_unit"
  | "sold_out"
  | "stock_inventory_item_id"
  | "stock_qty_per_sale"
  | "stock_label"
>;

async function loadMenuCatalogForProperty(
  propertyId: string,
  outlets: string[],
): Promise<CatalogRow[]> {
  const admin = createSupabaseAdminClient();
  const baseCols =
    "id, outlet, category, name, description, price_btn, gst_applicable, sort_order, image_public_id, is_popular, prep_station, family_id, sell_size";

  // Prefer sell_barcode when migration is applied; fall back if column missing
  // so POS never goes blank on older DBs.
  let { data, error } = await admin
    .from("menu_items")
    .select(`${baseCols}, sell_barcode`)
    .eq("property_id", propertyId)
    .eq("is_available", true)
    .in("outlet", outlets)
    .order("sort_order");

  if (error) {
    const missingBarcode =
      /sell_barcode/i.test(error.message) ||
      error.code === "42703" ||
      error.code === "PGRST204";
    if (missingBarcode) {
      const fallback = await admin
        .from("menu_items")
        .select(baseCols)
        .eq("property_id", propertyId)
        .eq("is_available", true)
        .in("outlet", outlets)
        .order("sort_order");
      data = (fallback.data ?? []).map((row) => ({
        ...row,
        sell_barcode: null as string | null,
      }));
      error = fallback.error;
    }
  }

  if (error) {
    console.error("loadMenuCatalogForProperty failed", error.message);
    return [];
  }

  const rows = data ?? [];
  const itemIds = rows.map((row) => row.id as string);
  const trustImages = new Map<string, string>();
  if (itemIds.length > 0) {
    try {
      const { data: trust } = await admin
        .from("property_media")
        .select("scope_id, public_id, is_primary, sort_order")
        .eq("property_id", propertyId)
        .eq("scope", "menu_item")
        .eq("is_published", true)
        .eq("resource_type", "image")
        .in("scope_id", itemIds)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });
      for (const row of trust ?? []) {
        const sid = row.scope_id as string;
        if (sid && !trustImages.has(sid)) {
          trustImages.set(sid, row.public_id as string);
        }
      }
    } catch {
      // Table may not be migrated yet on older envs.
    }
  }

  return rows.map((row) => {
    const id = row.id as string;
    const imagePublicId = resolveMenuImageId(
      trustImages.get(id) ??
        ((row.image_public_id as string | null) ?? null),
    );
    const sellSize = (row.sell_size as MenuItem["sell_size"]) ?? null;
    const rowRec = row as Record<string, unknown>;
    return {
      id,
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
      family_id: (row.family_id as string | null) ?? null,
      sell_size: sellSize,
      sell_barcode:
        typeof rowRec.sell_barcode === "string" ? rowRec.sell_barcode : null,
    };
  });
}

/** Cached catalog (no stock). Stock is always live in loadMenuByOutlets. */
export const loadMenuCatalogByOutlets = cache(
  async (outlets: string[]): Promise<CatalogRow[]> => {
    const key = [...outlets].sort().join(",");
    // v2: bust stuck empty caches from sell_barcode select failures pre-migration.
    return cachedPublicByProperty(
      ["menu-catalog-v2", key],
      menuCatalogTag,
      (propertyId) => loadMenuCatalogForProperty(propertyId, outlets),
      [],
    );
  },
);

export async function loadMenuByOutlets(
  outlets: string[],
): Promise<MenuItem[]> {
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  // Desk POS must use the active property catalog — not the public ISR cache
  // (wrong tenant / stuck empty after a bad select).
  const catalog = await loadMenuCatalogForProperty(propertyId, outlets);

  // Stock is always live — never baked into ISR HTML.
  const stock = await loadMenuStockMap(
    admin,
    propertyId,
    catalog.map((row) => row.id),
  );

  return catalog.map((row) => {
    const itemStock = stock.get(row.id);
    return {
      ...row,
      stock_mode: itemStock?.mode ?? "untracked",
      stock_on_hand: itemStock?.availableSales ?? null,
      stock_unit: itemStock?.unit ?? null,
      sold_out: itemStock?.soldOut ?? false,
      stock_inventory_item_id: itemStock?.inventoryItemId ?? null,
      stock_qty_per_sale: itemStock?.qtyPerSale ?? 1,
      stock_label: formatMenuStockLabel(
        itemStock?.availableSales,
        row.sell_size,
        itemStock?.mode,
      ),
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
