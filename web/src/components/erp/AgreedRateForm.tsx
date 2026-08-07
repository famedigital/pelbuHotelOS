"use client";

import {
  setAgreedNightlyRate,
  type AgreedRateState,
} from "@/app/actions/erp-agreed-rate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useEffect, useRef } from "react";

const initial: AgreedRateState = { ok: false };

/**
 * Manager-PIN negotiated nightly rate (regulars / special cases).
 * Overrides rate sheet for room-night posting until cleared.
 */
export function AgreedRateForm({
  bookingId,
  currentRateBtn,
  currentReason,
  mealPlanCode,
  roomLabel,
  onSuccess,
}: {
  bookingId: string;
  currentRateBtn: number | null;
  currentReason: string | null;
  mealPlanCode?: string | null;
  roomLabel?: string | null;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(setAgreedNightlyRate, initial);
  useActionToast(state);
  const lastOk = useRef(false);
  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      onSuccess?.();
    }
    if (!state.ok) lastOk.current = false;
  }, [state.ok, onSuccess]);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Agreed nightly rate</p>
        <p className="text-xs text-muted-foreground">
          {roomLabel ? `${roomLabel} · ` : ""}
          {currentRateBtn != null ? (
            <span className="font-medium text-foreground tabular-nums">
              {formatBtn(currentRateBtn)}/night
            </span>
          ) : (
            <span>Rate sheet</span>
          )}
          {mealPlanCode ? ` · ${mealPlanCode}` : ""}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        For regulars and manager-approved specials (e.g. Nu 2,000 EP). Same tax
        basis as the rates sheet. Manager PIN required.
      </p>
      {currentReason ? (
        <p className="text-xs text-muted-foreground">
          Last reason: {currentReason}
        </p>
      ) : null}

      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="set_ep" value="1" />
        <input type="hidden" name="adjust_posted" value="1" />
        <div className="space-y-1.5">
          <Label htmlFor="agreed_rate_btn">Nightly rate (BTN)</Label>
          <Input
            id="agreed_rate_btn"
            name="agreed_nightly_rate_btn"
            type="number"
            min={0}
            step="1"
            required
            defaultValue={
              currentRateBtn != null ? String(currentRateBtn) : ""
            }
            placeholder="2000"
            className="h-10 tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agreed_rate_pin">Manager PIN</Label>
          <Input
            id="agreed_rate_pin"
            type="password"
            name="manager_pin"
            required
            autoComplete="off"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="agreed_rate_reason">Reason</Label>
          <Input
            id="agreed_rate_reason"
            name="reason"
            required
            defaultValue={currentReason ?? "Regular client — manager approved"}
            className="h-10"
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive sm:col-span-2" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok && state.message ? (
          <p className="text-sm text-emerald-700 sm:col-span-2">
            {state.message}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="citrus"
          disabled={pending}
          className="h-10 sm:col-span-2"
        >
          {pending ? "Saving…" : "Set agreed rate (manager PIN)"}
        </Button>
      </form>

      {currentRateBtn != null ? (
        <form action={action} className="border-t pt-3">
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="clear" value="1" />
          <input type="hidden" name="adjust_posted" value="1" />
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem] flex-1 space-y-1.5">
              <Label htmlFor="clear_agreed_pin">Manager PIN to clear</Label>
              <Input
                id="clear_agreed_pin"
                type="password"
                name="manager_pin"
                required
                autoComplete="off"
                className="h-10"
              />
            </div>
            <Button type="submit" variant="outline" disabled={pending} className="h-10">
              {pending ? "…" : "Clear agreed rate"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
