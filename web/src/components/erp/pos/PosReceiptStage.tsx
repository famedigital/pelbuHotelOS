"use client";

import { DocPrintControls } from "@/components/erp/DocPrintControls";
import {
  PosPaidReceipt,
  type PosPaidReceiptData,
  type PosPaidReceiptProperty,
} from "@/components/erp/pos/PosPaidReceipt";
import { Button } from "@/components/ui/button";
import { orderRef } from "@/lib/order-ref";
import type { DocumentPaperSize } from "@/lib/property-settings";
import Link from "next/link";
import { useState } from "react";

export function PosReceiptStage({
  order,
  property,
  initialPaper,
  darken,
}: {
  order: PosPaidReceiptData;
  property: PosPaidReceiptProperty;
  initialPaper: DocumentPaperSize;
  darken: number;
}) {
  const [paper, setPaper] = useState<DocumentPaperSize>(initialPaper);

  return (
    <div
      className={`erp mx-auto w-full space-y-5 p-4 md:p-6 print:max-w-none print:p-0 ${
        paper === "a4" ? "max-w-[210mm]" : "max-w-[520px]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Guest receipt
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {orderRef(order.orderId)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {paper === "a4"
              ? "A4 letterhead · give this copy to the guest"
              : "Thermal slip · give this copy to the guest"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10">
            <Link href="/erp/pos">Back to POS</Link>
          </Button>
          {order.folioId ? (
            <Button asChild variant="outline" className="h-10">
              <Link href={`/erp/folios/${order.folioId}`}>Open folio</Link>
            </Button>
          ) : null}
          <DocPrintControls
            defaultSize={initialPaper}
            printLabel="Print receipt"
            onSizeChange={setPaper}
          />
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
