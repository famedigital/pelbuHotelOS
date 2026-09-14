"use client";

import { assignHkStaff, type InvState } from "@/app/actions/erp-inventory";
import { Button } from "@/components/ui/button";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { useActionState } from "react";

const initial: InvState = { ok: false };

const selectClass =
  "min-h-11 w-full min-w-[140px] rounded-md border border-input bg-transparent px-2 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function HkStaffAssignForm({
  assignmentId,
  staffId,
  staff,
  status,
}: {
  assignmentId: string;
  staffId: string | null;
  staff: { id: string; full_name: string }[];
  status: string;
}) {
  const [state, action, pending] = useActionState(assignHkStaff, initial);
  const locked = status === "done" || status === "skipped";
  usePendingFeedback(pending, "Assigning attendant…");

  return (
    <form action={action} className="erp flex flex-wrap items-center gap-2">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <select
        name="staff_id"
        defaultValue={staffId ?? ""}
        disabled={locked}
        className={selectClass}
        aria-label="Assign attendant"
      >
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name}
          </option>
        ))}
      </select>
      {!locked ? (
        <Button type="submit" size="sm" disabled={pending} className="h-11 shrink-0">
          {pending ? "…" : "Assign"}
        </Button>
      ) : null}
      {state.error ? (
        <span className="w-full text-xs text-destructive" role="alert">
          {state.error}
        </span>
      ) : null}
      {state.message && !state.error ? (
        <span className="w-full text-xs text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  );
}
