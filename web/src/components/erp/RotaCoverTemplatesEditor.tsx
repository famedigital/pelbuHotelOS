"use client";

import {
  deleteRotaCoverTemplate,
  upsertRotaCoverTemplate,
  type RotaActionState,
} from "@/app/actions/erp-rota";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShiftOutlet, SHIFT_OUTLETS } from "@/lib/shift-outlets";
import { useActionToast } from "@/hooks/use-action-toast";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

export type CoverTemplate = {
  id: string;
  name: string;
  outlet: string;
  daysOfWeek: number[];
  startsAt: string;
  endsAt: string;
  slotsNeeded: number;
  preferredRoleLabels: string[];
  preferredPositionIlike: string | null;
  priority: number;
  isActive: boolean;
  notes: string | null;
};

const initial: RotaActionState = { ok: false };
const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const DAY_NAMES = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 7, label: "Sun" },
];

export function RotaCoverTemplatesEditor({
  templates,
}: {
  templates: CoverTemplate[];
}) {
  const router = useRouter();
  const [saveState, save, savePending] = useActionState(
    upsertRotaCoverTemplate,
    initial,
  );
  const [delState, remove] = useActionState(deleteRotaCoverTemplate, initial);
  useActionToast(saveState, { successMessage: "Template saved" });
  useActionToast(delState, { successMessage: "Template deleted" });
  useEffect(() => {
    if (saveState.ok || delState.ok) router.refresh();
  }, [saveState.ok, delState.ok, router]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cover templates yet. Add ones below — Generate week uses active
            templates only.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {template.name}
                    {!template.isActive ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (inactive)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatShiftOutlet(template.outlet)} ·{" "}
                    {template.startsAt.slice(0, 5)}–{template.endsAt.slice(0, 5)} ·{" "}
                    {template.slotsNeeded} slot
                    {template.slotsNeeded === 1 ? "" : "s"} · priority{" "}
                    {template.priority}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Days:{" "}
                    {template.daysOfWeek.length
                      ? template.daysOfWeek
                          .map((d) => DAY_NAMES.find((x) => x.n === d)?.label ?? d)
                          .join(", ")
                      : "every day"}
                    {template.preferredRoleLabels.length
                      ? ` · roles ${template.preferredRoleLabels.join(", ")}`
                      : ""}
                  </p>
                </div>
                <form action={remove}>
                  <input type="hidden" name="id" value={template.id} />
                  <Button type="submit" variant="ghost" size="sm" className="h-11">
                    Delete
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={save} className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Add cover template</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ct_name">Name</Label>
            <Input id="ct_name" name="name" required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct_outlet">Outlet</Label>
            <select id="ct_outlet" name="outlet" className={selectClass} required>
              {SHIFT_OUTLETS.map((outlet) => (
                <option key={outlet} value={outlet}>
                  {formatShiftOutlet(outlet)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct_slots">Slots needed</Label>
            <Input
              id="ct_slots"
              name="slots_needed"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct_start">Start</Label>
            <Input
              id="ct_start"
              name="starts_at"
              type="time"
              defaultValue="09:00"
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct_end">End</Label>
            <Input
              id="ct_end"
              name="ends_at"
              type="time"
              defaultValue="17:00"
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct_priority">Priority (lower first)</Label>
            <Input
              id="ct_priority"
              name="priority"
              type="number"
              defaultValue={100}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct_roles">Preferred roles (comma-separated)</Label>
            <Input
              id="ct_roles"
              name="preferred_role_labels"
              placeholder="front_desk, manager"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ct_pos">Position ILIKE (e.g. %barista%)</Label>
            <Input id="ct_pos" name="preferred_position_ilike" className="h-11" />
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Days (empty = every day)</legend>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((day) => (
              <label
                key={day.n}
                className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border px-3 text-sm"
              >
                <input
                  type="checkbox"
                  name="days_of_week"
                  value={day.n}
                  className="size-4 rounded border"
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="ct_notes">Notes</Label>
          <Input id="ct_notes" name="notes" className="h-11" />
        </div>
        <Button type="submit" variant="citrus" className="h-11" disabled={savePending}>
          {savePending ? "Saving…" : "Save template"}
        </Button>
        {saveState.error ? (
          <p className="text-sm text-destructive">{saveState.error}</p>
        ) : null}
      </form>
    </div>
  );
}
