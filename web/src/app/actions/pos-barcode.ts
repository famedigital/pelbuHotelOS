"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Resolve a scanned barcode to a sellable menu_item id for the active property.
 * Order: menu sell_barcode → inventory barcode → finished_good menu profile.
 */
export async function resolvePosBarcode(
  code: string,
): Promise<{ ok: true; menuItemId: string } | { ok: false; error: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Sign in again." };
    }
    const barcode = code.trim();
    if (!barcode) return { ok: false, error: "Empty barcode." };

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: bySell } = await admin
      .from("menu_items")
      .select("id")
      .eq("property_id", propertyId)
      .eq("sell_barcode", barcode)
      .eq("is_available", true)
      .maybeSingle();
    if (bySell?.id) {
      return { ok: true, menuItemId: bySell.id as string };
    }

    const { data: inv } = await admin
      .from("inventory_items")
      .select("id")
      .eq("property_id", propertyId)
      .eq("barcode", barcode)
      .eq("is_active", true)
      .maybeSingle();
    if (!inv?.id) {
      return { ok: false, error: "Unknown barcode." };
    }

    const { data: profile } = await admin
      .from("menu_stock_profiles")
      .select("menu_item_id")
      .eq("property_id", propertyId)
      .eq("inventory_item_id", inv.id)
      .eq("stock_mode", "finished_good")
      .limit(1)
      .maybeSingle();
    if (profile?.menu_item_id) {
      return { ok: true, menuItemId: profile.menu_item_id as string };
    }

    return {
      ok: false,
      error: "Barcode found in inventory but not linked to a menu item.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Lookup failed.",
    };
  }
}
