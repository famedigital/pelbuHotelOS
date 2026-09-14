"use client";

import {
  decideProvisionalStaff,
  provisionStaffMember,
  type HrActionState,
} from "@/app/actions/erp-hr";
import { DepartmentSelect } from "@/components/erp/DepartmentSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

const selectClass =
  "flex h-11 w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const initial: HrActionState = { ok: false };

function ActionResult({ state }: { state: HrActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      className={`text-sm ${state.ok ? "text-citrus" : "text-destructive"}`}
      role="status"
    >
      {state.error ?? state.message}
    </p>
  );
}

export function ProvisionStaffForm({
  departments = [],
}: {
  departments?: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(provisionStaffMember, initial);
  useActionToast(state, { successMessage: "Staff provisioned" });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="prov_code">Employee code</Label>
          <Input
            id="prov_code"
            name="employee_code"
            required
            placeholder="EMP-010"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="prov_name">Full name</Label>
          <Input id="prov_name" name="full_name" required className="min-h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_role">Role</Label>
          <select
            id="prov_role"
            name="role_label"
            className={selectClass}
            defaultValue="front_desk"
          >
            <option value="front_desk">Front desk</option>
            <option value="reservation">Reservation</option>
            <option value="fnb">F&amp;B</option>
            <option value="kitchen">Kitchen</option>
            <option value="housekeeping">Housekeeping</option>
            <option value="spa">Spa</option>
            <option value="security">Security</option>
            <option value="maintenance">Maintenance</option>
            <option value="manager">Manager</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_dept">Department</Label>
          <DepartmentSelect
            id="prov_dept"
            name="department"
            departments={departments}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_position">Position title</Label>
          <Input
            id="prov_position"
            name="position_title"
            placeholder="Waiter / Room attendant"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_type">Employment type</Label>
          <select
            id="prov_type"
            name="employment_type"
            className={selectClass}
            defaultValue="full_time"
          >
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="casual">Casual</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_hired">Provision date</Label>
          <Input
            id="prov_hired"
            type="date"
            name="hired_on"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_probation">Probation ends</Label>
          <Input
            id="prov_probation"
            type="date"
            name="probation_ends_on"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_phone">Phone</Label>
          <Input id="prov_phone" name="phone" type="tel" className="min-h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prov_wage">Monthly salary (Nu)</Label>
          <Input
            id="prov_wage"
            name="base_wage_btn"
            type="number"
            min={0}
            step="0.01"
            placeholder="Optional — money desk"
            className="min-h-11"
          />
          <p className="text-xs text-muted-foreground">
            Optional at provision. Saving salary needs money desk; else set later
            under Staff → Compensation.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="prov_notes">Notes</Label>
          <Textarea
            id="prov_notes"
            name="notes"
            rows={2}
            placeholder="Offer terms, source of hire, documents pending…"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving…" : "Provision staff"}
        </Button>
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function ProvisionalDecisionForm({
  staffId,
  staffName,
}: {
  staffId: string;
  staffName: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    decideProvisionalStaff,
    initial,
  );
  useActionToast(state, { successMessage: "Decision recorded" });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="staff_id" value={staffId} />
      <p className="text-xs text-muted-foreground">
        Decide outcome for <span className="font-medium text-foreground">{staffName}</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
        <div className="space-y-1">
          <Label htmlFor={`dec-${staffId}`} className="text-xs">
            Outcome
          </Label>
          <select
            id={`dec-${staffId}`}
            name="decision"
            className={selectClass}
            required
            defaultValue="hire"
          >
            <option value="hire">Confirm hire</option>
            <option value="terminate">Terminate</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`eff-${staffId}`} className="text-xs">
            Effective on
          </Label>
          <Input
            id={`eff-${staffId}`}
            type="date"
            name="effective_on"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rsn-${staffId}`} className="text-xs">
            Reason
          </Label>
          <Input
            id={`rsn-${staffId}`}
            name="reason"
            required
            placeholder="Probation passed / did not meet standards"
            className="min-h-11"
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          variant="outline"
          className="self-end min-h-11"
        >
          {pending ? "Saving…" : "Apply"}
        </Button>
      </div>
      <ActionResult state={state} />
    </form>
  );
}
