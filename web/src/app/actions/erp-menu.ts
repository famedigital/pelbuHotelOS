"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  assertOutletCode,
  assertPropertyOutlet,
  slugifyOutletCode,
  syncIncomeStreamOutlets,
} from "@/lib/outlets";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

/** @deprecated Prefer property_outlets — kept for older imports. */
export const MENU_OUTLETS = ["cafe", "pastry", "restaurant", "bar"] as const;
export type MenuOutlet = string;

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

export type OutletAdminState = {
  ok: boolean;
  outletId?: string;
  error?: string;
  message?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateOutletSurfaces() {
  revalidatePath("/erp/menu");
  revalidatePath("/erp/pos");
  revalidatePath("/menu");
  revalidatePath("/cafe");
  revalidatePath("/restaurant");
  revalidatePath("/bar");
  revalidatePath("/dine");
  revalidatePath("/order");
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
    const outletRaw = trimRequired(formData.get("outlet"), "Outlet");
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
    // Edits may keep an archived outlet; creates must use an active one.
    const outletRow = await assertPropertyOutlet(
      admin,
      propertyId,
      outletRaw,
      { allowArchived: Boolean(itemId) },
    );
    const outlet = outletRow.code;

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
      revalidateOutletSurfaces();
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
    revalidateOutletSurfaces();
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
    revalidateOutletSurfaces();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/**
 * Create a property-scoped F&B outlet. Code is derived from the name unless
 * an explicit code is provided. New outlets are POS-ready but not auto-enabled
 * for public online ordering.
 */
export async function createPropertyOutlet(
  _prev: OutletAdminState,
  formData: FormData,
): Promise<OutletAdminState> {
  try {
    await requireDesk();
    const name = trimRequired(formData.get("name"), "Outlet name");
    if (name.length > 40) {
      throw new Error("Outlet name must be 40 characters or fewer.");
    }
    const codeRaw = optionalTrim(formData.get("code"));
    const code = codeRaw
      ? assertOutletCode(codeRaw)
      : slugifyOutletCode(name);
    const sortRaw = optionalTrim(formData.get("sort_order"));
    const sortOrder = sortRaw ? Number(sortRaw) : 100;
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      throw new Error("Sort order must be between 0 and 9999.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: existing } = await admin
      .from("property_outlets")
      .select("id, name, is_active")
      .eq("property_id", propertyId)
      .eq("code", code)
      .maybeSingle();
    if (existing) {
      if (!(existing.is_active as boolean)) {
        throw new Error(
          `"${existing.name as string}" already exists but is archived. Restore it instead.`,
        );
      }
      throw new Error("An outlet with that code already exists.");
    }

    const { data: created, error } = await admin
      .from("property_outlets")
      .insert({
        property_id: propertyId,
        code,
        name,
        is_active: true,
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(
        error?.code === "23505"
          ? "An outlet with that code already exists."
          : "Could not create outlet.",
      );
    }

    await syncIncomeStreamOutlets(admin, propertyId);
    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.outlet.create",
      entityType: "property_outlets",
      entityId: created.id as string,
      summary: `Created outlet ${name} (${code})`,
      meta: { code, name, sortOrder },
    });
    revalidateOutletSurfaces();
    return {
      ok: true,
      outletId: created.id as string,
      message: `${name} added.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/** Soft-delete: hide from Menu/POS creation. History and items stay intact. */
export async function archivePropertyOutlet(
  _prev: OutletAdminState,
  formData: FormData,
): Promise<OutletAdminState> {
  try {
    await requireDesk();
    const outletId = trimRequired(formData.get("outlet_id"), "Outlet");

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: outlet } = await admin
      .from("property_outlets")
      .select("id, code, name, is_active")
      .eq("id", outletId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!outlet) throw new Error("Outlet not found.");
    if (!(outlet.is_active as boolean)) {
      return { ok: true, message: "Outlet already archived." };
    }

    const { count } = await admin
      .from("property_outlets")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      throw new Error("Keep at least one active outlet.");
    }

    const { error } = await admin
      .from("property_outlets")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", outletId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not archive outlet.");

    await syncIncomeStreamOutlets(admin, propertyId);
    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.outlet.archive",
      entityType: "property_outlets",
      entityId: outletId,
      summary: `Archived outlet ${outlet.name as string} (${outlet.code as string})`,
    });
    revalidateOutletSurfaces();
    return {
      ok: true,
      message: `${outlet.name as string} archived. Items stay hidden from POS until you restore it.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function restorePropertyOutlet(
  _prev: OutletAdminState,
  formData: FormData,
): Promise<OutletAdminState> {
  try {
    await requireDesk();
    const outletId = trimRequired(formData.get("outlet_id"), "Outlet");

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: outlet } = await admin
      .from("property_outlets")
      .select("id, code, name, is_active")
      .eq("id", outletId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!outlet) throw new Error("Outlet not found.");

    const { error } = await admin
      .from("property_outlets")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", outletId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not restore outlet.");

    await syncIncomeStreamOutlets(admin, propertyId);
    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.outlet.restore",
      entityType: "property_outlets",
      entityId: outletId,
      summary: `Restored outlet ${outlet.name as string} (${outlet.code as string})`,
    });
    revalidateOutletSurfaces();
    return {
      ok: true,
      message: `${outlet.name as string} restored.`,
    };
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
    revalidateOutletSurfaces();
  } catch (err) {
    console.error("toggleMenuItemAvailable failed", err);
  }
}

export type MenuStockState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const STOCK_MODES = new Set(["untracked", "finished_good", "recipe"]);

function revalidateMenuStock() {
  revalidatePath("/erp/menu");
  revalidatePath("/erp/inventory");
  revalidatePath("/erp/pos");
  revalidatePath("/order");
  revalidatePath("/cafe");
  revalidatePath("/restaurant");
  revalidatePath("/bar");
  revalidatePath("/dine");
}

/** Configure a menu item as untracked, a purchased finished good, or a recipe. */
export async function saveMenuStockProfile(
  _prev: MenuStockState,
  formData: FormData,
): Promise<MenuStockState> {
  try {
    await requireDesk();
    const menuItemId = trimRequired(formData.get("menu_item_id"), "Menu item");
    const stockMode = trimRequired(formData.get("stock_mode"), "Stock mode");
    if (!STOCK_MODES.has(stockMode)) throw new Error("Invalid stock mode.");

    const qtyPerSale = Number(formData.get("qty_per_sale") ?? 1);
    if (!Number.isFinite(qtyPerSale) || qtyPerSale <= 0 || qtyPerSale > 10000) {
      throw new Error("Quantity per sale must be greater than zero.");
    }
    const autoDisable = formData.get("auto_disable") !== "0";
    let inventoryItemId = optionalTrim(formData.get("inventory_item_id")) ?? null;
    const recipeRaw = optionalTrim(formData.get("recipe_json")) ?? "[]";
    const recipe = JSON.parse(recipeRaw) as {
      inventoryItemId: string;
      qtyPerSale: number;
    }[];

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: menuItem } = await admin
      .from("menu_items")
      .select("id, name, outlet")
      .eq("id", menuItemId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!menuItem) throw new Error("Menu item not found.");

    if (stockMode === "finished_good" && !inventoryItemId) {
      const sku = `MENU-${menuItemId.slice(0, 8).toUpperCase()}`;
      const { data: created, error } = await admin
        .from("inventory_items")
        .upsert(
          {
            property_id: propertyId,
            sku,
            name: menuItem.name as string,
            category:
              (menuItem.outlet as string) === "pastry" ? "dry" : "other",
            unit: "ea",
            qty_on_hand: 0,
            reorder_level: 0,
            unit_cost_btn: 0,
            notes: "Auto-created for purchased menu stock",
          },
          { onConflict: "property_id,sku" },
        )
        .select("id")
        .single();
      if (error || !created) throw new Error("Could not create stock SKU.");
      inventoryItemId = created.id as string;
    }

    if (inventoryItemId) {
      const { data: inventoryItem } = await admin
        .from("inventory_items")
        .select("id")
        .eq("id", inventoryItemId)
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .maybeSingle();
      if (!inventoryItem) throw new Error("Inventory item not found.");
    }

    if (stockMode === "recipe") {
      if (recipe.length === 0) {
        throw new Error("Add at least one ingredient to the recipe.");
      }
      for (const component of recipe) {
        if (
          !component.inventoryItemId ||
          !Number.isFinite(component.qtyPerSale) ||
          component.qtyPerSale <= 0
        ) {
          throw new Error("Every recipe ingredient needs a valid quantity.");
        }
      }
    }

    const { error: profileError } = await admin
      .from("menu_stock_profiles")
      .upsert(
        {
          menu_item_id: menuItemId,
          property_id: propertyId,
          stock_mode: stockMode,
          inventory_item_id:
            stockMode === "finished_good" ? inventoryItemId : null,
          qty_per_sale: qtyPerSale,
          auto_disable: autoDisable,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "menu_item_id" },
      );
    if (profileError) throw new Error("Could not save stock settings.");

    await admin.from("menu_recipe_items").delete().eq("menu_item_id", menuItemId);
    if (stockMode === "recipe") {
      const { error: recipeError } = await admin
        .from("menu_recipe_items")
        .insert(
          recipe.map((component) => ({
            property_id: propertyId,
            menu_item_id: menuItemId,
            inventory_item_id: component.inventoryItemId,
            qty_per_sale: component.qtyPerSale,
          })),
        );
      if (recipeError) throw new Error("Could not save recipe ingredients.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.stock.configure",
      entityType: "menu_items",
      entityId: menuItemId,
      summary: `Configured ${menuItem.name as string} as ${stockMode}`,
      meta: { stockMode, inventoryItemId, qtyPerSale, recipe },
    });
    revalidateMenuStock();
    return { ok: true, message: "Stock settings saved." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save stock settings.",
    };
  }
}

