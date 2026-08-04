"use client";

import {
  approveSalesClaim,
  rejectSalesClaim,
  type SalesClaimActionState,
} from "@/app/actions/erp-sales-claims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: SalesClaimActionState = { ok: false };

export function SalesClaimApproveForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(approveSalesClaim, initial);
  useActionToast(state, { successMessage: "Claim approved" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <Input
        name="note"
        placeholder="Note (optional)"
        className="h-9 w-36"
        disabled={pending}
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Approve"}
      </Button>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

export function SalesClaimRejectForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(rejectSalesClaim, initial);
  useActionToast(state, { successMessage: "Claim rejected" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <Input
        name="note"
        placeholder="Reason (optional)"
        className="h-9 w-36"
        disabled={pending}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Reject"}
      </Button>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
