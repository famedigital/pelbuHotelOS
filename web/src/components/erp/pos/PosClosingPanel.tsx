"use client";

import {
  closePosShift,
  openPosShift,
  type PosShiftState,
} from "@/app/actions/erp-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import type { PosShift } from "@/lib/pos";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: PosShiftState = { ok: false };

export function PosClosingPanel({ shift }: { shift: PosShift | null }) {
  const [openState, openAction, opening] = useActionState(openPosShift, initial);
  const [closeState, closeAction, closing] = useActionState(
    closePosShift,
    initial,
  );
  useActionToast(openState, { successMessage: "POS shift opened" });
  useActionToast(closeState, { successMessage: "POS shift closed" });

  if (!shift) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Cash drawer
        </p>
        <h2 className="mt-1 text-xl font-semibold">Open POS shift</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Count the starting cash before accepting guest payments.
        </p>
        {openState.error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{openState.error}</AlertDescription>
          </Alert>
        ) : null}
        <form action={openAction} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="opening_float_btn">Opening float (Nu)</Label>
            <Input
              id="opening_float_btn"
              name="opening_float_btn"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </div>
          <Button type="submit" variant="citrus" disabled={opening}>
            {opening ? "Opening…" : "Open shift"}
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Cash drawer
          </p>
          <h2 className="mt-1 text-xl font-semibold">Close POS shift</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Opened by {shift.opened_by_name} ·{" "}
            {new Date(shift.opened_at).toLocaleString("en-BT")}
          </p>
        </div>
        <div className="rounded-lg border bg-secondary/40 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Opening float
          </p>
          <p className="font-semibold tabular-nums">
            {formatBtn(shift.opening_float_btn)}
          </p>
        </div>
      </div>

      {closeState.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{closeState.error}</AlertDescription>
        </Alert>
      ) : null}

      <form action={closeAction} className="mt-5 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="shift_id" value={shift.id} />
        <div className="space-y-1.5">
          <Label htmlFor="counted_cash_btn">Counted drawer cash (Nu)</Label>
          <Input
            id="counted_cash_btn"
            name="counted_cash_btn"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <p className="text-xs text-muted-foreground">
            Include the opening float. Expected cash is revealed after close.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manager_pin">Manager PIN</Label>
          <Input
            id="manager_pin"
            name="manager_pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="close_notes">Handover notes</Label>
          <Textarea id="close_notes" name="notes" maxLength={500} rows={3} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="destructive" disabled={closing}>
            {closing ? "Reconciling…" : "Close and produce Z-report"}
          </Button>
        </div>
      </form>
    </section>
  );
}
