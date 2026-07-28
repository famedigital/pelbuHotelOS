import type { MenuItem } from "@/lib/menu";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function loadMenuByOutlets(
  outlets: string[],
): Promise<MenuItem[]> {
  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) return [];

  const { data } = await admin
    .from("menu_items")
    .select(
      "id, outlet, category, name, description, price_btn, gst_applicable, sort_order, image_public_id",
    )
    .eq("property_id", property.id)
    .eq("is_available", true)
    .in("outlet", outlets)
    .order("sort_order");

  return (data ?? []).map((row) => {
    const imagePublicId = (row.image_public_id as string | null) ?? null;
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
        ? cloudinaryUrl(imagePublicId, { width: 480, crop: "fill" })
        : null,
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
