"use client";

import {
  completeInhouseTask,
  createInhouseTask,
  type InhouseTaskState,
} from "@/app/actions/erp-inhouse-tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INHOUSE_TASK_KINDS,
  labelInhouseTaskKind,
} from "@/lib/inhouse-task-kinds";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

const createInitial: InhouseTaskState = { ok: false };
const doneInitial: InhouseTaskState = { ok: false };

export type StayHubTaskRow = {
  id: string;
  due_at: string;
  kind: string;
  notes: string | null;
  done_at: string | null;
};

/**
 * Compact wake-up / follow-up / guest message / desk request on this stay.
 */
export function StayHubTasksPanel({
  bookingId,
  tasks,
  onChanged,
}: {
  bookingId: string;
  tasks: StayHubTaskRow[];
  onChanged: () => void;
}) {
  const [createState, createAction, createPending] = useActionState(
    createInhouseTask,
    createInitial,
  );
  const [doneState, doneAction, donePending] = useActionState(
    completeInhouseTask,
    doneInitial,
  );

  useEffect(() => {
    if (createState.ok) {
      toast.success("Request scheduled");
      onChanged();
    } else if (createState.error) {
      toast.error(createState.error);
    }
  }, [createState, onChanged]);

  useEffect(() => {
    if (doneState.ok) {
      toast.success("Marked done");
      onChanged();
    } else if (doneState.error) {
      toast.error(doneState.error);
    }
  }, [doneState, onChanged]);

  const open = tasks.filter((t) => !t.done_at);
  const closed = tasks.filter((t) => t.done_at).slice(0, 5);

  return (
    <div className="space-y-2">
      <form action={createAction} className="grid gap-2 sm:grid-cols-3">
        <input type="hidden" name="booking_id" value={bookingId} />
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Kind
          </Label>
          <select
            name="kind"
            defaultValue="wake_up"
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {INHOUSE_TASK_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Due
          </Label>
          <Input
            type="datetime-local"
            name="due_at"
            required
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-0.5 sm:col-span-3">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Notes
          </Label>
          <Input
            name="notes"
            className="h-8 text-xs"
            placeholder="Wake time message, follow-up, guest preference…"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8 sm:col-span-3 sm:w-fit"
          disabled={createPending}
        >
          {createPending ? "Saving…" : "Add request"}
        </Button>
      </form>

      {open.length > 0 ? (
        <ul className="space-y-1 border-t border-border/50 pt-2">
          {open.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
            >
              <span>
                <span className="font-medium">
                  {labelInhouseTaskKind(t.kind)}
                </span>
                {" · "}
                {t.due_at.slice(0, 16).replace("T", " ")}
                {t.notes ? ` · ${t.notes}` : ""}
              </span>
              <form action={doneAction}>
                <input type="hidden" name="task_id" value={t.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={donePending}
                >
                  Done
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No open wake-ups or guest requests on this stay.
        </p>
      )}

      {closed.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Recent done:{" "}
          {closed
            .map((t) => labelInhouseTaskKind(t.kind))
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}
