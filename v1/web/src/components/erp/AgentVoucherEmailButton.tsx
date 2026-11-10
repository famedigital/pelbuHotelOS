"use client";

import {
  sendAgentVoucher,
  type VoucherEmailState,
} from "@/app/actions/agent-voucher";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";

const initialState: VoucherEmailState = { ok: false };

export function AgentVoucherEmailButton({
  bookingId,
}: {
  bookingId: string;
}) {
  const [state, action, pending] = useActionState(
    sendAgentVoucher,
    initialState,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Email agent voucher"}
      </Button>
      {state.message ? (
        <p role="status" className="text-xs text-emerald-700">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
