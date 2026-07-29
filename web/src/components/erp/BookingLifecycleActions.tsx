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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState, useState } from "react";

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
  useActionToast(state, { successMessage: "Token confirmed" });
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <label className="text-xs text-muted-foreground">
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
      <label className="text-xs text-muted-foreground">
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
      <Button
        type="submit"
        size="sm"
        disabled={pending}
        className="bg-espresso text-ivory hover:bg-espresso/90"
      >
        {pending ? "Confirming…" : "Confirm token"}
      </Button>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" name="owner_override" value="1" />
        Owner override
      </label>
      {state.error ? (
        <span className="w-full text-xs text-maroon">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="w-full text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

function ExtendHoldForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    extendBookingHold,
    holdInitial,
  );
  useActionToast(state, { successMessage: "Hold extended" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input
        name="reason"
        placeholder="Extend reason"
        className="min-h-9 rounded-sm border border-espresso/20 px-2 text-xs text-espresso outline-none focus:border-gold"
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-xs font-medium text-espresso"
      >
        {pending ? "Extending…" : "Extend hold"}
      </Button>
      {state.error ? (
        <span className="text-xs text-maroon">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

function CancelForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(cancelBooking, channelInitial);
  useActionToast(state, { successMessage: "Booking cancelled" });
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9 text-xs font-medium text-maroon hover:bg-maroon/5 hover:text-maroon"
        >
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            This marks the booking cancelled and frees its held inventory. The
            action is irreversible — only proceed if the guest is genuinely not
            coming.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="booking_id" value={bookingId} />
          <div className="space-y-1.5">
            <Label htmlFor="cancel_reason" className="text-xs text-muted-foreground">
              Reason
            </Label>
            <Input
              id="cancel_reason"
              name="cancel_reason"
              placeholder="Why is this being cancelled?"
              className="text-sm"
            />
          </div>
          {state.error ? (
            <p className="text-xs text-maroon">{state.error}</p>
          ) : null}
          {state.ok ? (
            <p className="text-xs text-muted-foreground">{state.message}</p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Keep booking
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {pending ? "Cancelling…" : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoShowForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    markBookingNoShow,
    channelInitial,
  );
  useActionToast(state, { successMessage: "Marked as no-show" });
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9 text-xs font-medium text-muted-foreground"
        >
          No-show
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as no-show?</DialogTitle>
          <DialogDescription>
            The booking will be marked as a no-show and its inventory released.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="booking_id" value={bookingId} />
          {state.error ? (
            <p className="text-xs text-maroon">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Keep booking
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {pending ? "Marking…" : "Confirm no-show"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
