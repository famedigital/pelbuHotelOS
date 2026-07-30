"use client";

import { postFolioPayment, type PaymentState } from "@/app/actions/erp-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TriangleAlertIcon } from "lucide-react";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: PaymentState = { ok: false };

export function FolioPaymentForm({
  folioId,
  suggestedAmount,
}: {
  folioId: string;
  suggestedAmount: number;
}) {
  const [state, action, pending] = useActionState(postFolioPayment, initial);

  if (state.ok) {
    return (
      <div
        className="erp rounded-lg border bg-card p-5"
        role="status"
        aria-live="polite"
      >
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Recorded
        </p>
        <p className="mt-2 text-sm text-foreground">
          Payment posted to this folio. Refresh in a moment to see the new balance.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="erp space-y-5 rounded-lg border bg-card p-6"
    >
      {state.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="folio_id" value={folioId} />

      <div className="flex items-baseline justify-between gap-3 border-b pb-3">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Record payment
        </p>
        {suggestedAmount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Balance{" "}
            <span className="font-medium text-foreground">
              {formatBtn(suggestedAmount)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="method">Method</Label>
          <select
            id="method"
            name="method"
            defaultValue="cash"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="bank_qr">Bank QR</option>
            <option value="pay_bt">Pay.bt</option>
            <option value="card">Card</option>
            <option value="deposit">Deposit</option>
            <option value="agent_credit">Agent credit</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount_btn">Amount (Nu)</Label>
          <Input
            id="amount_btn"
            type="number"
            name="amount_btn"
            required
            min={0.01}
            step="0.01"
            inputMode="decimal"
            defaultValue={suggestedAmount > 0 ? suggestedAmount : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            type="text"
            name="reference"
            placeholder="Txn / slip no"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>
      </div>

      <Button
        type="submit"
        variant="citrus"
        disabled={pending}
        className="h-11 w-full"
      >
        {pending ? "Saving…" : "Post payment"}
      </Button>
    </form>
  );
}
