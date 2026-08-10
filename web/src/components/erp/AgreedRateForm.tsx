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
import { cn } from "@/lib/utils";
import { useActionState, useEffect, useRef } from "react";

const initial: AgreedRateState = { ok: false };

/**
 * Manager-PIN negotiated nightly rate (regulars / special cases / event discount).
 * Overrides rate sheet for room-night posting until cleared.
 */
export function AgreedRateForm({
  bookingId,
  currentRateBtn,
  currentReason,
  mealPlanCode,
  roomLabel,
  onSuccess,
  compact = false,
}: {
  bookingId: string;
  currentRateBtn: number | null;
  currentReason: string | null;
  mealPlanCode?: string | null;
  roomLabel?: string | null;
  onSuccess?: () => void;
  /** StayHub Advanced — no outer card, denser fields */
  compact?: boolean;
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

  const fieldH = compact ? "h-8" : "h-10";
  const btnH = compact ? "h-8 min-h-8 text-xs" : "h-10";
  const labelClass = compact ? "text-[11px]" : undefined;

  return (
    <div
      className={cn(
        compact
          ? "space-y-2"
          : "space-y-3 rounded-lg border bg-card p-3 sm:p-4",
      )}
    >
      {!compact ? (
        <>
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
            For regulars and manager-approved specials (e.g. Nu 2,000 EP). Same
            tax basis as the rates sheet. Manager PIN required.
          </p>
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          {roomLabel ? `${roomLabel} · ` : ""}
          Now:{" "}
          {currentRateBtn != null
            ? `${formatBtn(currentRateBtn)}/night`
            : "rate sheet"}
          {mealPlanCode ? ` · ${mealPlanCode}` : ""}
          {currentReason ? ` · ${currentReason}` : ""}
        </p>
      )}

      {currentReason && !compact ? (
        <p className="text-xs text-muted-foreground">
          Last reason: {currentReason}
        </p>
      ) : null}

      <form
        action={action}
        className={cn(
          "grid sm:grid-cols-2",
          compact ? "gap-2" : "gap-3",
        )}
      >
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="set_ep" value="1" />
        <input type="hidden" name="adjust_posted" value="1" />
        <div className="space-y-1">
          <Label htmlFor="agreed_rate_btn" className={labelClass}>
            Nightly rate (Nu)
          </Label>
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
            placeholder="e.g. 2500"
            className={cn(fieldH, "tabular-nums")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="agreed_rate_pin" className={labelClass}>
            Manager PIN
          </Label>
          <Input
            id="agreed_rate_pin"
            type="password"
            name="manager_pin"
            required
            autoComplete="off"
            className={fieldH}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="agreed_rate_reason" className={labelClass}>
            Reason
          </Label>
          <Input
            id="agreed_rate_reason"
            name="reason"
            required
            defaultValue={
              currentReason ?? "Agent / event discount — manager approved"
            }
            className={fieldH}
          />
        </div>
        {state.error ? (
          <p className="text-xs text-destructive sm:col-span-2" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok && state.message ? (
          <p className="text-xs text-emerald-700 sm:col-span-2">
            {state.message}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="citrus"
          disabled={pending}
          className={cn(btnH, "sm:col-span-2")}
        >
          {pending ? "Saving…" : "Set agreed rate"}
        </Button>
      </form>

      {currentRateBtn != null ? (
        <form
          action={action}
          className={cn(compact ? "border-t pt-2" : "border-t pt-3")}
        >
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="clear" value="1" />
          <input type="hidden" name="adjust_posted" value="1" />
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[7rem] flex-1 space-y-1">
              <Label htmlFor="clear_agreed_pin" className={labelClass}>
                PIN to clear
              </Label>
              <Input
                id="clear_agreed_pin"
                type="password"
                name="manager_pin"
                required
                autoComplete="off"
                className={fieldH}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={pending}
              className={btnH}
            >
              {pending ? "…" : "Clear"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
