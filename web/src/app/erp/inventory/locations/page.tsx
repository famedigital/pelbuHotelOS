import { InventoryLocationsPanel } from "@/components/erp/inventory/InventoryLocationsPanel";
import type { InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Inventory locations | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InventoryLocationsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: locations } = await admin
    .from("inventory_locations")
    .select("id, code, name, department")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("sort_order");

  const locationRows: InvLocationOption[] = (locations ?? []).map((l) => ({
    id: l.id as string,
    code: l.code as string,
    name: l.name as string,
    department: l.department as string,
  }));

  return (
    <DeskListShell
      eyebrow="Inventory"
      heading="Locations"
      blurb="Store, pantry, kitchen, F&B bar, room amenities cart — staff can add departments as needed."
    >
      <InventoryLocationsPanel locations={locationRows} />
    </DeskListShell>
  );
}
