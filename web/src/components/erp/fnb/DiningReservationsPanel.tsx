"use client";

import type { FnbLogState } from "@/app/actions/erp-fnb-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

type Action = (
  prev: FnbLogState,
  formData: FormData,
) => Promise<FnbLogState>;

const initial: FnbLogState = { ok: false };

export function DiningReservationsPanel({
  rows,
  tables,
  createAction,
  statusAction,
}: {
  rows: {
    id: string;
    guest_name: string;
    phone: string | null;
    party_size: number;
    reserved_for: string;
    status: string;
    notes: string | null;
    outlet: string | null;
    table_id: string | null;
  }[];
  tables: { id: string; name: string }[];
  createAction: Action;
  statusAction: Action;
}) {
  const [createState, createForm, creating] = useActionState(
    createAction,
    initial,
  );
  useActionToast(createState, { successMessage: createState.message ?? "Saved" });

  return (
    <div className="space-y-6">
      <form
        action={createForm}
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2"
      >
        <h3 className="sm:col-span-2 text-sm font-semibold">New booking / waitlist</h3>
        <div className="space-y-1">
          <Label htmlFor="guest_name">Guest</Label>
          <Input id="guest_name" name="guest_name" required className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="party_size">Party size</Label>
          <Input
            id="party_size"
            name="party_size"
            type="number"
            min={1}
            defaultValue={2}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reserved_for">Date & time</Label>
          <Input
            id="reserved_for"
            name="reserved_for"
            type="datetime-local"
            required
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            className="h-9 w-full rounded-md border px-2 text-sm"
            defaultValue="booked"
          >
            <option value="booked">Booked</option>
            <option value="waitlist">Waitlist</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="table_id">Table (optional)</Label>
          <select
            id="table_id"
            name="table_id"
            className="h-9 w-full rounded-md border px-2 text-sm"
            defaultValue=""
          >
            <option value="">—</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" className="h-9" />
        </div>
        {createState.error ? (
          <p className="sm:col-span-2 text-sm text-destructive">
            {createState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={creating} className="sm:col-span-2 w-fit">
          {creating ? "Saving…" : "Save reservation"}
        </Button>
      </form>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {r.guest_name} · {r.party_size} pax
              </p>
              <p className="text-muted-foreground">
                {new Date(r.reserved_for).toLocaleString("en-BT")} · {r.status}
                {r.phone ? ` · ${r.phone}` : ""}
              </p>
            </div>
            <StatusButtons id={r.id} action={statusAction} />
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground">No upcoming reservations.</li>
        ) : null}
      </ul>
    </div>
  );
}

function StatusButtons({ id, action }: { id: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, initial);
  useActionToast(state, { successMessage: state.message ?? "Updated" });
  return (
    <div className="flex flex-wrap gap-1">
      {["seated", "done", "no_show", "cancelled"].map((status) => (
        <form key={status} action={formAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={status} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {status}
          </Button>
        </form>
      ))}
    </div>
  );
}
