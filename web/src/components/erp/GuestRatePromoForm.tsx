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
}: {
  bookingId: string;
  defaultNightlyRateBtn: number | null;
  defaultEmail: string | null;
  guestName?: string | null;
  onSuccess?: () => void;
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

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      <div>
        <p className="text-sm font-medium">Guest rate code</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Creates a personal promo so{" "}
          {guestName ? <span className="font-medium">{guestName}</span> : "the guest"}{" "}
          can self-book at their agreed Nu/night on the public site. Email
          includes the code + how to use it.
        </p>
      </div>

      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="send_email" value="1" />
        <input type="hidden" name="set_on_booking" value="1" />

        <div className="space-y-1.5">
          <Label htmlFor="guest_rate_btn">Agreed Nu / night</Label>
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
            className="h-10 tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="guest_rate_email">Email</Label>
          <Input
            id="guest_rate_email"
            name="email"
            type="email"
            required
            defaultValue={defaultEmail ?? ""}
            placeholder="guest@email.com"
            className="h-10"
          />
        </div>
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
        <div className="space-y-1.5">
          <Label htmlFor="guest_rate_pin">Manager PIN</Label>
          <Input
            id="guest_rate_pin"
            type="password"
            name="manager_pin"
            required
            autoComplete="off"
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
            {state.code ? (
              <span className="mt-1 block font-mono font-semibold">
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
          className="h-10 sm:col-span-2"
        >
          {pending ? "Creating…" : "Create code & email guest"}
        </Button>
      </form>
    </div>
  );
}
