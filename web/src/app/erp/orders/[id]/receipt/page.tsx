import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { AutoPrintOnLoad } from "@/components/erp/pos/AutoPrintOnLoad";
import {
  PosPaidReceipt,
  type PosPaidReceiptData,
} from "@/components/erp/pos/PosPaidReceipt";
import { Button } from "@/components/ui/button";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { orderRef } from "@/lib/order-ref";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "POS receipt | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; paper?: string }>;
};

/**
 * Guest paid receipt after POS settle. Optional `?print=1` opens the browser
 * print dialog for a thermal / A4 copy for the customer.
 */
export default async function OrderPaidReceiptPage({
  params,
  searchParams,
}: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const sp = await searchParams;
  const autoPrint = sp.print === "1" || sp.print === "true";

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: order } = await admin
    .from("orders")
    .select(
      `id, property_id, outlet, customer_name, phone, notes, subtotal_btn, service_charge_btn, gst_btn, total_btn,
       created_at, settled_at, voided_at, folio_id, table_id, covers,
       order_items(name_snapshot, qty, unit_price_btn, line_notes, voided_at),
       order_tenders(method, amount_btn, reference),
       dining_tables(name)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  try {
    assertDeskProperty(propertyId, order.property_id as string, "Order");
  } catch {
    notFound();
  }

  if (order.voided_at) {
    redirect(`/erp/orders/${id}/slip`);
  }
  if (!order.settled_at) {
    // Not paid yet — send cashier to open slip / tickets flow.
    redirect(`/erp/pos`);
  }

  const property = await loadProperty(admin, propertyId);
  if (!property) notFound();

  const paperParam = (sp.paper ?? "").toLowerCase();
  const designPaper = property.doc_receipt.paper_size;
  const paper: DocumentPaperSize =
    paperParam === "a4" || paperParam === "thermal"
      ? paperParam
      : designPaper === "a4"
        ? "a4"
        : "thermal";

  const tableJoin = order.dining_tables as
    | { name?: string }
    | { name?: string }[]
    | null;
  const tableName = Array.isArray(tableJoin)
    ? (tableJoin[0]?.name ?? null)
    : (tableJoin?.name ?? null);

  const lines = (
    (order.order_items as
      | {
          name_snapshot: string;
          qty: number;
          unit_price_btn: number;
          line_notes: string | null;
          voided_at: string | null;
        }[]
      | null) ?? []
  )
    .filter((line) => !line.voided_at)
    .map((line) => {
      const qty = Number(line.qty);
      const unit = Number(line.unit_price_btn);
      return {
        name: line.name_snapshot,
        qty,
        unitPriceBtn: unit,
        lineTotalBtn: Math.round(qty * unit * 100) / 100,
        notes: line.line_notes ?? null,
      };
    });

  const tenders = (
    (order.order_tenders as
      | { method: string; amount_btn: number; reference: string | null }[]
      | null) ?? []
  ).map((t) => ({
    method: t.method,
    amountBtn: Number(t.amount_btn),
    reference: t.reference ?? null,
  }));

  const data: PosPaidReceiptData = {
    orderId: order.id as string,
    outlet: (order.outlet as string) ?? "outlet",
    customerName: (order.customer_name as string) || "Guest",
    phone: (order.phone as string | null) ?? null,
    tableName,
    covers: order.covers == null ? null : Number(order.covers),
    createdAt: order.created_at as string,
    settledAt: order.settled_at as string,
    subtotalBtn: Number(order.subtotal_btn ?? 0),
    serviceChargeBtn: Number(order.service_charge_btn ?? 0),
    gstBtn: Number(order.gst_btn ?? 0),
    totalBtn: Number(order.total_btn ?? 0),
    notes: (order.notes as string | null) ?? null,
    lines,
    tenders,
    folioId: (order.folio_id as string | null) ?? null,
  };

  return (
    <div className="erp mx-auto w-full max-w-[520px] space-y-5 p-4 md:p-6 print:max-w-none print:p-0">
      {autoPrint ? <AutoPrintOnLoad paper={paper} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Guest receipt
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {orderRef(data.orderId)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paid · give this copy to the guest
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10">
            <Link href="/erp/pos">Back to POS</Link>
          </Button>
          {data.folioId ? (
            <Button asChild variant="outline" className="h-10">
              <Link href={`/erp/folios/${data.folioId}`}>Open folio</Link>
            </Button>
          ) : null}
          <DocPrintControls
            defaultSize={paper}
            printLabel="Print receipt"
          />
        </div>
      </div>

      <PosPaidReceipt
        order={data}
        property={{
          name: property.name,
          address: property.address,
          phone: property.phone,
          timezone: property.timezone,
          gstNumber: property.tax_id ?? null,
        }}
      />
    </div>
  );
}
