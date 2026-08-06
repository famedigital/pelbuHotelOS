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

// Values in "use server" files must not be exported (Next only allows async
// functions). Prep station list stays private to this module.

const MENU_PREP_STATIONS = [
  "kitchen",
  "bar",
  "pastry",
  "grill",
  "cold",
] as const;

export type MenuOutlet = string;
export type MenuPrepStation = (typeof MENU_PREP_STATIONS)[number];

export type MenuAdminState = {
  ok: boolean;
  itemId?: string;
  /** Snapshot for client list update without remounting the admin page. */
  item?: {
    id: string;
    name: string;
    outlet: string;
    category: string;
    description: string | null;
    price_btn: number;
    gst_applicable: boolean;
    is_available: boolean;
    is_popular: boolean;
    prep_station: MenuPrepStation;
    sort_order: number;
    image_public_id: string | null;
  };
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

function revalidateOutletSurfaces(opts?: { refreshAdmin?: boolean }) {
  // Avoid revalidating /erp/menu on every menu item write — remounts the catalog
  // while staff are still in the add/edit dialog (reads as a full page reload).
  // Outlet create/archive may set refreshAdmin so the outlet tabs update.
  if (opts?.refreshAdmin) {
    revalidatePath("/erp/menu");
  }
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
    await ensureMenuCategory(admin, propertyId, category);

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

    const snapshot = {
      id: itemId ?? "",
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
      return { ok: true, itemId, item: { ...snapshot, id: itemId } };
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
    return {
      ok: true,
      itemId: created.id as string,
      item: { ...snapshot, id: created.id as string },
    };
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
    return { ok: true, itemId };
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
    revalidateOutletSurfaces({ refreshAdmin: true });
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
    revalidateOutletSurfaces({ refreshAdmin: true });
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
    revalidateOutletSurfaces({ refreshAdmin: true });
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

// ---------------------------------------------------------------------------
// Bar packs + categories
// ---------------------------------------------------------------------------

export type BarPackState = {
  ok: boolean;
  message?: string;
  error?: string;
  familyId?: string;
};

export type MenuCategoryState = {
  ok: boolean;
  message?: string;
  error?: string;
  categories?: { id: string; name: string; sort_order: number; is_active: boolean }[];
};

function parsePositiveMoney(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    throw new Error(`${label} must be between 0 and 1,000,000 Nu.`);
  }
  return Math.round(n * 100) / 100;
}

async function ensureMenuCategory(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  name: string,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category is required.");
  if (trimmed.length > 40) {
    throw new Error("Category must be 40 characters or fewer.");
  }
  const { data: existing } = await admin
    .from("menu_categories")
    .select("id")
    .eq("property_id", propertyId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: maxRow } = await admin
    .from("menu_categories")
    .select("sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = Number(maxRow?.sort_order ?? 0) + 10;

  const { data: created, error } = await admin
    .from("menu_categories")
    .insert({
      property_id: propertyId,
      name: trimmed,
      sort_order: sortOrder,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !created) {
    // Race: concurrent create
    const { data: again } = await admin
      .from("menu_categories")
      .select("id")
      .eq("property_id", propertyId)
      .ilike("name", trimmed)
      .maybeSingle();
    if (again?.id) return again.id as string;
    throw new Error("Could not create category.");
  }
  return created.id as string;
}

async function nextMenuSort(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  outlet: string,
): Promise<number> {
  const { data } = await admin
    .from("menu_items")
    .select("sort_order")
    .eq("property_id", propertyId)
    .eq("outlet", outlet)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.sort_order ?? 0) + 10;
}

/** Create spirit inventory + Pek/Bottle menu items sharing one ml ledger. */
export async function createSpiritBarPack(
  _prev: BarPackState,
  formData: FormData,
): Promise<BarPackState> {
  try {
    await requireDesk();
    const {
      barSkuFragment,
      formatPeksPerBottleLabel,
      peksPerBottle,
      DEFAULT_PEK_ML,
    } = await import("@/lib/bar-packaging");

    const name = trimRequired(formData.get("name"), "Brand name");
    if (name.length > 60) throw new Error("Brand name must be 60 characters or fewer.");
    const outletRaw = optionalTrim(formData.get("outlet")) ?? "bar";
    const category = trimRequired(formData.get("category"), "Category");
    const bottleMl = Number(formData.get("bottle_size_ml"));
    const pourMl = Number(formData.get("pour_ml") ?? DEFAULT_PEK_ML);
    const pricePek = parsePositiveMoney(
      trimRequired(formData.get("price_pek"), "Pek price"),
      "Pek price",
    );
    const priceBottle = parsePositiveMoney(
      trimRequired(formData.get("price_bottle"), "Bottle price"),
      "Bottle price",
    );
    if (!Number.isFinite(bottleMl) || bottleMl < 50 || bottleMl > 5000) {
      throw new Error("Bottle size must be between 50 and 5000 ml.");
    }
    if (!Number.isFinite(pourMl) || pourMl < 10 || pourMl > 200) {
      throw new Error("Pour (pek) size must be between 10 and 200 ml.");
    }
    if (pourMl > bottleMl) {
      throw new Error("Pour size cannot exceed bottle size.");
    }
    const peks = peksPerBottle(bottleMl, pourMl);
    if (peks < 1) throw new Error("Bottle is too small for even one pek.");

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const outletRow = await assertPropertyOutlet(admin, propertyId, outletRaw, {
      allowArchived: false,
    });
    const outlet = outletRow.code;
    await ensureMenuCategory(admin, propertyId, category);

    const skuBase = `BAR-${barSkuFragment(name)}`;
    const { data: inv, error: invError } = await admin
      .from("inventory_items")
      .insert({
        property_id: propertyId,
        sku: skuBase,
        name: `${name} (spirit ml)`,
        category: "beverage",
        unit: "ml",
        qty_on_hand: 0,
        reorder_level: bottleMl * 2,
        unit_cost_btn: 0,
        is_active: true,
        bottle_size_ml: bottleMl,
        standard_pour_ml: pourMl,
        bar_kind: "spirit",
        notes: formatPeksPerBottleLabel(bottleMl, pourMl),
      })
      .select("id")
      .single();
    if (invError || !inv) {
      throw new Error(
        invError?.code === "23505"
          ? "An inventory SKU for this brand already exists. Change the name slightly."
          : "Could not create spirit inventory SKU.",
      );
    }
    const inventoryItemId = inv.id as string;

    const { data: family, error: familyError } = await admin
      .from("menu_item_families")
      .insert({
        property_id: propertyId,
        name,
        inventory_item_id: inventoryItemId,
        bar_kind: "spirit",
      })
      .select("id")
      .single();
    if (familyError || !family) {
      throw new Error(
        familyError?.code === "23505"
          ? "A bar pack with this name already exists."
          : "Could not create bar family.",
      );
    }
    const familyId = family.id as string;

    let sort = await nextMenuSort(admin, propertyId, outlet);
    const menuRows = [
      {
        property_id: propertyId,
        name: `${name} · Pek`,
        outlet,
        category,
        description: `${pourMl} ml pour · ${formatPeksPerBottleLabel(bottleMl, pourMl)}`,
        price_btn: pricePek,
        gst_applicable: true,
        is_available: true,
        is_popular: false,
        prep_station: "bar",
        sort_order: sort,
        family_id: familyId,
        sell_size: "pek" as const,
      },
      {
        property_id: propertyId,
        name: `${name} · Bottle`,
        outlet,
        category,
        description: `${bottleMl} ml bottle · ${peks} peks`,
        price_btn: priceBottle,
        gst_applicable: true,
        is_available: true,
        is_popular: false,
        prep_station: "bar",
        sort_order: sort + 1,
        family_id: familyId,
        sell_size: "bottle" as const,
      },
    ];

    const { data: createdItems, error: menuError } = await admin
      .from("menu_items")
      .insert(menuRows)
      .select("id, sell_size");
    if (menuError || !createdItems?.length) {
      throw new Error(
        menuError?.message ?? "Could not create pek/bottle menu items.",
      );
    }

    for (const item of createdItems) {
      const sellSize = item.sell_size as string;
      const qtyPerSale = sellSize === "bottle" ? bottleMl : pourMl;
      const { error: stockError } = await admin.from("menu_stock_profiles").upsert(
        {
          menu_item_id: item.id,
          property_id: propertyId,
          stock_mode: "finished_good",
          inventory_item_id: inventoryItemId,
          qty_per_sale: qtyPerSale,
          auto_disable: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "menu_item_id" },
      );
      if (stockError) throw new Error("Could not link stock profile.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.bar.spirit_pack",
      entityType: "menu_item_families",
      entityId: familyId,
      summary: `Spirit pack ${name}: ${formatPeksPerBottleLabel(bottleMl, pourMl)}`,
      meta: {
        bottleMl,
        pourMl,
        peks,
        pricePek,
        priceBottle,
        inventoryItemId,
      },
    });
    revalidateMenuStock();
    revalidateOutletSurfaces({ refreshAdmin: true });
    return {
      ok: true,
      familyId,
      message: `Created ${name}: ${formatPeksPerBottleLabel(bottleMl, pourMl)}. Receive bottles under Stock & bar.`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not create spirit pack.",
    };
  }
}

/** Create beer/can inventory (ea) + single-bottle menu sellable. */
export async function createBeerBarPack(
  _prev: BarPackState,
  formData: FormData,
): Promise<BarPackState> {
  try {
    await requireDesk();
    const { barSkuFragment } = await import("@/lib/bar-packaging");

    const name = trimRequired(formData.get("name"), "Brand name");
    if (name.length > 60) throw new Error("Brand name must be 60 characters or fewer.");
    const outletRaw = optionalTrim(formData.get("outlet")) ?? "bar";
    const category = trimRequired(formData.get("category"), "Category");
    const bottlesPerCase = Number(formData.get("bottles_per_case") ?? 24);
    const priceBottle = parsePositiveMoney(
      trimRequired(formData.get("price_bottle"), "Bottle price"),
      "Bottle price",
    );
    if (
      !Number.isInteger(bottlesPerCase) ||
      bottlesPerCase < 1 ||
      bottlesPerCase > 500
    ) {
      throw new Error("Bottles per case must be a whole number from 1 to 500.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const outletRow = await assertPropertyOutlet(admin, propertyId, outletRaw, {
      allowArchived: false,
    });
    const outlet = outletRow.code;
    await ensureMenuCategory(admin, propertyId, category);

    const sku = `BAR-${barSkuFragment(name)}`;
    const { data: inv, error: invError } = await admin
      .from("inventory_items")
      .insert({
        property_id: propertyId,
        sku,
        name: `${name} (bottle)`,
        category: "beverage",
        unit: "ea",
        qty_on_hand: 0,
        reorder_level: bottlesPerCase,
        unit_cost_btn: 0,
        is_active: true,
        bottles_per_case: bottlesPerCase,
        bar_kind: "beer",
        notes: `${bottlesPerCase} bottles per case`,
      })
      .select("id")
      .single();
    if (invError || !inv) {
      throw new Error(
        invError?.code === "23505"
          ? "SKU already exists — rename slightly."
          : "Could not create beer inventory SKU.",
      );
    }
    const inventoryItemId = inv.id as string;

    const { data: family, error: familyError } = await admin
      .from("menu_item_families")
      .insert({
        property_id: propertyId,
        name,
        inventory_item_id: inventoryItemId,
        bar_kind: "beer",
      })
      .select("id")
      .single();
    if (familyError || !family) {
      throw new Error(
        familyError?.code === "23505"
          ? "A bar pack with this name already exists."
          : "Could not create bar family.",
      );
    }
    const familyId = family.id as string;
    const sort = await nextMenuSort(admin, propertyId, outlet);

    const { data: menuItem, error: menuError } = await admin
      .from("menu_items")
      .insert({
        property_id: propertyId,
        name: `${name} · Bottle`,
        outlet,
        category,
        description: `${bottlesPerCase} per case`,
        price_btn: priceBottle,
        gst_applicable: true,
        is_available: true,
        is_popular: false,
        prep_station: "bar",
        sort_order: sort,
        family_id: familyId,
        sell_size: "single",
      })
      .select("id")
      .single();
    if (menuError || !menuItem) {
      throw new Error(menuError?.message ?? "Could not create menu item.");
    }

    const { error: stockError } = await admin.from("menu_stock_profiles").upsert(
      {
        menu_item_id: menuItem.id,
        property_id: propertyId,
        stock_mode: "finished_good",
        inventory_item_id: inventoryItemId,
        qty_per_sale: 1,
        auto_disable: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "menu_item_id" },
    );
    if (stockError) throw new Error("Could not link stock profile.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.bar.beer_pack",
      entityType: "menu_item_families",
      entityId: familyId,
      summary: `Beer pack ${name}: ${bottlesPerCase}/case`,
      meta: { bottlesPerCase, priceBottle, inventoryItemId },
    });
    revalidateMenuStock();
    revalidateOutletSurfaces({ refreshAdmin: true });
    return {
      ok: true,
      familyId,
      message: `Created ${name} · Bottle. Receive cases under Stock & bar.`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not create beer pack.",
    };
  }
}

/**
 * Receive bar pack stock as staff count it (bottles or cases), convert to ledger units.
 */
export async function receiveBarPack(
  _prev: BarPackState,
  formData: FormData,
): Promise<BarPackState> {
  try {
    await requireDesk();
    const { bottlesFromCases, mlFromBottles } = await import(
      "@/lib/bar-packaging"
    );
    const inventoryItemId = trimRequired(
      formData.get("inventory_item_id"),
      "Stock item",
    );
    const packCount = Number(formData.get("pack_count"));
    const unitCostRaw = optionalTrim(formData.get("unit_cost_btn"));
    const unitCost = unitCostRaw ? Number(unitCostRaw) : null;
    const reference = optionalTrim(formData.get("reference")) ?? null;
    if (!Number.isFinite(packCount) || packCount <= 0 || packCount > 10000) {
      throw new Error("Pack count must be greater than zero.");
    }
    if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      throw new Error("Unit cost cannot be negative.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: item } = await admin
      .from("inventory_items")
      .select(
        "id, name, unit, qty_on_hand, bottle_size_ml, bottles_per_case, bar_kind",
      )
      .eq("id", inventoryItemId)
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .maybeSingle();
    if (!item) throw new Error("Inventory item not found.");

    let ledgerQty = packCount;
    let packLabel = "units";
    const barKind = item.bar_kind as string | null;
    if (barKind === "spirit" || (item.unit === "ml" && item.bottle_size_ml)) {
      const bottleMl = Number(item.bottle_size_ml);
      if (!bottleMl) throw new Error("Spirit SKU is missing bottle size (ml).");
      ledgerQty = mlFromBottles(packCount, bottleMl);
      packLabel = "bottles";
    } else if (
      barKind === "beer" ||
      (item.unit === "ea" && item.bottles_per_case)
    ) {
      const perCase = Number(item.bottles_per_case ?? 0);
      if (perCase >= 1) {
        ledgerQty = bottlesFromCases(packCount, perCase);
        packLabel = "cases";
      } else {
        packLabel = "bottles";
      }
    }

    const prevQty = Number(item.qty_on_hand ?? 0);
    const nextQty = Math.round((prevQty + ledgerQty) * 1000) / 1000;
    const { error: updError } = await admin
      .from("inventory_items")
      .update({ qty_on_hand: nextQty })
      .eq("id", inventoryItemId)
      .eq("property_id", propertyId);
    if (updError) throw new Error("Could not update on-hand quantity.");

    const sourceKey = `bar-receive:${inventoryItemId}:${Date.now()}:${packCount}`;
    const { error: movError } = await admin.from("inventory_movements").insert({
      property_id: propertyId,
      item_id: inventoryItemId,
      movement_kind: "receive",
      qty_delta: ledgerQty,
      unit_cost_btn: unitCost,
      reference,
      notes: `Bar receive ${packCount} ${packLabel} → ${ledgerQty} ${item.unit as string}`,
      created_by: "desk",
      source_key: sourceKey,
    });
    if (movError) {
      // Roll back qty if movement failed
      await admin
        .from("inventory_items")
        .update({ qty_on_hand: prevQty })
        .eq("id", inventoryItemId);
      throw new Error("Could not record receive movement.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.bar.receive",
      entityType: "inventory_items",
      entityId: inventoryItemId,
      summary: `Received ${packCount} ${packLabel} → ${item.name as string}`,
      meta: { packCount, ledgerQty, nextQty, unitCost },
    });
    revalidateMenuStock();
    return {
      ok: true,
      message: `Received ${packCount} ${packLabel}. On hand: ${nextQty} ${item.unit as string}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not receive bar stock.",
    };
  }
}

/** Write off waste/spill in peks, bottles, or ml/ea without a sale. */
export async function wasteBarStock(
  _prev: BarPackState,
  formData: FormData,
): Promise<BarPackState> {
  try {
    await requireDesk();
    const { wasteQtyInBaseUnit, DEFAULT_PEK_ML } = await import(
      "@/lib/bar-packaging"
    );
    const inventoryItemId = trimRequired(
      formData.get("inventory_item_id"),
      "Stock item",
    );
    const unit = (optionalTrim(formData.get("waste_unit")) ?? "pek") as
      | "pek"
      | "bottle"
      | "ml"
      | "ea";
    const amount = Number(formData.get("amount"));
    const reason = trimRequired(formData.get("reason"), "Reason");
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      throw new Error("Waste amount must be greater than zero.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: item } = await admin
      .from("inventory_items")
      .select(
        "id, name, unit, qty_on_hand, bottle_size_ml, standard_pour_ml, bar_kind",
      )
      .eq("id", inventoryItemId)
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .maybeSingle();
    if (!item) throw new Error("Inventory item not found.");

    const pourMl = Number(item.standard_pour_ml ?? DEFAULT_PEK_ML);
    const bottleMl = item.bottle_size_ml
      ? Number(item.bottle_size_ml)
      : null;
    const wasteUnit =
      unit === "pek" || unit === "bottle" || unit === "ml" || unit === "ea"
        ? unit
        : "ml";
    const remove = wasteQtyInBaseUnit({
      unit: wasteUnit,
      amount,
      pourMl,
      bottleSizeMl: bottleMl,
    });
    if (remove <= 0) throw new Error("Invalid waste quantity.");

    const prevQty = Number(item.qty_on_hand ?? 0);
    if (remove > prevQty) {
      throw new Error(
        `Only ${prevQty} ${item.unit as string} on hand — cannot waste ${remove}.`,
      );
    }
    const nextQty = Math.round((prevQty - remove) * 1000) / 1000;

    const { error: updError } = await admin
      .from("inventory_items")
      .update({ qty_on_hand: nextQty })
      .eq("id", inventoryItemId)
      .eq("property_id", propertyId);
    if (updError) throw new Error("Could not update on-hand quantity.");

    const sourceKey = `bar-waste:${inventoryItemId}:${Date.now()}:${amount}:${wasteUnit}`;
    const { error: movError } = await admin.from("inventory_movements").insert({
      property_id: propertyId,
      item_id: inventoryItemId,
      movement_kind: "waste",
      qty_delta: -remove,
      notes: reason.slice(0, 300),
      created_by: "desk",
      source_key: sourceKey,
      reference: optionalTrim(formData.get("reference")) ?? null,
    });
    if (movError) {
      await admin
        .from("inventory_items")
        .update({ qty_on_hand: prevQty })
        .eq("id", inventoryItemId);
      throw new Error("Could not record waste movement.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "menu.bar.waste",
      entityType: "inventory_items",
      entityId: inventoryItemId,
      summary: `Waste ${amount} ${wasteUnit} · ${item.name as string}`,
      meta: { amount, wasteUnit, remove, nextQty, reason },
    });
    revalidateMenuStock();
    return {
      ok: true,
      message: `Wasted ${amount} ${wasteUnit}. On hand: ${nextQty} ${item.unit as string}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not record waste.",
    };
  }
}

export async function saveMenuCategory(
  _prev: MenuCategoryState,
  formData: FormData,
): Promise<MenuCategoryState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const categoryId = optionalTrim(formData.get("category_id"));
    const name = trimRequired(formData.get("name"), "Category name");
    if (name.length > 40) throw new Error("Category must be 40 characters or fewer.");
    const sortOrder = Number(formData.get("sort_order") ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      throw new Error("Sort order must be 0–9999.");
    }
    const isActive = formData.get("is_active") !== "0";

    if (categoryId) {
      const { data: before } = await admin
        .from("menu_categories")
        .select("name")
        .eq("id", categoryId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (!before) throw new Error("Category not found.");
      const { error } = await admin
        .from("menu_categories")
        .update({
          name: name.trim(),
          sort_order: sortOrder,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", categoryId)
        .eq("property_id", propertyId);
      if (error) {
        throw new Error(
          error.code === "23505"
            ? "Another category already uses that name."
            : "Could not update category.",
        );
      }
      // Denormalized menu_items.category rename
      if ((before.name as string) !== name.trim()) {
        await admin
          .from("menu_items")
          .update({ category: name.trim() })
          .eq("property_id", propertyId)
          .eq("category", before.name as string);
      }
    } else {
      await ensureMenuCategory(admin, propertyId, name.trim());
      // ensureMenuCategory doesn't set custom sort — update if needed
      await admin
        .from("menu_categories")
        .update({ sort_order: sortOrder, is_active: isActive })
        .eq("property_id", propertyId)
        .ilike("name", name.trim());
    }

    revalidateMenuStock();
    revalidateOutletSurfaces({ refreshAdmin: true });
    return { ok: true, message: categoryId ? "Category updated." : "Category added." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save category.",
    };
  }
}

export async function archiveMenuCategory(
  _prev: MenuCategoryState,
  formData: FormData,
): Promise<MenuCategoryState> {
  try {
    await requireDesk();
    const categoryId = trimRequired(formData.get("category_id"), "Category");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { error } = await admin
      .from("menu_categories")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", categoryId)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not archive category.");
    revalidateMenuStock();
    return { ok: true, message: "Category archived." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not archive category.",
    };
  }
}
