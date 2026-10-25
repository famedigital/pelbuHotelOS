"use client";

import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { ReceiptShareActions } from "@/components/erp/ReceiptShareActions";
import {
  PosPaidReceipt,
  type PosPaidReceiptData,
  type PosPaidReceiptProperty,
} from "@/components/erp/pos/PosPaidReceipt";
import { OpenStayFolioLink } from "@/components/erp/OpenStayFolioLink";
import { Button } from "@/components/ui/button";
import { orderRef } from "@/lib/order-ref";
import {
  buildPosReceiptMessage,
  buildPosReceiptWaLinkMessage,
} from "@/lib/pos-receipt-message";
import type { DocumentPaperSize } from "@/lib/property-settings";
import { useMemo, useState } from "react";

export function PosReceiptStage({
  order,
  property,
  initialPaper,
  darken,
  shareUrl,
}: {
  order: PosPaidReceiptData;
  property: PosPaidReceiptProperty;
  initialPaper: DocumentPaperSize;
  darken: number;
  /** Signed public guest URL for WhatsApp / copy link. */
  shareUrl?: string | null;
}) {
  const [paper, setPaper] = useState<DocumentPaperSize>(initialPaper);
  const unpaid = !order.settledAt;

  const shareText = useMemo(() => {
    if (shareUrl) {
      return buildPosReceiptWaLinkMessage({
        propertyName: property.name,
        orderId: order.orderId,
        customerName: order.customerName,
        totalBtn: order.totalBtn,
        unpaid,
        shareUrl,
      });
    }
    return buildPosReceiptMessage({
      propertyName: property.name,
      orderId: order.orderId,
      customerName: order.customerName,
      outlet: order.outlet,
      createdAt: order.createdAt,
      settledAt: order.settledAt,
      subtotalBtn: order.subtotalBtn,
      serviceChargeBtn: order.serviceChargeBtn,
      gstBtn: order.gstBtn,
      totalBtn: order.totalBtn,
      lines: order.lines,
      tenders: order.tenders,
      unpaid,
    });
  }, [order, property.name, unpaid, shareUrl]);

  return (
    <div
      className={`erp mx-auto w-full space-y-5 p-4 md:p-6 print:max-w-none print:p-0 ${
        paper === "a4" ? "max-w-[210mm]" : "max-w-[520px]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {unpaid ? "Guest receipt · unpaid" : "Guest receipt"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {orderRef(order.orderId)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unpaid
              ? "Share or print this copy — settle on POS when the guest pays."
              : paper === "a4"
                ? "A4 letterhead · give this copy to the guest"
                : "Thermal slip · give this copy to the guest"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10">
            <a href="/erp/pos">Back to POS</a>
          </Button>
          {unpaid ? (
            <Button asChild variant="default" className="h-10">
              <a href="/erp/pos">Settle on POS</a>
            </Button>
          ) : null}
          {order.folioId || order.bookingId ? (
            <OpenStayFolioLink
              bookingId={order.bookingId}
              folioId={order.folioId}
              className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              Open stay
            </OpenStayFolioLink>
          ) : null}
          <DocPrintControls
            defaultSize={initialPaper}
            allowThermal
            printLabel="Print receipt"
            onSizeChange={setPaper}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => window.print()}
          >
            Save PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 print:hidden md:grid-cols-2 md:items-stretch">
        <ReceiptShareActions
          messageText={shareText}
          defaultPhone={order.phone}
          defaultName={order.customerName}
          orderId={order.orderId}
          title="WhatsApp & email"
          shareUrl={shareUrl}
        />
        <div className="flex h-full flex-col rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Tips
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>
              WhatsApp sends a preview link — guest opens it to view, print, or
              save PDF.
            </li>
            <li>
              On this page use <span className="font-medium text-foreground">Save PDF</span>{" "}
              (print dialog → Save as PDF).
            </li>
            <li>Email needs RESEND configured on the server.</li>
            <li>Print / Save PDF uses the preview below.</li>
          </ul>
        </div>
      </div>

      <PosPaidReceipt
        order={order}
        paper={paper}
        property={property}
        darken={darken}
      />
    </div>
  );
}
