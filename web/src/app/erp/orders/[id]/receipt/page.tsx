import { AutoPrintOnLoad } from "@/components/erp/pos/AutoPrintOnLoad";
import { PosReceiptStage } from "@/components/erp/pos/PosReceiptStage";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { clampPrintDarken } from "@/lib/pos-print-prefs";
import { loadPosOrderReceiptData } from "@/lib/pos-receipt-load";
import {
  createPosReceiptShareToken,
  posReceiptSharePath,
} from "@/lib/pos-receipt-share-token";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { absoluteUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "POS receipt",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; paper?: string; darken?: string }>;
};

/**
 * Guest receipt for a POS ticket. Settled tickets are the paid copy;
 * unsettled non-voided tickets can still be printed or shared (WhatsApp / email).
 * Optional `?print=1` opens the browser print dialog.
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

  const pack = await loadPosOrderReceiptData(admin, id);
  if (!pack) notFound();

  try {
    assertDeskProperty(propertyId, pack.propertyId, "Order");
  } catch {
    notFound();
  }

  const property = await loadProperty(admin, propertyId);
  if (!property) notFound();

  const darken = clampPrintDarken(sp.darken);
  const paperParam = (sp.paper ?? "").toLowerCase();
  const designPaper = property.doc_receipt.paper_size;
  const paper: DocumentPaperSize =
    paperParam === "a4" || paperParam === "thermal"
      ? paperParam
      : designPaper === "a4"
        ? "a4"
        : "thermal";

  let shareUrl: string | null = null;
  try {
    const token = createPosReceiptShareToken(pack.order.orderId, propertyId);
    shareUrl = absoluteUrl(posReceiptSharePath(token));
  } catch {
    shareUrl = null;
  }

  return (
    <>
      {autoPrint ? <AutoPrintOnLoad paper={paper} /> : null}
      <PosReceiptStage
        order={pack.order}
        initialPaper={paper}
        darken={darken}
        shareUrl={shareUrl}
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
      />
    </>
  );
}
