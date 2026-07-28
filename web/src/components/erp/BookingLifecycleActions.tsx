"use client";

import {
  cancelBooking,
  markBookingNoShow,
  type ErpChannelState,
} from "@/app/actions/erp-channel";
import { useActionState } from "react";

const initial: ErpChannelState = { ok: false };

export function BookingLifecycleActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const canCancel = ["pending", "confirmed", "checked_in"].includes(status);
  const canNoShow = ["pending", "confirmed"].includes(status);
  if (!canCancel && !canNoShow) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {canCancel ? <CancelForm bookingId={bookingId} /> : null}
      {canNoShow ? <NoShowForm bookingId={bookingId} /> : null}
    </div>
  );
}

function CancelForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(cancelBooking, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input
        name="cancel_reason"
        placeholder="Cancel reason"
        className="min-h-9 rounded-sm border border-espresso/20 px-2 text-xs text-espresso outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center text-xs font-medium text-maroon underline-offset-4 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "Cancel"}
      </button>
      {state.error ? (
        <span className="text-xs text-maroon">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="text-xs text-muted">{state.message}</span>
      ) : null}
    </form>
  );
}

function NoShowForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(markBookingNoShow, initial);
  return (
    <form action={action}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center text-xs text-muted underline-offset-4 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "No-show"}
      </button>
      {state.error ? (
        <span className="ml-2 text-xs text-maroon">{state.error}</span>
      ) : null}
    </form>
  );
}
