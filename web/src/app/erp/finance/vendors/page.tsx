import { VendorForm, VendorTable, type VendorRow } from "@/components/erp/finance/VendorForms";
import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Vendors | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FinanceVendorsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: vendors } = await admin
    .from("accounting_vendors")
    .select("id, name, tax_id, phone, email, is_active")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("name")
    .limit(200);

  const rows: VendorRow[] = (vendors ?? []).map((v) => ({
    id: v.id as string,
    name: v.name as string,
    tax_id: (v.tax_id as string | null) ?? null,
    phone: (v.phone as string | null) ?? null,
    email: (v.email as string | null) ?? null,
    is_active: Boolean(v.is_active),
  }));

  return (
    <FinanceShell
      title="Vendors"
      description="Supplier master with TPN for GST input credit. Pick vendors when posting expenses."
    >
      <VendorForm />
      <VendorTable vendors={rows} />
    </FinanceShell>
  );
}
