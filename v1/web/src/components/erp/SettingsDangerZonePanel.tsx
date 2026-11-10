"use client";

import { wipeOperationalData, type SettingsActionState } from "@/app/actions/erp-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { useActionState } from "react";

const initialState: SettingsActionState = { ok: false };

const MASTER_OPTIONS = [
  {
    name: "wipe_rooms",
    label: "Rooms & categories",
    hint: "Room types + physical doors (also clears rates for those types)",
  },
  {
    name: "wipe_staff",
    label: "Staff",
    hint: "Non-owner staff, profiles, payroll lines",
  },
  {
    name: "wipe_menu",
    label: "Menu",
    hint: "Menu items, modifiers, recipes, stock profiles",
  },
  {
    name: "wipe_agents",
    label: "Agents",
    hint: "Travel agent companies, documents, allotments",
  },
  {
    name: "wipe_rates",
    label: "Prices / rates",
    hint: "Room rate matrix and named rate plans",
  },
  {
    name: "wipe_rota",
    label: "Rota",
    hint: "Staff shifts and rota cover templates",
  },
  {
    name: "wipe_attendance",
    label: "Attendance",
    hint: "Punch events and attendance devices",
  },
  {
    name: "wipe_leave",
    label: "Leave",
    hint: "Leave requests, balances, ledger (keeps policies)",
  },
] as const;

export function SettingsDangerZonePanel({
  propertyId,
  confirmPhrase,
}: {
  propertyId: string;
  confirmPhrase: string;
}) {
  const [state, action, pending] = useActionState(wipeOperationalData, initialState);
  useActionToast(state, { successMessage: "Wipe complete" });
  usePendingFeedback(pending, "Wiping data…");

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
          Owner only. Always removes test bookings, folios, payments, orders,
          laundry, inventory movements/audits/POs, calendar blocks, lost &amp;
          found, and night audits.{" "}
          <strong className="font-medium text-foreground">
            Masters stay unless you tick them below. Owner staff accounts are
            never removed. Checking Staff also clears their attendance, leave,
            and rota (FK safety).
          </strong>{" "}
          Complete training and UAT first. Action is audit-logged and cannot be
          undone.
        </p>
      </div>

      <form action={action} className="max-w-xl space-y-5">
        <input type="hidden" name="property_id" value={propertyId} />

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">
            Also wipe master data{" "}
            <span className="font-normal text-muted-foreground">
              (optional, off by default)
            </span>
          </legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {MASTER_OPTIONS.map((opt) => (
              <li key={opt.name}>
                <label
                  htmlFor={opt.name}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 bg-background/60 px-3 py-2.5 hover:border-destructive/30"
                >
                  <input
                    id={opt.name}
                    type="checkbox"
                    name={opt.name}
                    value="1"
                    className="mt-0.5 size-4 shrink-0 rounded border-input accent-destructive"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

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
          {pending ? "Wiping…" : "Wipe selected data"}
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
