import { InventoryDesk } from "@/components/erp/InventoryDesk";
import type { InvItemRow, InvLocationOption } from "@/components/erp/InventoryOpsForms";
import type { MovementRow } from "@/components/erp/InventoryDesk";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Inventory | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpInventoryPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: items }, { data: locations }, { data: moves }, { data: balances }] =
    await Promise.all([
    admin
      .from("inventory_items")
      .select(
        "id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn, is_active, default_location_id",
      )
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sku")
      .limit(300),
    admin
      .from("inventory_locations")
      .select("id, code, name, department")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("inventory_movements")
      .select(
        `id, movement_kind, qty_delta, unit_cost_btn, total_amount_btn, reference, created_at,
         inventory_items(sku, name),
         inventory_locations(name)`,
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50),
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

  const movementRows: MovementRow[] = (moves ?? []).map((m) => {
    const item = m.inventory_items as { sku?: string; name?: string } | null;
    const loc = m.inventory_locations as { name?: string } | null;
    return {
      id: m.id as string,
      movement_kind: m.movement_kind as string,
      qty_delta: Number(m.qty_delta),
      unit_cost_btn: m.unit_cost_btn != null ? Number(m.unit_cost_btn) : null,
      total_amount_btn: m.total_amount_btn != null ? Number(m.total_amount_btn) : null,
      reference: (m.reference as string | null) ?? null,
      created_at: m.created_at as string,
      sku: item?.sku ?? "—",
      name: item?.name ?? "",
      location_name: loc?.name ?? null,
    };
  });

  const lowCount = itemRows.filter((i) => i.qty_on_hand <= i.reorder_level).length;
  const stockValue = itemRows.reduce(
    (s, i) => s + i.qty_on_hand * i.unit_cost_btn,
    0,
  );

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <header className="space-y-1.5">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Team &amp; inventory
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Inventory
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Table-first stock by SKU · receive with receipt photo · damage and
          replace · transfers between store, pantry, F&amp;B, and room amenities.
        </p>
      </header>

      {locationRows.length === 0 ? (
        <p className="text-sm text-destructive">
          No inventory locations — apply the Phase 3 migration.
        </p>
      ) : (
        <InventoryDesk
          items={itemRows}
          locations={locationRows}
          movements={movementRows}
          lowCount={lowCount}
          stockValue={stockValue}
        />
      )}
    </div>
  );
}
