"use client";

import { requestOwnLeave, type LeaveActionState } from "@/app/actions/staff-leave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useMemo, useState } from "react";

export type StaffLeavePolicyOption = {
  id: string;
  code: string;
  name: string;
  allowHalfDay: boolean;
  noticeDays: number;
  evidenceAfterDays: number | null;
  balanceDays: number | null;
};

const initialState: LeaveActionState = { ok: false };
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function StaffLeaveRequestForm({
  policies,
}: {
  policies: StaffLeavePolicyOption[];
}) {
  const [state, action, pending] = useActionState(requestOwnLeave, initialState);
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const selected = useMemo(
    () => policies.find((policy) => policy.id === policyId),
    [policies, policyId],
  );

  if (!policies.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No active leave policies are available. Contact HR.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="leave-policy">Leave type</Label>
        <select
          id="leave-policy"
          name="leave_policy_id"
          value={policyId}
          onChange={(event) => setPolicyId(event.target.value)}
          className={selectClass}
          required
        >
          {policies.map((policy) => (
            <option key={policy.id} value={policy.id}>
              {policy.name}
              {policy.balanceDays == null
                ? ""
                : ` · ${policy.balanceDays.toFixed(1)} days available`}
            </option>
          ))}
        </select>
        {selected ? (
          <p className="text-xs text-muted-foreground">
            {selected.noticeDays > 0
              ? `${selected.noticeDays} days’ advance notice normally required. `
              : ""}
            {selected.evidenceAfterDays != null
              ? `Evidence required from ${selected.evidenceAfterDays} day(s).`
              : ""}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="leave-start">Start date</Label>
          <Input id="leave-start" name="starts_on" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leave-end">End date</Label>
          <Input id="leave-end" name="ends_on" type="date" required />
        </div>
      </div>

      {selected?.allowHalfDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="leave-start-period">First day</Label>
            <select
              id="leave-start-period"
              name="start_period"
              className={selectClass}
              defaultValue="full"
            >
              <option value="full">Full day</option>
              <option value="am">Morning half</option>
              <option value="pm">Afternoon half</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leave-end-period">Last day</Label>
            <select
              id="leave-end-period"
              name="end_period"
              className={selectClass}
              defaultValue="full"
            >
              <option value="full">Full day</option>
              <option value="am">Morning half</option>
              <option value="pm">Afternoon half</option>
            </select>
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="start_period" value="full" />
          <input type="hidden" name="end_period" value="full" />
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="leave-notes">Reason / handover note</Label>
        <Textarea id="leave-notes" name="notes" rows={3} maxLength={2000} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="leave-attachment">Evidence (optional unless required)</Label>
        <Input
          id="leave-attachment"
          name="attachment"
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
        />
        <p className="text-xs text-muted-foreground">
          Private PDF or image, maximum 10 MB.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit leave request"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : state.message ? (
        <div className="space-y-1 text-sm text-emerald-700">
          <p>{state.message}</p>
          {state.warnings?.map((warning) => (
            <p key={warning} className="text-amber-700">
              Coverage: {warning}
            </p>
          ))}
        </div>
      ) : null}
    </form>
  );
}
