"use client";

import {
  updateDeskShiftRestrictionSettings,
  type CommercialSettingsState,
} from "@/app/actions/erp-settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import Link from "next/link";
import { useActionState } from "react";

const initial: CommercialSettingsState = { ok: false };

export function SettingsDeskSecurityPanel({
  propertyId,
  deskRestrictToScheduledShifts,
  canEdit,
}: {
  propertyId: string;
  deskRestrictToScheduledShifts: boolean;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateDeskShiftRestrictionSettings,
    initial,
  );
  useActionToast(state, { successMessage: "Desk access setting saved" });

  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-5 space-y-1.5">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Staff security
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Hotel desk hours
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Control whether non-management staff may open{" "}
          <span className="font-medium text-foreground">/erp</span> only during
          a published rota shift. Off (default) keeps desk flexible for go-live.
        </p>
      </div>

      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          View only — only Owner or Manager (GM) can change this. Currently:{" "}
          <span className="font-medium text-foreground">
            {deskRestrictToScheduledShifts ? "restricted to shifts" : "open any time"}
          </span>
          .
        </p>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="property_id" value={propertyId} />
          <div className="flex min-h-11 items-start gap-3 rounded-lg border px-4 py-3">
            <Checkbox
              id="desk_restrict_to_scheduled_shifts"
              name="desk_restrict_to_scheduled_shifts"
              value="on"
              defaultChecked={deskRestrictToScheduledShifts}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label
                htmlFor="desk_restrict_to_scheduled_shifts"
                className="text-sm font-medium text-foreground"
              >
                Restrict hotel desk to scheduled shifts
              </Label>
              <p className="text-xs text-muted-foreground">
                Off (default): any staff with login and hotel desk enabled can
                sign in any time after PIN. On: non-management staff need a{" "}
                <Link href="/erp/hr/rota" className="text-accent underline">
                  published rota
                </Link>{" "}
                covering now (Thimphu time). Owner, GM, manager levels, and the
                shared DESK_PIN always bypass. POS cashier shift is separate.
              </p>
            </div>
          </div>
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? "Saving…" : "Save desk access"}
          </Button>
        </form>
      )}
    </section>
  );
}
