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
import { useActionState, useEffect, useRef, useState } from "react";

const channelInitial: ErpChannelState = { ok: false };
const holdInitial: HoldActionState = { ok: false };

const fieldXs =
  "min-h-9 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const selectXs =
  "min-h-9 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";

function useActionSuccess(state: { ok?: boolean }, onSuccess?: () => void) {
  const fired = useRef(false);
  useEffect(() => {
    if (!state.ok || fired.current) return;
    fired.current = true;
    onSuccess?.();
  }, [state.ok, onSuccess]);
}

function useOptimisticRollback(
  state: { ok?: boolean; error?: string },
  onRollback?: () => void,
) {
  const rolled = useRef(false);
  useEffect(() => {
    if (!state.error || state.ok || rolled.current) return;
    rolled.current = true;
    onRollback?.();
  }, [state.error, state.ok, onRollback]);
}

export function BookingLifecycleActions({
  bookingId,
  status,
  tokenRequired,
  cancelPolicySummary,
  isMouAgent,
  ratePendingApproval = false,
  onSuccess,
  onOptimisticStatus,
  onOptimisticRollback,
  compact = false,
}: {
  bookingId: string;
  status: string;
  tokenRequired?: number;
  cancelPolicySummary?: string;
  isMouAgent?: boolean;
  /** Custom rates awaiting GM — block token confirm. */
  ratePendingApproval?: boolean;
  /** After token confirm / cancel / no-show etc. — host refreshes stay summary. */
  onSuccess?: () => void;
  /** Paint status immediately on submit (confirm → confirmed, cancel → cancelled). */
  onOptimisticStatus?: (status: string) => void;
  onOptimisticRollback?: () => void;
  /** Check-in More: tighter cancel / no-show row */
  compact?: boolean;
}) {
  const canCancel = ["pending", "held", "confirmed", "checked_in"].includes(
    status,
  );
  const canNoShow = ["pending", "held", "confirmed"].includes(status);
  const canConfirmToken =
    ["held", "pending"].includes(status) && !ratePendingApproval;
  const canExtend = status === "held";

  if (!canCancel && !canNoShow && !canConfirmToken) return null;

  return (
    <div
      className={
        compact
          ? "erp flex flex-col gap-1.5"
          : "erp mt-2 flex flex-col gap-2"
      }
    >
      {ratePendingApproval && ["held", "pending"].includes(status) ? (
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-950 dark:text-amber-50">
          Confirm disabled — awaiting GM rate approval.
        </p>
      ) : null}
      {canConfirmToken ? (
        <ConfirmTokenForm
          bookingId={bookingId}
          tokenRequired={tokenRequired ?? 0}
          onSuccess={onSuccess}
          onOptimistic={() => onOptimisticStatus?.("confirmed")}
          onRollback={onOptimisticRollback}
        />
      ) : null}
      {canExtend ? (
        <ExtendHoldForm bookingId={bookingId} onSuccess={onSuccess} />
      ) : null}
      <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-3"}>
        {canCancel ? (
          <CancelForm
            bookingId={bookingId}
            cancelPolicySummary={cancelPolicySummary}
            isMouAgent={isMouAgent}
            onSuccess={onSuccess}
            onOptimistic={() => onOptimisticStatus?.("cancelled")}
            onRollback={onOptimisticRollback}
          />
        ) : null}
        {canNoShow ? (
          <NoShowForm
            bookingId={bookingId}
            onSuccess={onSuccess}
            onOptimistic={() => onOptimisticStatus?.("no_show")}
            onRollback={onOptimisticRollback}
          />
        ) : null}
      </div>
    </div>
  );
}

