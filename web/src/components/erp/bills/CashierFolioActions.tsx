"use client";

import { issueFolioInvoice } from "@/app/actions/erp-folio-ops";
import { Button } from "@/components/ui/button";
import { BILL_KIND_LABELS, type BillKind } from "@/lib/folio/bill-kinds";
import { stayFolioHref } from "@/lib/folio/stay-hub-cycle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

function billPrintHref(folioId: string, bill: BillKind): string {
  return `/erp/folios/${folioId}/bill?bill=${bill}`;
}

export function CashierFolioActions({
  folioId,
  bookingId,
  invoiceId,
}: {
  folioId: string;
  bookingId: string | null;
  invoiceId: string | null;
}) {
  const href = stayFolioHref(bookingId, folioId);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function issue() {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("folio_id", folioId);
      const result = await issueFolioInvoice({ ok: false }, formData);
      if (!result.ok) {
        toast.error(result.error ?? "Could not issue the invoice.");
        return;
      }
      toast.success(result.message ?? "Invoice issued.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Button asChild size="sm" variant="outline" className="h-8">
        <Link href={href}>Open</Link>
      </Button>
      <Button asChild size="sm" className="h-8">
        <Link href={href}>Collect</Link>
      </Button>
      {(["room", "master", "fnb"] as const).map((bill) => (
        <Button key={bill} asChild size="sm" variant="outline" className="h-8">
          <Link href={billPrintHref(folioId, bill)} target="_blank">
            {BILL_KIND_LABELS[bill]}
          </Link>
        </Button>
      ))}
      {invoiceId ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={busy}
          onClick={() => void issue()}
        >
          Issue invoice
        </Button>
      )}
    </div>
  );
}
