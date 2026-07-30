"use client";

import {
  createLeavePolicyVersion,
  type LeaveActionState,
} from "@/app/actions/staff-leave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initialState: LeaveActionState = { ok: false };

export function LeavePolicyVersionForm({
  policy,
}: {
  policy: {
    id: string;
    name: string;
    accrualDays: number;
    noticeDays: number;
    paidRate: number;
    allowHalfDay: boolean;
    encashable: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    createLeavePolicyVersion,
    initialState,
  );

  return (
    <details className="min-w-48">
      <summary className="cursor-pointer text-xs font-medium text-accent">
        New version
      </summary>
      <form action={action} className="mt-3 w-72 space-y-3 rounded-md border bg-background p-3">
        <input type="hidden" name="policy_id" value={policy.id} />
        <p className="text-xs font-medium">{policy.name}</p>
        <div className="space-y-1">
          <Label htmlFor={`effective-${policy.id}`} className="text-xs">
            Effective from
          </Label>
          <Input
            id={`effective-${policy.id}`}
            name="effective_from"
            type="date"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`days-${policy.id}`} className="text-xs">
              Days
            </Label>
            <Input
              id={`days-${policy.id}`}
              name="accrual_days"
              type="number"
              min="0"
              max="365"
              step="0.5"
              defaultValue={policy.accrualDays}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`notice-${policy.id}`} className="text-xs">
              Notice days
            </Label>
            <Input
              id={`notice-${policy.id}`}
              name="notice_days"
              type="number"
              min="0"
              max="365"
              defaultValue={policy.noticeDays}
              required
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pay-${policy.id}`} className="text-xs">
            Paid rate (0–1)
          </Label>
          <Input
            id={`pay-${policy.id}`}
            name="paid_rate"
            type="number"
            min="0"
            max="1"
            step="0.01"
            defaultValue={policy.paidRate}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="allow_half_day"
            defaultChecked={policy.allowHalfDay}
          />
          Allow half-days
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="encashable"
            defaultChecked={policy.encashable}
          />
          Encashable
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Create version"}
        </Button>
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : state.message ? (
          <p className="text-xs text-emerald-700">{state.message}</p>
        ) : null}
      </form>
    </details>
  );
}
