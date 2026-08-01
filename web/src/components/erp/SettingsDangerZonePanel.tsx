"use client";

import { wipeOperationalData, type SettingsActionState } from "@/app/actions/erp-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { useActionState } from "react";

const initialState: SettingsActionState = { ok: false };

export function SettingsDangerZonePanel({
  propertyId,
  confirmPhrase,
}: {
  propertyId: string;
  confirmPhrase: string;
}) {
  const [state, action, pending] = useActionState(wipeOperationalData, initialState);
  useActionToast(state, { successMessage: "Operational data wiped" });
  usePendingFeedback(pending, "Wiping operational data…");

  return (
    <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 md:p-6">
      <div className="mb-5 space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-destructive uppercase">
          Danger zone
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Wipe operational data
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Owner only. Removes test bookings, folios, payments, orders, laundry,
          inventory movements/audits/POs, calendar blocks, lost &amp; found, and
          night audits.{" "}
          <strong className="font-medium text-foreground">
            Keeps rooms, rates, meal plans, policies, damage catalog, compliance
            vault, staff, CMS, and seasons.
          </strong>{" "}
          Complete training and UAT first. Action is audit-logged and cannot be
          undone.
        </p>
      </div>

      <form action={action} className="max-w-md space-y-4">
        <input type="hidden" name="property_id" value={propertyId} />
        <div className="space-y-1.5">
          <Label htmlFor="danger_confirm">
            Type <span className="font-mono font-semibold">{confirmPhrase}</span>{" "}
            to confirm
          </Label>
          <Input
            id="danger_confirm"
            name="confirm_phrase"
            autoComplete="off"
            spellCheck={false}
            required
            placeholder={confirmPhrase}
            className="font-mono"
          />
        </div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Wiping…" : "Wipe operational data"}
        </Button>
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok && state.message ? (
          <p className="text-sm text-emerald-700" role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
