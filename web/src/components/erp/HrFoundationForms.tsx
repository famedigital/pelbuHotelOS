"use client";

import {
  changeStaffStatus,
  createHrAnnouncement,
  importStaffCsv,
  upsertStaffMember,
  type HrActionState,
} from "@/app/actions/erp-hr";
import { reviewLeaveStage } from "@/app/actions/staff-leave";
import { DepartmentSelect } from "@/components/erp/DepartmentSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState, useState } from "react";

const initialState: HrActionState = { ok: false };
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type StaffChoice = {
  id: string;
  employeeCode: string;
  name: string;
  role: string;
};

function ActionResult({ state }: { state: HrActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <div
      role="status"
      className={`rounded-md border px-3 py-2 text-sm ${
        state.ok
          ? "border-border bg-muted/40 text-foreground"
          : "border-destructive/30 bg-destructive/5 text-destructive"
      }`}
    >
      <p>{state.message ?? state.error}</p>
      {state.details?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          {state.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function StaffCreateForm({
  departments = [],
}: {
  departments?: string[];
}) {
  const [state, action, pending] = useActionState(upsertStaffMember, initialState);
  useActionToast(state, { successMessage: "Staff member added" });

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="employee_code">Employee code</Label>
          <Input
            id="employee_code"
            name="employee_code"
            placeholder="EMP-0001"
            autoCapitalize="characters"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hr_full_name">Full name</Label>
          <Input id="hr_full_name" name="full_name" autoComplete="name" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="hr_role">Operational role</Label>
          <select id="hr_role" name="role_label" className={selectClass}>
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
          <Label htmlFor="department">Department</Label>
          <DepartmentSelect
            id="department"
            name="department"
            departments={departments}
            selectClassName={selectClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="position_title">Position</Label>
          <Input id="position_title" name="position_title" placeholder="Duty manager" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="employment_type">Employment</Label>
          <select
            id="employment_type"
            name="employment_type"
            className={selectClass}
          >
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="casual">Casual</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hr_hired_on">Hired on</Label>
          <Input id="hr_hired_on" name="hired_on" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hr_phone">Phone</Label>
          <Input id="hr_phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hr_email">Email</Label>
          <Input id="hr_email" name="email" type="email" autoComplete="email" />
        </div>
      </div>
      <Button type="submit" variant="citrus" disabled={pending}>
        {pending ? "Adding…" : "Add staff member"}
      </Button>
      <ActionResult state={state} />
    </form>
  );
}

export function StaffCsvImportForm() {
  const [state, action, pending] = useActionState(importStaffCsv, initialState);
  useActionToast(state, { successMessage: "Staff CSV imported" });

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Create or update up to 500 employees by employee code. The import is rejected
        as a whole when any row is invalid.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="staff_csv">CSV file</Label>
        <Input id="staff_csv" name="file" type="file" accept=".csv,text/csv" required />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Validating…" : "Import staff"}
        </Button>
        <Button asChild type="button" variant="outline">
          <a href="/templates/staff-import.csv" download>
            Download template
          </a>
        </Button>
      </div>
      <ActionResult state={state} />
    </form>
  );
}

export function StaffStatusForm({ staff }: { staff: StaffChoice[] }) {
  const [state, action, pending] = useActionState(changeStaffStatus, initialState);
  useActionToast(state, { successMessage: "Staff status updated" });

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1.3fr_1fr_2fr_auto]">
      <div className="space-y-1.5">
        <Label htmlFor="status_staff">Staff member</Label>
        <select id="status_staff" name="staff_id" className={selectClass} required>
          <option value="">Select staff…</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.employeeCode} · {person.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff_status">New status</Label>
        <select id="staff_status" name="status" className={selectClass}>
          <option value="provisional">Provisional</option>
          <option value="active">Active (hired)</option>
          <option value="on_leave">On leave</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status_reason">Reason</Label>
        <Input id="status_reason" name="reason" required />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="self-end">
        {pending ? "Updating…" : "Update"}
      </Button>
      <div className="sm:col-span-4">
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function AnnouncementCreateForm({
  staff,
  departments,
}: {
  staff: StaffChoice[];
  departments: string[];
}) {
  const [state, action, pending] = useActionState(
    createHrAnnouncement,
    initialState,
  );
  const [audience, setAudience] = useState("all");
  useActionToast(state, { successMessage: "Notice saved" });

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="notice_title">Title</Label>
          <Input id="notice_title" name="title" maxLength={160} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notice_category">Category</Label>
          <select id="notice_category" name="category" className={selectClass}>
            <option value="company">Company</option>
            <option value="hr">HR</option>
            <option value="policy">Policy</option>
            <option value="operations">Operations</option>
            <option value="work_order">Work order</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notice_priority">Priority</Label>
          <select id="notice_priority" name="priority" className={selectClass}>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notice_body">Message</Label>
        <Textarea
          id="notice_body"
          name="body"
          rows={6}
          maxLength={10000}
          placeholder="Write the information staff need, including the action and deadline."
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="audience_kind">Audience</Label>
          <select
            id="audience_kind"
            name="audience_kind"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            className={selectClass}
          >
            <option value="all">All active staff</option>
            <option value="department">Department</option>
            <option value="role">Operational role</option>
            <option value="selected">Selected staff</option>
          </select>
        </div>
        {audience === "department" ? (
          <div className="space-y-1.5">
            <Label htmlFor="notice_department">Department</Label>
            <DepartmentSelect
              id="notice_department"
              name="audience_value"
              departments={departments}
              required
              allowEmpty
              emptyLabel="Select department…"
              selectClassName={selectClass}
            />
          </div>
        ) : null}
        {audience === "role" ? (
          <div className="space-y-1.5">
            <Label htmlFor="notice_role">Role</Label>
            <select id="notice_role" name="audience_value" className={selectClass}>
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
        ) : null}
      </div>
      {audience === "selected" ? (
        <fieldset className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Select recipients</legend>
          <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
            {staff.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  name="selected_staff_ids"
                  value={person.id}
                  className="size-4"
                />
                <span>
                  {person.name}{" "}
                  <span className="text-muted-foreground">· {person.role}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requires_acknowledgement" className="size-4" />
          Require acknowledgement
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_pinned" className="size-4" />
          Pin to top
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="publish_now"
            defaultChecked
            className="size-4"
          />
          Publish now
        </label>
      </div>
      <Button type="submit" variant="citrus" disabled={pending}>
        {pending ? "Saving notice…" : "Save notice"}
      </Button>
      <ActionResult state={state} />
    </form>
  );
}

export function LeaveReviewForm({ leaveId }: { leaveId: string }) {
  const [state, action, pending] = useActionState(reviewLeaveStage, initialState);
  useActionToast(state, { successMessage: "Leave request reviewed" });

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="leave_id" value={leaveId} />
      <div className="min-w-36 flex-1 space-y-1">
        <Label htmlFor={`decision_notes_${leaveId}`} className="text-xs">
          Decision note
        </Label>
        <Input id={`decision_notes_${leaveId}`} name="decision_notes" />
      </div>
      <Button
        type="submit"
        name="decision"
        value="approved"
        size="sm"
        disabled={pending}
      >
        Approve
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
      {state.error ? (
        <p className="basis-full text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
