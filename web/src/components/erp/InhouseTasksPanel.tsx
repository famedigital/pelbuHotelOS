"use client";

import {
  completeInhouseTask,
  createInhouseTask,
  type InhouseTaskState,
} from "@/app/actions/erp-inhouse-tasks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState } from "react";

const createInitial: InhouseTaskState = { ok: false };
const doneInitial: InhouseTaskState = { ok: false };

export type InhouseTaskRow = {
  id: string;
  due_at: string;
  kind: string;
  notes: string | null;
  booking_id: string | null;
  guest: string | null;
  room: string | null;
};

export function InhouseTasksPanel({
  tasks,
  bookingOptions,
}: {
  tasks: InhouseTaskRow[];
  bookingOptions: { id: string; label: string }[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createInhouseTask,
    createInitial,
  );
  const [doneState, doneAction, donePending] = useActionState(
    completeInhouseTask,
    doneInitial,
  );
  useActionToast(createState, { successMessage: "Task scheduled" });
  useActionToast(doneState, { successMessage: "Task done" });

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          Wake-up &amp; timed tasks
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Open calls and reminders for in-house guests.
        </p>
      </div>

      {(createState.error || doneState.error) && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>
            {createState.error ?? doneState.error}
          </AlertDescription>
        </Alert>
      )}

      <form action={createAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Guest stay</span>
          <select
            name="booking_id"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue=""
          >
            <option value="">— Optional —</option>
            {bookingOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Due</span>
          <Input type="datetime-local" name="due_at" required className="h-10" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Kind</span>
          <select
            name="kind"
            defaultValue="wake_up"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="wake_up">Wake-up</option>
            <option value="callback">Callback</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground">Notes</span>
          <Input name="notes" placeholder="Room 204 · 6:30 am" className="h-10" />
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={createPending} className="h-10 w-full">
            {createPending ? "Saving…" : "Add task"}
          </Button>
        </div>
      </form>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open tasks.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium capitalize">
                  {t.kind.replace(/_/g, " ")}
                  {t.guest ? ` · ${t.guest}` : ""}
                  {t.room ? ` · ${t.room}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(t.due_at).toLocaleString("en-BT")}
                  {t.notes ? ` · ${t.notes}` : ""}
                </p>
              </div>
              <form action={doneAction}>
                <input type="hidden" name="task_id" value={t.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={donePending}
                >
                  Done
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Compact create form for calendar reservation edit dialog. */
export function InhouseTaskQuickForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    createInhouseTask,
    createInitial,
  );
  useActionToast(state, { successMessage: "Wake-up scheduled" });

  return (
    <form action={action} className="space-y-2 rounded-md border p-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="kind" value="wake_up" />
      <Label className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
        Schedule wake-up
      </Label>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      <Input type="datetime-local" name="due_at" required className="h-9" />
      <Input name="notes" placeholder="Notes" className="h-9" />
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Add wake-up"}
      </Button>
    </form>
  );
}
