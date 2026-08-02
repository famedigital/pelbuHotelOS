"use client";

import { publishKitchenMealService } from "@/app/actions/erp-kitchen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState } from "react";

const initial = { ok: false } as const;

/** Kitchen publishes BF / lunch / dinner feed + menu notes to FO/F&B. */
export function PublishMealServiceForm({
  defaultDate,
  defaultPeriod = "breakfast",
  defaultHeads,
}: {
  defaultDate: string;
  defaultPeriod?: "breakfast" | "lunch" | "dinner";
  defaultHeads?: number;
}) {
  const [state, action, pending] = useActionState(
    publishKitchenMealService,
    initial,
  );

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4"
    >
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
          Publish meal service
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Push today&apos;s guest feed and menu notes to front desk / F&amp;B
          POS. Covers are snapshotted from in-house meal plans.
          {defaultHeads != null ? (
            <>
              {" "}
              Suggested heads for {defaultPeriod}:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {defaultHeads}
              </span>
              .
            </>
          ) : null}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ms_date">Service date</Label>
          <Input
            id="ms_date"
            name="service_date"
            type="date"
            defaultValue={defaultDate}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ms_period">Meal</Label>
          <select
            id="ms_period"
            name="meal_period"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={defaultPeriod}
            required
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ms_menu">Menu note (FO / waiter)</Label>
        <Textarea
          id="ms_menu"
          name="menu_note"
          rows={2}
          placeholder="Continental + local · eggs to order · tea/coffee station"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ms_highlights">POS / specials highlight</Label>
        <Input
          id="ms_highlights"
          name="menu_highlights"
          placeholder="e.g. Suja special, set MAP dinner"
        />
      </div>
      <input type="hidden" name="published_by" value="kitchen" />
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Publishing…" : "Publish to FO / F&B"}
      </Button>
      {state.message ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
