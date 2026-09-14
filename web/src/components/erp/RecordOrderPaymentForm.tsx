"use client";

import {
  recordOnlineOrderPayment,
  type ConfirmOrderState,
} from "@/app/actions/erp-pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: ConfirmOrderState = { ok: false };

const METHODS = [
  { value: "mbob", label: "mBoB" },
  { value: "bnb_mpay", label: "BNB mPay" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const;

/**
 * The guest WhatsApps the transfer journal number to the desk; recording it
 * here is what releases the ticket to the kitchen display.
 */
export function RecordOrderPaymentForm({
  orderId,
  compact = false,
}: {
  orderId: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    recordOnlineOrderPayment,
    initial,
  );

  useActionToast(state, { successMessage: "Payment recorded — sent to kitchen" });

  return (
    <form
      action={action}
      className={compact ? "space-y-2" : "space-y-3"}
      aria-busy={pending}
    >
      <input type="hidden" name="order_id" value={orderId} />

      <div className={compact ? "flex flex-wrap gap-2" : "grid gap-3 sm:grid-cols-2"}>
        <div className={compact ? "min-w-[9rem] flex-1" : "space-y-1.5"}>
          {compact ? null : (
            <Label htmlFor={`journal-${orderId}`}>Payment journal number</Label>
          )}
          <Input
            id={`journal-${orderId}`}
            name="payment_journal_no"
            required
            minLength={4}
            maxLength={64}
            inputMode="text"
            autoComplete="off"
            placeholder="Journal no."
            aria-label="Payment journal number"
            className={compact ? "h-9" : undefined}
          />
        </div>
        <div className={compact ? "w-32" : "space-y-1.5"}>
          {compact ? null : <Label htmlFor={`method-${orderId}`}>Paid via</Label>}
          <select
            id={`method-${orderId}`}
            name="payment_method"
            defaultValue="mbob"
            aria-label="Payment method"
            className={`w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              compact ? "h-9" : "h-10"
            }`}
          >
            {METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="citrus"
        disabled={pending}
        className={compact ? "h-9 w-full" : "h-10"}
      >
        {pending ? "Recording…" : "Record payment · send to kitchen"}
      </Button>
    </form>
  );
}
