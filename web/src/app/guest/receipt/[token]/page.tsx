import { GuestReceiptActions } from "@/components/erp/pos/GuestReceiptActions";
import {
  PosPaidReceipt,
  type PosPaidReceiptData,
} from "@/components/erp/pos/PosPaidReceipt";
import { shareSocialMeta } from "@/lib/og-share";
import { orderRef } from "@/lib/order-ref";
import { formatBtn } from "@/lib/pricing";
import { loadPosOrderReceiptData } from "@/lib/pos-receipt-load";
import { parsePosReceiptShareToken } from "@/lib/pos-receipt-share-token";
import { loadProperty } from "@/lib/property-context";
import { absoluteUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

async function loadGuestReceipt(tokenRaw: string) {
  const token = decodeURIComponent(tokenRaw);
  const session = parsePosReceiptShareToken(token);
  if (!session) return null;

  const admin = createSupabaseAdminClient();
  const pack = await loadPosOrderReceiptData(admin, session.orderId);
  if (!pack || pack.propertyId !== session.propertyId) return null;

  const property = await loadProperty(admin, pack.propertyId);
  if (!property) return null;

  return { order: pack.order, property, token };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const pack = await loadGuestReceipt(token);
  if (!pack) {
    return {
      title: "Receipt",
      robots: { index: false, follow: false },
    };
  }

  const ref = orderRef(pack.order.orderId);
  const hotel = pack.property.name;
  const title = `${hotel} · Receipt ${ref}`;
  const description = pack.order.settledAt
    ? `Your receipt from ${hotel} — ${ref} · ${formatBtn(pack.order.totalBtn)}. Open to print or save as PDF.`
    : `Order ${ref} from ${hotel} · ${formatBtn(pack.order.totalBtn)}. Open to print or save as PDF.`;
  const path = `/guest/receipt/${encodeURIComponent(decodeURIComponent(token))}`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    ...shareSocialMeta({
      title,
      description,
      path: absoluteUrl(path),
      publicId: pack.property.logo_public_id,
      alt: hotel,
    }),
  };
}

export default async function GuestReceiptPage({ params }: Props) {
  const { token } = await params;
  const pack = await loadGuestReceipt(token);
  if (!pack) notFound();

  const { order, property } = pack;
  const unpaid = !order.settledAt;
  const ref = orderRef(order.orderId);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[210mm] space-y-5 bg-background p-4 text-foreground md:p-6 print:max-w-none print:p-0">
      <header className="space-y-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {unpaid ? "Guest receipt · unpaid" : "Guest receipt"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {property.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ref}
            {order.customerName ? ` · ${order.customerName}` : ""} ·{" "}
            {formatBtn(order.totalBtn)}
          </p>
        </div>
        <GuestReceiptActions />
      </header>

      <PosPaidReceipt
        order={order as PosPaidReceiptData}
        paper="a4"
        property={{
          name: property.name,
          legalName: property.legal_name,
          address: property.address,
          phone: property.phone,
          email: property.email,
          timezone: property.timezone,
          gstNumber: property.tax_id ?? null,
          logoPublicId: property.logo_public_id,
        }}
        darken={0}
      />
    </div>
  );
}
