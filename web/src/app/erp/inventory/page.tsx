import { InventoryDesk } from "@/components/erp/InventoryDesk";
import type { InvItemRow, InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { DeskListShell } from "@/components/erp/DeskListShell";
import type { InventoryCategoryRow } from "@/lib/inventory-catalog";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Inventory items | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpInventoryPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: items }, { data: locations }, { data: categories }, { data: balances }] =
    await Promise.all([
      admin
        .from("inventory_items")
        .select(
          "id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn, is_active, default_location_id",
        )
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("sku")
        .limit(500),
      admin
        .from("inventory_locations")
        .select("id, code, name, department")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("sort_order"),
      admin
        .from("inventory_categories")
        .select("slug, name, sort_order")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("sort_order"),
      admin
        .from("inventory_balances")
        .select("item_id, qty_on_hand, inventory_locations(code, name)")
        .eq("property_id", propertyId),
    ]);

  const balancesByItem = new Map<
    string,
    { code: string; name: string; qty: number }[]
  >();
  for (const b of balances ?? []) {
    const itemId = b.item_id as string;
    const loc = b.inventory_locations as { code?: string; name?: string } | null;
    if (!loc?.code) continue;
    const list = balancesByItem.get(itemId) ?? [];
    list.push({
      code: loc.code,
      name: loc.name ?? loc.code,
      qty: Number(b.qty_on_hand),
    });
    balancesByItem.set(itemId, list);
  }

  const itemRows: InvItemRow[] = (items ?? []).map((i) => ({
    id: i.id as string,
    sku: i.sku as string,
    name: i.name as string,
    category: i.category as string,
    unit: i.unit as string,
    qty_on_hand: Number(i.qty_on_hand),
    reorder_level: Number(i.reorder_level),
    unit_cost_btn: Number(i.unit_cost_btn),
    default_location_id: (i.default_location_id as string | null) ?? null,
    location_balances: balancesByItem.get(i.id as string) ?? [],
  }));

  const locationRows: InvLocationOption[] = (locations ?? []).map((l) => ({
    id: l.id as string,
    code: l.code as string,
    name: l.name as string,
    department: l.department as string,
  }));

  const categoryRows: InventoryCategoryRow[] = (categories ?? []).map((c) => ({
    slug: c.slug as string,
    name: c.name as string,
    sort_order: Number(c.sort_order),
  }));

  const lowCount = itemRows.filter((i) => i.qty_on_hand <= i.reorder_level).length;
  const stockValue = itemRows.reduce(
    (s, i) => s + i.qty_on_hand * i.unit_cost_btn,
    0,
  );

  return (
    <DeskListShell
      eyebrow="Inventory"
      heading="Items"
      blurb="One SKU per row · qty on hand · receive, damage, transfer from row actions. Add catalog lines in the sheet — not a long form."
    >
      {locationRows.length === 0 ? (
        <p className="text-sm text-destructive">
          No inventory locations — open{" "}
          <a href="/erp/inventory/locations" className="underline">
            Locations
          </a>{" "}
          or apply migrations.
        </p>
      ) : (
        <InventoryDesk
          items={itemRows}
          locations={locationRows}
          categories={categoryRows}
          lowCount={lowCount}
          stockValue={stockValue}
        />
      )}
    </DeskListShell>
  );
}