function ConfirmTokenForm({
  bookingId,
  tokenRequired,
  onSuccess,
  onOptimistic,
  onRollback,
}: {
  bookingId: string;
  tokenRequired: number;
  onSuccess?: () => void;
  onOptimistic?: () => void;
  onRollback?: () => void;
}) {
  const [state, action, pending] = useActionState(
    confirmBookingToken,
    holdInitial,
  );
  useActionToast(state, { successMessage: "Token confirmed" });
  useActionSuccess(state, onSuccess);
  useOptimisticRollback(state, onRollback);
  return (
    <form
      id="stay-hub-confirm-token-form"
      action={action}
      className="flex flex-wrap items-end gap-2"
      onSubmit={() => onOptimistic?.()}
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <label className="text-xs text-muted-foreground">
        Token Nu
        <input
          name="amount_btn"
          type="number"
          min={0}
          step="1"
          defaultValue={tokenRequired > 0 ? String(tokenRequired) : ""}
          className={`mt-0.5 block w-24 ${fieldXs}`}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Method
        <select
          name="method"
          defaultValue="bank"
          className={`mt-0.5 block ${selectXs}`}
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
        className={fieldXs}
      />
      <Button
        type="submit"
        size="sm"
        disabled={pending}
      >
        {pending ? "Confirming…" : "Confirm token"}
      </Button>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" name="owner_override" value="1" />
        Owner override
      </label>
      {state.error ? (
        <span className="w-full text-xs text-destructive">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="w-full text-xs text-muted-foreground">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function ExtendHoldForm({
  bookingId,
  onSuccess,
}: {
  bookingId: string;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(
    extendBookingHold,
    holdInitial,
  );
  useActionToast(state, { successMessage: "Hold extended" });
  useActionSuccess(state, onSuccess);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input
        name="reason"
        placeholder="Extend reason"
        className={fieldXs}
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-xs font-medium text-foreground"
      >
        {pending ? "Extending…" : "Extend hold"}
      </Button>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}

function CancelForm({
  bookingId,
  cancelPolicySummary,
  isMouAgent,
  onSuccess,
  onOptimistic,
  onRollback,
}: {
  bookingId: string;
  cancelPolicySummary?: string;
  isMouAgent?: boolean;
  onSuccess?: () => void;
  onOptimistic?: () => void;
  onRollback?: () => void;
}) {
  const [state, action, pending] = useActionState(cancelBooking, channelInitial);
  useActionToast(state, { successMessage: "Booking cancelled" });
  useActionSuccess(state, onSuccess);
  useOptimisticRollback(state, onRollback);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9 text-xs font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent layer="nested">
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            This marks the booking cancelled and frees its held inventory. The
            action is irreversible — only proceed if the guest is genuinely not
            coming.
          </DialogDescription>
        </DialogHeader>
        {isMouAgent ? (
          <p className="rounded-md border border-citrus/30 bg-citrus-tint/40 px-3 py-2 text-xs text-foreground">
            MoU agent — free cancel anytime (no fee).
          </p>
        ) : cancelPolicySummary ? (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {cancelPolicySummary}
          </p>
        ) : (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Cancel fee (if any) posts from Settings → Policies after save —
            same job as eZee cancel-with-fee.
          </p>
        )}
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
            <p className="text-xs text-destructive">{state.error}</p>
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
              onClick={() => {
                onOptimistic?.();
                setOpen(false);
              }}
            >
              {pending ? "Cancelling…" : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoShowForm({
  bookingId,
  onSuccess,
  onOptimistic,
  onRollback,
}: {
  bookingId: string;
  onSuccess?: () => void;
  onOptimistic?: () => void;
  onRollback?: () => void;
}) {
  const [state, action, pending] = useActionState(
    markBookingNoShow,
    channelInitial,
  );
  useActionToast(state, { successMessage: "Marked as no-show" });
  useActionSuccess(state, onSuccess);
  useOptimisticRollback(state, onRollback);
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
      <DialogContent layer="nested">
        <DialogHeader>
          <DialogTitle>Mark as no-show?</DialogTitle>
          <DialogDescription>
            The booking will be marked as a no-show and its inventory released.
            No-show fee nights (Settings → Policies) post to the folio when
            configured — same pattern as eZee.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Confirm only if the guest never arrived on the business date. Late
          arrival should stay checked in after CI.
        </p>
        <form action={action}>
          <input type="hidden" name="booking_id" value={bookingId} />
          {state.error ? (
            <p className="text-xs text-destructive">{state.error}</p>
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
              onClick={() => {
                onOptimistic?.();
                setOpen(false);
              }}
            >
              {pending ? "Marking…" : "Confirm no-show"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
