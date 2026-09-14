"use client";

import {
  createAgentCallTask,
  type AgentCallActionState,
} from "@/app/actions/erp-agent-call-tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

const initial: AgentCallActionState = { ok: true };

export function CreateAgentCallTaskForm({
  defaultDue,
  defaultStayFrom,
  defaultStayTo,
}: {
  defaultDue: string;
  defaultStayFrom: string;
  defaultStayTo: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createAgentCallTask, initial);

  useEffect(() => {
    if (state.ok && state.taskId) {
      router.push(`/erp/agents/call-tasks/${state.taskId}`);
    }
  }, [state, router]);

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border bg-card p-4 shadow-xs"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">New call task</p>
        <p className="text-xs text-muted-foreground">
          Owner / GM only. FO sees due tasks on their dashboard and ticks each
          agent after calling.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="call-title">Title</Label>
        <Input
          id="call-title"
          name="title"
          required
          placeholder="e.g. Reconfirm August agent groups"
          className="h-9"
          disabled={pending}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="call-due">FO due date</Label>
          <Input
            id="call-due"
            type="date"
            name="due_date"
            required
            defaultValue={defaultDue}
            className="h-9"
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="call-stay-from">Stay window from</Label>
          <Input
            id="call-stay-from"
            type="date"
            name="stay_from"
            required
            defaultValue={defaultStayFrom}
            className="h-9"
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="call-stay-to">Stay window to</Label>
          <Input
            id="call-stay-to"
            type="date"
            name="stay_to"
            required
            defaultValue={defaultStayTo}
            className="h-9"
            disabled={pending}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="call-notes">Instructions (optional)</Label>
        <textarea
          id="call-notes"
          name="notes"
          rows={2}
          placeholder="Script: reconfirm arrival times, meal plan, guides…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Agents with confirmed / in-house rooms overlapping the stay window are
        added automatically (phone + email snapshot).
      </p>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create call task"}
      </Button>
    </form>
  );
}
