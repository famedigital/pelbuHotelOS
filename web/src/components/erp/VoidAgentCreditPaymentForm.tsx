"use client";

import { voidAgentCreditPayment } from "@/app/actions/erp-folio-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState, useEffect } from "react";

/**
 * Desk form to reverse agent_credit tender + ledger.
 * Wire from full folio charge history or money disputes.
 */
export function VoidAgentCreditPaymentForm({
  paymentId,
  amountLabel,
  onSuccess,
}: {
  paymentId: string;
  amountLabel?: string;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(voidAgentCreditPayment, {
    ok: false,
  });
  useActionToast(state, { successMessage: "Agent AR reversed" });
  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <form action={action} className="erp flex flex-wrap items-end gap-2">
      <input type="hidden" name="payment_id" value={paymentId} />
      <div className="min-w-[10rem] flex-1 space-y-1">
        <label className="text-[10px] text-muted-foreground">
          Void agent AR{amountLabel ? ` · ${amountLabel}` : ""}
        </label>
        <Input
          name="reason"
          required
          placeholder="Reason (dispute / wrong agent)"
          className="h-8 text-xs"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="h-8 text-xs text-destructive"
        disabled={pending}
      >
        {pending ? "Reversing…" : "Void AR"}
      </Button>
      {state.error ? (
        <p className="w-full text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
