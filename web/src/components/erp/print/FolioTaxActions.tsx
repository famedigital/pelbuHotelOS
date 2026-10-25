"use client";

import { issueRoomTaxInvoiceAndReceipt } from "@/app/actions/erp-folio-ops";
import { formatGuestBtn } from "@/lib/pricing";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function FolioTaxActions({
  folioId,
  folioNo,
  masterTotal,
  receivedTotal,
  taxInvoiceNo,
  receiptNo,
  canIssue,
}: {
  folioId: string;
  folioNo: string;
  masterTotal: number;
  receivedTotal: number;
  taxInvoiceNo: string | null;
  receiptNo: string | null;
  canIssue: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const href = `/erp/folios/${folioId}/tax-invoice`;

  if (taxInvoiceNo && receiptNo) {
    return (
      <a
        href={href}
        className="inline-flex h-9 items-center rounded-md border border-foreground px-3 text-xs font-medium"
      >
        Print room tax invoice and receipt
      </a>
    );
  }

  if (!canIssue) {
    return (
      <p className="max-w-sm text-xs leading-snug text-muted-foreground">
        Folio {folioNo}. Received {formatGuestBtn(receivedTotal)} of{" "}
        {formatGuestBtn(masterTotal)}. The room tax invoice and receipt are
        generated together after the master bill is paid.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await issueRoomTaxInvoiceAndReceipt(folioId);
            if (!result.ok) {
              setError(result.error);
              toast.error(result.error);
              return;
            }
            toast.success(`Room tax invoice ${result.invoiceNo} and receipt ${result.receiptNo}`);
            window.location.href = result.href;
          });
        }}
      >
        {pending ? "Generating…" : "Generate room tax invoice and receipt"}
      </button>
      {error ? <p className="max-w-sm text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
