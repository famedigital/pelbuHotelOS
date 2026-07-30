"use client";

import {
  createLeaveBlackout,
  type LeaveActionState,
} from "@/app/actions/staff-leave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initialState: LeaveActionState = { ok: false };
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function LeaveBlackoutForm({
  policies,
  departments,
}: {
  policies: Array<{ id: string; name: string }>;
  departments: string[];
}) {
  const [state, action, pending] = useActionState(createLeaveBlackout, initialState);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="blackout-name">Name</Label>
          <Input id="blackout-name" name="name" placeholder="Peak festival week" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="blackout-reason">Reason</Label>
          <Input id="blackout-reason" name="reason" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="blackout-start">Start</Label>
          <Input id="blackout-start" name="starts_on" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="blackout-end">End</Label>
          <Input id="blackout-end" name="ends_on" type="date" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="blackout-department">Department (optional)</Label>
          <select id="blackout-department" name="department" className={selectClass}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="blackout-policy">Leave policy (optional)</Label>
          <select id="blackout-policy" name="leave_policy_id" className={selectClass}>
            <option value="">All leave types</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_hard_block" />
        Block requests instead of showing a coverage warning
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Add blackout period"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : state.message ? (
        <p className="text-sm text-emerald-700">{state.message}</p>
      ) : null}
    </form>
  );
}
