"use client";

import {
  cancelBooking,
  markBookingNoShow,
  type ErpChannelState,
} from "@/app/actions/erp-channel";
import {
  confirmBookingToken,
  extendBookingHold,
  type HoldActionState,
} from "@/app/actions/erp-holds";
import { useActionState } from "react";

const channelInitial: ErpChannelState = { ok: false };
const holdInitial: HoldActionState = { ok: false };

export function BookingLifecycleActions({
  bookingId,
  status,
  tokenRequired,
}: {
  bookingId: string;
  status: string;
  tokenRequired?: number;
}) {
  const canCancel = ["pending", "held", "confirmed", "checked_in"].includes(
    status,
  );
  const canNoShow = ["pending", "held", "confirmed"].includes(status);
  const canConfirmToken = ["held", "pending"].includes(status);
  const canExtend = status === "held";

  if (!canCancel && !canNoShow && !canConfirmToken) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {canConfirmToken ? (
        <ConfirmTokenForm
          bookingId={bookingId}
          tokenRequired={tokenRequired ?? 0}
        />
      ) : null}
      {canExtend ? <ExtendHoldForm bookingId={bookingId} /> : null}
      <div className="flex flex-wrap gap-3">
        {canCancel ? <CancelForm bookingId={bookingId} /> : null}
        {canNoShow ? <NoShowForm bookingId={bookingId} /> : null}
      </div>
    </div>
  );
}

function ConfirmTokenForm({
  bookingId,
  tokenRequired,
}: {
  bookingId: string;
  tokenRequired: number;
}) {
  const [state, action, pending] = useActionState(
    confirmBookingToken,
    holdInitial,
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <label className="text-xs text-muted">
        Token Nu
        <input
          name="amount_btn"
          type="number"
          min={0}
          step="1"
          defaultValue={tokenRequired > 0 ? String(tokenRequired) : ""}
          className="mt-0.5 block min-h-9 w-24 rounded-sm border border-espresso/20 px-2 text-xs text-espresso outline-none focus:border-gold"
        />
      </label>
      <label className="text-xs text-muted">
        Method
        <select
          name="method"
          defaultValue="bank"
          className="mt-0.5 block min-h-9 rounded-sm border border-espresso/20 px-2 text-xs text-espresso outline-none focus:border-gold"
        >
          <option value="bank">Bank</option>
          <option value="cash">Cash</option>
          <option value="bank_qr">QR</option>
          <option value="pay_bt">Pay.bt</option>
        </select>
      </label>
      <input
        name="reference"
        placeholder="Txn ref"
        className="min-h-9 rounded-sm border border-espresso/20 px-2 text-xs text-espresso outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center rounded-sm bg-espresso px-3 text-xs font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "…" : "Confirm token"}
      </button>
      <label className="flex items-center gap-1 text-xs text-muted">
        <input type="checkbox" name="owner_override" value="1" />
        Owner override
      </label>
      {state.error ? (
        <span className="w-full text-xs text-maroon">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="w-full text-xs text-muted">{state.message}</span>
      ) : null}
    </form>
  );
}

function ExtendHoldForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    extendBookingHold,
    holdInitial,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input
        name="reason"
        placeholder="Extend reason"
        className="min-h-9 rounded-sm border border-espresso/20 px-2 text-xs text-espresso outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center text-xs font-medium text-espresso underline-offset-4 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "Extend hold"}
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

function CancelForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(cancelBooking, channelInitial);
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
  const [state, action, pending] = useActionState(
    markBookingNoShow,
    channelInitial,
  );
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
