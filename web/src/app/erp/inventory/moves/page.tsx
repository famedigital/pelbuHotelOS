import type { MovementRow } from "@/components/erp/InventoryDesk";
import { InventoryMovesTable } from "@/components/erp/inventory/InventoryMovesTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Inventory moves | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InventoryMovesPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { sku } = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: moves } = await admin
    .from("inventory_movements")
    .select(
      `id, movement_kind, qty_delta, unit_cost_btn, total_amount_btn, reference, created_at,
       inventory_items(sku, name),
       inventory_locations(name)`,
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(200);

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

  return (
    <DeskListShell
      eyebrow="Inventory"
      heading="Moves"
      blurb="Receive, damage, transfer, issue, and audit adjustments — full movement ledger."
    >
      <InventoryMovesTable movements={movementRows} initialSku={sku} />
    </DeskListShell>
  );
}
