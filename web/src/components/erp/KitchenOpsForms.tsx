"use client";

import {
  createKitchenEvent,
  deleteKitchenEvent,
  publishKitchenMealService,
} from "@/app/actions/erp-kitchen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState } from "react";

const initial = { ok: false } as const;

export function KitchenEventForm({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState(createKitchenEvent, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ke_date">Date</Label>
          <Input id="ke_date" name="event_date" type="date" defaultValue={defaultDate} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ke_covers">Covers</Label>
          <Input id="ke_covers" name="covers" type="number" min={0} defaultValue={0} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ke_title">Event title</Label>
        <Input id="ke_title" name="title" required placeholder="Group lunch / banquet" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ke_period">Meal period</Label>
        <select
          id="ke_period"
          name="meal_period"
          className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue="lunch"
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="all">All meals</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ke_notes">Notes</Label>
        <Textarea id="ke_notes" name="notes" rows={2} />
      </div>
      <Button type="submit">Add event</Button>
      {state.message ? <p className="text-xs text-emerald-600">{state.message}</p> : null}
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function KitchenEventDeleteButton({ eventId }: { eventId: string }) {
  const [, action] = useActionState(deleteKitchenEvent, initial);
  return (
    <form action={action}>
      <input type="hidden" name="event_id" value={eventId} />
      <Button type="submit" variant="ghost" size="sm" className="text-destructive">
        Remove
      </Button>
    </form>
  );
}

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
  const [state, action, pending] = useActionState(publishKitchenMealService, initial);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
          Publish meal service
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Push today&apos;s guest feed and menu notes to front desk / F&amp;B POS.
          Covers are snapshotted from in-house meal plans.
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
        <p className="text-xs text-emerald-700 dark:text-emerald-300">{state.message}</p>
      ) : null}
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
