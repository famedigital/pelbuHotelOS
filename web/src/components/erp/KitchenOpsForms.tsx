"use client";

import { createKitchenEvent, deleteKitchenEvent } from "@/app/actions/erp-kitchen";
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
