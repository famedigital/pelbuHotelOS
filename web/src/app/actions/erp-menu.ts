"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const MENU_OUTLETS = ["cafe", "pastry", "restaurant", "bar"] as const;
export type MenuOutlet = (typeof MENU_OUTLETS)[number];

export const MENU_PREP_STATIONS = [
  "kitchen",
  "bar",
  "pastry",
  "grill",
  "cold",
] as const;
export type MenuPrepStation = (typeof MENU_PREP_STATIONS)[number];

export type MenuAdminState = {
  ok: boolean;
  itemId?: string;
  error?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function parseOutlet(value: string): MenuOutlet {
  if (!MENU_OUTLETS.includes(value as MenuOutlet)) {
    throw new Error("Outlet must be cafe, pastry, restaurant, or bar.");
  }
  return value as MenuOutlet;
}

function parsePrepStation(value: string | null | undefined): MenuPrepStation {
  if (!value) return "kitchen";
  if (!MENU_PREP_STATIONS.includes(value as MenuPrepStation)) {
    throw new Error(
      "Prep station must be kitchen, bar, pastry, grill, or cold.",
    );
  }
  return value as MenuPrepStation;
}

function parsePriceBtn(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    throw new Error("Price must be between 0 and 1,000,000 Nu.");
  }
  return Math.round(n * 100) / 100;
}

/**
 * Create or update a menu item. Edits when `item_id` is set; creates when
 * omitted. All writes go through the service-role admin client (desk path),
 * so no RLS policy is required — matches the existing settings pattern.
 */
export async function saveMenuItem(
  _prev: MenuAdminState,
  formData: FormData,
): Promise<MenuAdminState> {
  try {
    await requireDesk();

    const itemId = optionalTrim(formData.get("item_id"));
    const name = trimRequired(formData.get("name"), "Item name");
    if (name.length > 80) {
      throw new Error("Item name must be 80 characters or fewer.");
    }
    const outlet = parseOutlet(
      trimRequired(formData.get("outlet"), "Outlet"),
    );
    const category = trimRequired(formData.get("category"), "Category");
    if (category.length > 40) {
      throw new Error("Category must be 40 characters or fewer.");
    }
    const description = optionalTrim(formData.get("description"))?.slice(
      0,
      400,
    );
    const priceBtn = parsePriceBtn(
      trimRequired(formData.get("price_btn"), "Price"),
    );
    const gstApplicable = formData.get("gst_applicable") === "1";
    const isAvailable = formData.get("is_available") !== "0";
    const isPopular = formData.get("is_popular") === "1";
    const prepStation = parsePrepStation(optionalTrim(formData.get("prep_station")));
    const sortOrderRaw = optionalTrim(formData.get("sort_order"));
    const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      throw new Error("Sort order must be between 0 and 9999.");
    }
    const imagePublicId =
      optionalTrim(formData.get("image_public_id"))?.slice(0, 200) ?? null;

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const payload = {
      property_id: propertyId,
      name,
      outlet,
      category,
      description: description ?? null,
      price_btn: priceBtn,
      gst_applicable: gstApplicable,
      is_available: isAvailable,
      is_popular: isPopular,
      prep_station: prepStation,
      sort_order: sortOrder,
      image_public_id: imagePublicId,
    };

    if (itemId) {
      const { error } = await admin
        .from("menu_items")
        .update(payload)
        .eq("id", itemId)
        .eq("property_id", propertyId);
      if (error) {
        throw new Error(
          error.code === "23505"
            ? "An item with that name already exists in this outlet."
            : "Could not update menu item.",
        );
      }
      await writeAuditEvent(admin, {
        propertyId,
        action: "menu.item.update",
        entityType: "menu_items",
        entityId: itemId,
        summary: `Updated ${name} (${outlet})`,
        meta: payload,
      });
      revalidatePath("/erp/menu");
      revalidatePath("/erp/pos");
      revalidatePath("/menu");
      revalidatePath("/cafe");
      revalidatePath("/restaurant");
      revalidatePath("/bar");
      revalidatePath("/dine");
      revalidatePath("/order");
      return { ok: true, itemId };
    }

    const { data: created, error } = await admin
      .from("menu_items")
      .insert(payload)
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(
        error?.code === "23505"
          ? "An item with that name already exists in this outlet."
          : "Could not create menu item.",
      );
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.item.create",
      entityType: "menu_items",
      entityId: created.id as string,
      summary: `Created ${name} (${outlet})`,
      meta: payload,
    });
    revalidatePath("/erp/menu");
    revalidatePath("/erp/pos");
    revalidatePath("/menu");
    revalidatePath("/cafe");
    revalidatePath("/restaurant");
    revalidatePath("/bar");
    revalidatePath("/dine");
    revalidatePath("/order");
    return { ok: true, itemId: created.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function deleteMenuItem(
  _prev: MenuAdminState,
  formData: FormData,
): Promise<MenuAdminState> {
  try {
    await requireDesk();
    const itemId = trimRequired(formData.get("item_id"), "Menu item");

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: item, error } = await admin
      .from("menu_items")
      .select("id, name, outlet")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error || !item) throw new Error("Menu item not found.");

    const { error: delError } = await admin
      .from("menu_items")
      .delete()
      .eq("id", itemId)
      .eq("property_id", propertyId);
    if (delError) throw new Error("Could not delete menu item.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.item.delete",
      entityType: "menu_items",
      entityId: itemId,
      summary: `Deleted ${item.name as string} (${item.outlet as string})`,
    });
    revalidatePath("/erp/menu");
    revalidatePath("/erp/pos");
    revalidatePath("/menu");
    revalidatePath("/cafe");
    revalidatePath("/restaurant");
    revalidatePath("/bar");
    revalidatePath("/dine");
    revalidatePath("/order");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/**
 * Inline availability toggle from the list view. Used by the "Available /
 * Hidden" switch on each row.
 */
export async function toggleMenuItemAvailable(
  formData: FormData,
): Promise<void> {
  try {
    await requireDesk();
    const itemId = trimRequired(formData.get("item_id"), "Menu item");
    const next = formData.get("is_available") === "1";

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: item } = await admin
      .from("menu_items")
      .select("id, name")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!item) return;

    await admin
      .from("menu_items")
      .update({ is_available: next })
      .eq("id", itemId)
      .eq("property_id", propertyId);

    await writeAuditEvent(admin, {
      propertyId,
      action: next ? "menu.item.enable" : "menu.item.disable",
      entityType: "menu_items",
      entityId: itemId,
      summary: `${next ? "Enabled" : "Hid"} ${item.name as string}`,
    });
    revalidatePath("/erp/menu");
    revalidatePath("/erp/pos");
    revalidatePath("/menu");
    revalidatePath("/cafe");
    revalidatePath("/restaurant");
    revalidatePath("/bar");
    revalidatePath("/dine");
    revalidatePath("/order");
  } catch (err) {
    console.error("toggleMenuItemAvailable failed", err);
  }
}
