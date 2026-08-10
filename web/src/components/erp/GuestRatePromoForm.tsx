"use client";

import {
  issueGuestRatePromo,
  type GuestRatePromoState,
} from "@/app/actions/erp-guest-rate-promo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useEffect, useRef } from "react";

const initial: GuestRatePromoState = { ok: false };

/**
 * Manager-PIN: create a personal /book promo that locks the guest’s agreed
 * nightly rate, and email them the code for next stay.
 */
export function GuestRatePromoForm({
  bookingId,
  defaultNightlyRateBtn,
  defaultEmail,
  guestName,
  onSuccess,
  compact = false,
}: {
  bookingId: string;
  defaultNightlyRateBtn: number | null;
  defaultEmail: string | null;
  guestName?: string | null;
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(issueGuestRatePromo, initial);
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
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-lg border bg-card p-3 sm:p-4"
      }
    >
      {!compact ? (
        <div>
          <p className="text-sm font-medium">Guest rate code</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Creates a personal promo so{" "}
            {guestName ? (
              <span className="font-medium">{guestName}</span>
            ) : (
              "the guest"
            )}{" "}
            can self-book at their agreed Nu/night on the public site. Email
            includes the code + how to use it.
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Email a personal rate code for this guest&apos;s next online book.
        </p>
      )}

      <form
        action={action}
        className={
          compact
            ? "grid gap-2 sm:grid-cols-2"
            : "grid gap-3 sm:grid-cols-2"
        }
      >
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="send_email" value="1" />
        <input type="hidden" name="set_on_booking" value="1" />

        <div className="space-y-1">
          <Label htmlFor="guest_rate_btn" className={labelClass}>
            Agreed Nu / night
          </Label>
          <Input
            id="guest_rate_btn"
            name="nightly_rate_btn"
            type="number"
            min={0}
            step="1"
            required
            defaultValue={
              defaultNightlyRateBtn != null
                ? String(defaultNightlyRateBtn)
                : "2000"
            }
            className={`${fieldH} tabular-nums`}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="guest_rate_email" className={labelClass}>
            Email
          </Label>
          <Input
            id="guest_rate_email"
            name="email"
            type="email"
            required
            defaultValue={defaultEmail ?? ""}
            placeholder="guest@email.com"
            className={fieldH}
          />
        </div>
        {!compact ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="guest_rate_code">
                Code{" "}
                <span className="font-normal text-muted-foreground">
                  (blank = auto)
                </span>
              </Label>
              <Input
                id="guest_rate_code"
                name="code"
                maxLength={16}
                placeholder="e.g. ARJUN4K"
                className="h-10 font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest_rate_max">Max future stays</Label>
              <Input
                id="guest_rate_max"
                name="max_stays"
                type="number"
                min={1}
                max={100}
                defaultValue={5}
                className="h-10 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest_rate_months">
                Valid months{" "}
                <span className="font-normal text-muted-foreground">
                  (blank = no end)
                </span>
              </Label>
              <Input
                id="guest_rate_months"
                name="valid_months"
                type="number"
                min={1}
                max={36}
                defaultValue={12}
                className="h-10 tabular-nums"
              />
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="max_stays" value="5" />
            <input type="hidden" name="valid_months" value="12" />
          </>
        )}
        <div className="space-y-1">
          <Label htmlFor="guest_rate_pin" className={labelClass}>
            Manager PIN
          </Label>
          <Input
            id="guest_rate_pin"
            type="password"
            name="manager_pin"
            required
            autoComplete="off"
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
            {state.code ? (
              <span className="mt-0.5 block font-mono font-semibold">
                {state.code}
                {defaultNightlyRateBtn != null
                  ? ` · ${formatBtn(defaultNightlyRateBtn)}/night`
                  : ""}
              </span>
            ) : null}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="citrus"
          disabled={pending}
          className={`${btnH} sm:col-span-2`}
        >
          {pending ? "Creating…" : compact ? "Create & email" : "Create code & email guest"}
        </Button>
      </form>
    </div>
  );
}
