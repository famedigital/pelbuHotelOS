"use client";

import {
  reviewTeamLeave,
  type LeaveActionState,
} from "@/app/actions/staff-leave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionState } from "react";

const initialState: LeaveActionState = { ok: false };

export function TeamLeaveReviewForm({ leaveId }: { leaveId: string }) {
  const [state, action, pending] = useActionState(reviewTeamLeave, initialState);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="leave_id" value={leaveId} />
      <Input
        name="decision_notes"
        placeholder="Supervisor note"
        aria-label="Supervisor decision note"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="decision"
          value="approved"
          size="sm"
          disabled={pending}
        >
          Approve to HR
        </Button>
        <Button
          type="submit"
          name="decision"
          value="denied"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Deny
        </Button>
      </div>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : state.message ? (
        <p className="text-xs text-emerald-700">{state.message}</p>
      ) : null}
    </form>
  );
}
