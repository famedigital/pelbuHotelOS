import {
  AssetTable,
  RegisterAssetForm,
  type AssetRow,
} from "@/components/erp/inventory/AssetRegister";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Asset register",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InventoryAssetsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: assets } = await admin
    .from("accounting_fixed_assets")
    .select("id, asset_code, name, category, purchase_date, cost_btn, status")
    .eq("property_id", propertyId)
    .order("asset_code")
    .limit(200);

  const rows: AssetRow[] = (assets ?? []).map((a) => ({
    id: a.id as string,
    asset_code: a.asset_code as string,
    name: a.name as string,
    category: a.category as string,
    purchase_date: a.purchase_date as string,
    cost_btn: Number(a.cost_btn),
    status: a.status as string,
  }));

  return (
    <DeskListShell
      eyebrow="Inventory"
      heading="Asset register"
      blurb="Lite fixed-asset list from accounting. Depreciation runs stay in Finance → Accounting."
    >
      <RegisterAssetForm />
      <AssetTable assets={rows} />
    </DeskListShell>
  );
}
