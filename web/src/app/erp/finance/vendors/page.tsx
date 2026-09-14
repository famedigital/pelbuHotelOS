import {
  VendorBillForm,
  VendorBillsTable,
  VendorForm,
  VendorTable,
  type BillRow,
  type VendorRow,
} from "@/components/erp/finance/VendorForms";
import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Vendors & bills | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FinanceVendorsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [{ data: vendors }, { data: bills }] = await Promise.all([
    admin
      .from("accounting_vendors")
      .select("id, name, tax_id, phone, email, is_active")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("name")
      .limit(200),
    admin
      .from("accounting_bills")
      .select(
        "id, bill_no, bill_date, description, total_btn, status, vendor_id, accounting_vendors(name)",
      )
      .eq("property_id", propertyId)
      .order("bill_date", { ascending: false })
      .limit(100),
  ]);

  const rows: VendorRow[] = (vendors ?? []).map((v) => ({
    id: v.id as string,
    name: v.name as string,
    tax_id: (v.tax_id as string | null) ?? null,
    phone: (v.phone as string | null) ?? null,
    email: (v.email as string | null) ?? null,
    is_active: Boolean(v.is_active),
  }));

  const billRows: BillRow[] = (bills ?? []).map((b) => {
    const vendor = b.accounting_vendors as { name?: string } | null;
    return {
      id: b.id as string,
      bill_no: (b.bill_no as string | null) ?? null,
      bill_date: String(b.bill_date),
      description: b.description as string,
      total_btn: Number(b.total_btn),
      status: b.status as string,
      vendor_name: vendor?.name ?? null,
    };
  });

  return (
    <FinanceShell
      title="Vendors & bills"
      description="Supplier directory with TPN, and AP bills (owe now, pay from hotel bank later)."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <VendorForm />
        <VendorBillForm vendors={rows} />
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Open & recent bills</h2>
        <VendorBillsTable bills={billRows} />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Vendor directory</h2>
        <VendorTable vendors={rows} />
      </section>
    </FinanceShell>
  );
}
