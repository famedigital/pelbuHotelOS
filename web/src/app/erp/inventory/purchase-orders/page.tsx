import {
  CreatePurchaseOrderForm,
  PurchaseOrderDetail,
  type PoRow,
} from "@/components/erp/inventory/PurchaseOrderForms";
import type { InvItemRow, InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Purchase orders | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InventoryPurchaseOrdersPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: orders }, { data: items }, { data: locations }] = await Promise.all([
    admin
      .from("inventory_purchase_orders")
      .select(
        `id, po_number, vendor_name, status, notes, ordered_at, received_at, created_at, receive_location_id,
         inventory_purchase_order_lines(
           id, item_id, sku_snapshot, name_snapshot, qty_ordered, qty_received, unit_cost_btn
         )`,
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("inventory_items")
      .select("id, sku, name, category, unit, qty_on_hand, reorder_level, unit_cost_btn, default_location_id")
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
  ]);

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
  }));

  const locationRows: InvLocationOption[] = (locations ?? []).map((l) => ({
    id: l.id as string,
    code: l.code as string,
    name: l.name as string,
    department: l.department as string,
  }));

  const poRows: PoRow[] = (orders ?? []).map((o) => ({
    id: o.id as string,
    po_number: o.po_number as string,
    vendor_name: (o.vendor_name as string | null) ?? null,
    status: o.status as string,
    notes: (o.notes as string | null) ?? null,
    receive_location_id: (o.receive_location_id as string | null) ?? null,
    lines: (
      (o.inventory_purchase_order_lines as PoRow["lines"] | null) ?? []
    ).map((l) => ({
      id: l.id,
      item_id: l.item_id,
      sku_snapshot: l.sku_snapshot,
      name_snapshot: l.name_snapshot,
      qty_ordered: Number(l.qty_ordered),
      qty_received: Number(l.qty_received),
      unit_cost_btn: Number(l.unit_cost_btn),
    })),
  }));

  return (
    <DeskListShell
      eyebrow="Inventory"
      heading="Purchase orders"
      blurb="Draft → approve → receive against stock at your chosen location."
    >
      <CreatePurchaseOrderForm items={itemRows} locations={locationRows} />

      <div className="space-y-4">
        {poRows.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
            No purchase orders yet. Create a draft above.
          </p>
        ) : (
          poRows.map((po) => <PurchaseOrderDetail key={po.id} po={po} />)
        )}
      </div>
    </DeskListShell>
  );
}
