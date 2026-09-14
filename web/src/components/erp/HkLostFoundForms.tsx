"use client";

import {
  completeHkChecklist,
  createLostFoundItem,
  updateLostFoundStatus,
  type OpsState,
} from "@/app/actions/erp-hk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { useActionState } from "react";

const initial: OpsState = { ok: false };

const selectClass =
  "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function HkChecklistForm({
  id,
  cleanOk,
  linenOk,
  amenitiesOk,
  status,
}: {
  id: string;
  cleanOk: boolean;
  linenOk: boolean;
  amenitiesOk: boolean;
  status: string;
}) {
  const [state, action, pending] = useActionState(completeHkChecklist, initial);
  const done = status === "done";
  usePendingFeedback(pending, "Saving checklist…");

  return (
    <form action={action} className="erp space-y-2 rounded-md border bg-muted/20 p-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Turnover checklist
      </p>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="checklist_clean_ok"
          defaultChecked={cleanOk}
          disabled={done}
        />
        Room clean OK
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="checklist_linen_ok"
          defaultChecked={linenOk}
          disabled={done}
        />
        Linen changed
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="checklist_amenities_ok"
          defaultChecked={amenitiesOk}
          disabled={done}
        />
        Amenities restocked
      </label>
      {!done ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="submit" size="sm" disabled={pending} name="mark_done" value="on">
            Mark done
          </Button>
        </div>
      ) : null}
      {state.error ? (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-xs text-foreground">{state.message}</p>
      ) : null}
    </form>
  );
}

export function LostFoundCreateForm({
  units,
  staff,
}: {
  units: { id: string; label: string }[];
  staff: { id: string; full_name: string }[];
}) {
  const [state, action, pending] = useActionState(createLostFoundItem, initial);

  return (
    <form action={action} className="erp grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="lf_desc">Item description</Label>
        <Input
          id="lf_desc"
          name="description"
          required
          placeholder="Blue umbrella · left in closet"
        />
      </div>
      <div className="space-y-1">
        <Label>Room found</Label>
        <select name="room_unit_id" className={selectClass}>
          <option value="">—</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>Found by</Label>
        <select name="found_by_staff_id" className={selectClass}>
          <option value="">—</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lf_guest">Guest name (optional)</Label>
        <Input id="lf_guest" name="guest_name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lf_contact">Guest contact</Label>
        <Input id="lf_contact" name="guest_contact" />
      </div>
      <Button type="submit" disabled={pending} className="h-11 sm:col-span-2">
        {pending ? "Saving…" : "Log item"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-foreground sm:col-span-2">{state.message}</p>
      ) : null}
    </form>
  );
}

export function LostFoundStatusForm({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updateLostFoundStatus, initial);

  return (
    <form action={action} className="erp flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className="rounded-md border border-input bg-transparent px-2 py-1 text-xs">
        <option value="open">open</option>
        <option value="claimed">claimed</option>
        <option value="disposed">disposed</option>
      </select>
      <Button type="submit" disabled={pending} variant="link" size="sm" className="h-auto p-0 text-xs">
        Update
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
