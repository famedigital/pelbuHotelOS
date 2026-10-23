"use client";

import { recordStayCollection } from "@/app/actions/erp-collect";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function CollectPaymentButton({
  folioId,
  bookingId,
  due,
}: {
  folioId: string;
  bookingId: string;
  due: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(due)));
  const [method, setMethod] = useState("bank");

  async function save() {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("folio_id", folioId);
      formData.set("booking_id", bookingId);
      formData.set("amount_btn", amount);
      formData.set("method", method);
      const result = await recordStayCollection({ ok: false }, formData);
      if (!result.ok) {
        toast.error(result.error ?? "Could not record the payment.");
        return;
      }
      toast.success("Payment recorded.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" className="h-8" onClick={() => setOpen(true)}>
        Record payment
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="decimal"
        aria-label="Amount received"
        className="h-8 w-24 rounded-md border bg-background px-2 text-sm tabular-nums"
      />
      <select
        value={method}
        onChange={(event) => setMethod(event.target.value)}
        aria-label="How they paid"
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        <option value="bank">Bank</option>
        <option value="cash">Cash</option>
        <option value="bank_qr">QR</option>
        <option value="card">Card</option>
      </select>
      <Button type="button" size="sm" className="h-8" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
