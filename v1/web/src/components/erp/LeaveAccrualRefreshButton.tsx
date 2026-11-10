"use client";

import {
  refreshLeaveAccruals,
  type LeaveActionState,
} from "@/app/actions/staff-leave";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";

const initialState: LeaveActionState = { ok: false };

export function LeaveAccrualRefreshButton() {
  const [state, action, pending] = useActionState(
    refreshLeaveAccruals,
    initialState,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Refreshing…" : "Refresh statutory accruals"}
      </Button>
      {state.error ? (
        <span className="text-sm text-destructive">{state.error}</span>
      ) : state.message ? (
        <span className="text-sm text-emerald-700">{state.message}</span>
      ) : null}
    </form>
  );
}
