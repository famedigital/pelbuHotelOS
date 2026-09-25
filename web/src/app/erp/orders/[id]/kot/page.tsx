import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { AutoPrintOnLoad } from "@/components/erp/pos/AutoPrintOnLoad";
import {
  PosKotSlip,
  type PosKotSlipData,
} from "@/components/erp/pos/PosKotSlip";
import { Button } from "@/components/ui/button";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { orderRef } from "@/lib/order-ref";
import { normalizePartyName } from "@/lib/pos-training";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Kitchen KOT",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; paper?: string }>;
};

/**
 * Kitchen Order Ticket print page. `?print=1` opens the browser print dialog
 * after persist (fire/send) — never before.
 */
export default async function OrderKotPage({ params, searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const sp = await searchParams;
  const autoPrint = sp.print === "1" || sp.print === "true";

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: order } = await admin
    .from("orders")
    .select(
      `id, property_id, outlet, customer_name, notes, created_at, voided_at,
       table_id, covers, course_count,
       order_items(name_snapshot, qty, line_notes, voided_at, course_no, seat_no,
         menu_items(prep_station)),
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

  const property = await loadProperty(admin, propertyId);
  if (!property) notFound();

  const paperParam = (sp.paper ?? "").toLowerCase();
  const paper: DocumentPaperSize =
    paperParam === "a4" || paperParam === "thermal" ? paperParam : "thermal";

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
          line_notes: string | null;
          voided_at: string | null;
          course_no: number | null;
          seat_no: number | null;
          menu_items:
            | { prep_station: string | null }
            | { prep_station: string | null }[]
            | null;
        }[]
      | null) ?? []
  )
    .filter((line) => !line.voided_at)
    .map((line) => {
      const mi = line.menu_items;
      const station = Array.isArray(mi)
        ? (mi[0]?.prep_station ?? null)
        : (mi?.prep_station ?? null);
      return {
        name: line.name_snapshot,
        qty: Number(line.qty),
        notes: line.line_notes ?? null,
        prepStation: station,
        courseNo: line.course_no == null ? null : Number(line.course_no),
        seatNo: line.seat_no == null ? null : Number(line.seat_no),
      };
    });

  const data: PosKotSlipData = {
    orderId: order.id as string,
    outlet: (order.outlet as string) ?? "outlet",
    customerName: normalizePartyName(order.customer_name as string | null),
    tableName,
    covers: order.covers == null ? null : Number(order.covers),
    courseCount:
      order.course_count == null ? null : Number(order.course_count),
    createdAt: order.created_at as string,
    notes: (order.notes as string | null) ?? null,
    lines,
  };

  return (
    <div className="erp mx-auto w-full max-w-[420px] space-y-5 p-4 md:p-6 print:max-w-none print:p-0">
      {autoPrint ? <AutoPrintOnLoad paper={paper} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Kitchen ticket
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {orderRef(data.orderId)}
          </h1>
          {order.voided_at ? (
            <p className="mt-1 text-sm font-medium text-destructive">
              Order voided — reprint for audit only
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Give to kitchen / keep for pass
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10">
            <Link href="/erp/pos">Back to POS</Link>
          </Button>
          <DocPrintControls defaultSize={paper} printLabel="Print KOT" />
        </div>
      </div>

      <PosKotSlip
        order={data}
        propertyName={property.name}
        timezone={property.timezone}
      />
    </div>
  );
}