/** Receive purchased finished goods such as pastries bought from a supplier. */
export async function receiveMenuStock(
  _prev: MenuStockState,
  formData: FormData,
): Promise<MenuStockState> {
  try {
    await requireDesk();
    const menuItemId = trimRequired(formData.get("menu_item_id"), "Menu item");
    const qty = Number(formData.get("qty"));
    const unitCostRaw = optionalTrim(formData.get("unit_cost_btn"));
    const unitCost = unitCostRaw ? Number(unitCostRaw) : null;
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Received quantity must be greater than zero.");
    }
    if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      throw new Error("Unit cost cannot be negative.");
    }
    const reference = optionalTrim(formData.get("reference")) ?? null;
    const batchRef = optionalTrim(formData.get("batch_ref")) ?? null;
    const expiresOn = optionalTrim(formData.get("expires_on")) ?? null;

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: menuItem } = await admin
      .from("menu_items")
      .select("id, name")
      .eq("id", menuItemId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!menuItem) throw new Error("Menu item not found.");

    const { data, error } = await admin.rpc("pos_receive_menu_stock", {
      p_menu_item_id: menuItemId,
      p_qty: qty,
      p_unit_cost_btn: unitCost,
      p_reference: reference,
      p_batch_ref: batchRef,
      p_expires_on: expiresOn,
    });
    if (error) throw new Error(error.message || "Could not receive stock.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.stock.receive",
      entityType: "menu_items",
      entityId: menuItemId,
      summary: `Received ${qty} × ${menuItem.name as string}`,
      meta: { qty, unitCost, reference, batchRef, expiresOn, nextQty: data },
    });
    revalidateMenuStock();
    return {
      ok: true,
      message: `Received ${qty}. On hand: ${Number(data ?? 0)}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not receive stock.",
    };
  }
}
