import { confirmPublicOrderAction } from "@/app/actions/erp-pos";
import {
  OnlineOrderSlip,
  type OrderSlipData,
} from "@/components/erp/OnlineOrderSlip";
import { PrintButton } from "@/components/erp/PrintButton";
import { RecordOrderPaymentForm } from "@/components/erp/RecordOrderPaymentForm";
import { Button } from "@/components/ui/button";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { orderRef } from "@/lib/order-ref";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Order confirmation | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Screenshot surface for an online order. Desk confirms, photographs this
 * slip, sends it to the guest on their own WhatsApp, and records the transfer
 * journal number here when the guest pays — which fires the KOT.
 */
export default async function OrderSlipPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, property_id, outlet, customer_name, phone, delivery_type, delivery_area, delivery_address, notes, subtotal_btn, gst_btn, service_charge_btn, total_btn, created_at, voided_at, order_source, confirmed_at, confirmed_by, payment_journal_no, payment_method, payment_recorded_at, order_items(name_snapshot, qty, unit_price_btn, line_notes, voided_at)",
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

  let confirmedByName: string | null = null;
  if (order.confirmed_by) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("full_name")
      .eq("id", order.confirmed_by as string)
      .maybeSingle();
    confirmedByName = (staff?.full_name as string | null) ?? null;
  }

  const rawLines =
    ((order.order_items as
      | {
          name_snapshot: string;
          qty: number;
          unit_price_btn: number;
          line_notes: string | null;
          voided_at: string | null;
        }[]
      | null) ?? []).filter((line) => !line.voided_at);

  const data: OrderSlipData = {
    orderId: order.id as string,
    outlet: order.outlet as string,
    createdAt: order.created_at as string,
    customerName: order.customer_name as string,
    phone: order.phone as string,
    deliveryType: (order.delivery_type as string) ?? "pickup",
    deliveryArea: (order.delivery_area as string | null) ?? null,
    deliveryAddress: (order.delivery_address as string | null) ?? null,
    notes: (order.notes as string | null) ?? null,
    subtotalBtn: Number(order.subtotal_btn ?? 0),
    gstBtn: Number(order.gst_btn ?? 0),
    serviceChargeBtn: Number(order.service_charge_btn ?? 0),
    totalBtn: Number(order.total_btn ?? 0),
    confirmedAt: (order.confirmed_at as string | null) ?? null,
    confirmedByName,
    paymentJournalNo: (order.payment_journal_no as string | null) ?? null,
    paymentMethod: (order.payment_method as string | null) ?? null,
    paymentRecordedAt: (order.payment_recorded_at as string | null) ?? null,
    lines: rawLines.map((line) => ({
      name: line.name_snapshot,
      qty: Number(line.qty),
      unitPriceBtn: Number(line.unit_price_btn),
      notes: line.line_notes ?? null,
    })),
  };

  const isOnline = (order.order_source as string) === "public";
  const voided = Boolean(order.voided_at);
  const confirmed = Boolean(data.confirmedAt);
  const paid = Boolean(data.paymentRecordedAt);

  return (
    <div className="erp mx-auto w-full max-w-[720px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Online order
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {orderRef(data.orderId)}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/erp/pos"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
          >
            Back to POS
          </a>
          <PrintButton label="Print slip" />
        </div>
      </div>

      {voided ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive print:hidden">
          This order was cancelled.
        </p>
      ) : null}

      <OnlineOrderSlip
        order={data}
        property={{
          name: property.name,
          address: property.address,
          phone: property.phone,
          timezone: property.timezone,
          bankAccounts: property.bank_accounts,
        }}
      />

      {isOnline && !voided ? (
        <section className="rounded-2xl border border-border bg-card p-4 print:hidden">
          {!confirmed ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Step 1 · Confirm the order
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirming stamps your name on the slip. Screenshot it, send it
                  to the guest on WhatsApp, and ask for the transfer.
                </p>
              </div>
              <form action={confirmPublicOrderAction}>
                <input type="hidden" name="order_id" value={data.orderId} />
                <Button type="submit" variant="citrus" className="h-10">
                  Confirm order
                </Button>
              </form>
            </div>
          ) : !paid ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Step 2 · Record the guest&apos;s payment
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the journal number the guest sent back on WhatsApp. The
                  kitchen only sees this ticket once payment is recorded.
                </p>
              </div>
              <RecordOrderPaymentForm orderId={data.orderId} />
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Sent to kitchen
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Journal {data.paymentJournalNo} recorded. The ticket is live on
                the kitchen display.
              </p>
              <a
                href="/erp/kds"
                className="mt-3 inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
              >
                Open kitchen display
              </a>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
