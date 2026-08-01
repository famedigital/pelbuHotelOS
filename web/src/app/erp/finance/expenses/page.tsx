import { ExpenseWorkbench } from "@/components/erp/finance/ExpenseWorkbench";
import {
  ExportButtons,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import type { ExpenseGridRow } from "@/lib/finance-import/types";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Expenses | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FinanceExpensesPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const from = monthStart();
  const to = new Date().toISOString().slice(0, 10);

  const [{ data: expenses }, { data: attachments }, { data: vendors }] = await Promise.all([
    admin
      .from("expenses")
      .select(
        "id, category, description, amount_btn, gst_btn, expense_date, vendor, vendor_id, payment_method, reference, status, journal_id, notes, tpn, bill_no, gross_btn",
      )
      .eq("property_id", propertyId)
      .order("expense_date", { ascending: false })
      .limit(500),
    admin
      .from("expense_attachments")
      .select("expense_id, storage_path, sort_order")
      .eq("property_id", propertyId)
      .order("sort_order")
      .limit(1000),
    admin
      .from("accounting_vendors")
      .select("id, name, tax_id")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("name")
      .limit(200),
  ]);

  const vendorRows = (vendors ?? []).map((v) => ({
    id: v.id as string,
    name: v.name as string,
    tpn: (v.tax_id as string | null) ?? null,
  }));

  const firstAttachment = new Map<string, string>();
  for (const a of attachments ?? []) {
    const eid = a.expense_id as string | null;
    if (eid && !firstAttachment.has(eid)) {
      firstAttachment.set(eid, a.storage_path as string);
    }
  }

  const rows: ExpenseGridRow[] = (expenses ?? []).map((e) => {
    const amount = Number(e.amount_btn);
    const gst = Number(e.gst_btn ?? 0);
    return {
      id: e.id as string,
      expense_date: String(e.expense_date),
      bill_no: (e.bill_no as string | null) ?? (e.reference as string | null) ?? "",
      vendor: (e.vendor as string | null) ?? "",
      vendor_id: (e.vendor_id as string | null) ?? null,
      tpn: (e.tpn as string | null) ?? "",
      description: e.description as string,
      category: e.category as string,
      payment_method: (e.payment_method as string) ?? "bank",
      amount_btn: amount,
      gst_btn: gst,
      net_btn: Math.max(0, amount - gst),
      status: (e.status as string) ?? "posted",
      journal_id: (e.journal_id as string | null) ?? null,
      notes: (e.notes as string | null) ?? "",
      reference: (e.reference as string | null) ?? "",
      receipt_path: firstAttachment.get(e.id as string) ?? null,
    };
  });

  return (
    <FinanceShell
      title="Expenses workbench"
      description="Spreadsheet-style expense register with receipt camera/upload and PDF extraction review."
      actions={<ExportButtons report="expenses" from={from} to={to} />}
    >
      <ExpenseWorkbench
        initialRows={rows}
        propertyId={propertyId}
        vendors={vendorRows}
      />
    </FinanceShell>
  );
}
