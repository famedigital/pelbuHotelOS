"use client";

import {
  sendConfirmationPack,
  type ConfirmationPackState,
} from "@/app/actions/agent-voucher";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";

const initialState: ConfirmationPackState = { ok: false };

/** Email voucher (no rates) + proforma (with rates) in one pack. */
export function ConfirmationPackSendButton({
  bookingId,
  className,
}: {
  bookingId: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState(
    sendConfirmationPack,
    initialState,
  );

  return (
    <form action={action} className={className ?? "space-y-2"}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <Button
        type="submit"
        variant="citrus"
        className="h-11 w-full"
        disabled={pending}
      >
        {pending ? "Sending pack…" : "Send pack (email)"}
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
