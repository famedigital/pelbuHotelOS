"use client";

import { upsertStaffMember, type HrActionState } from "@/app/actions/erp-hr";
import { DepartmentSelect } from "@/components/erp/DepartmentSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { mergeDepartmentOptions } from "@/lib/hr/departments";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

const selectClass =
  "flex h-11 w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type DraftRow = {
  key: string;
  employee_code: string;
  full_name: string;
  role_label: string;
  department: string;
  position_title: string;
  employment_type: string;
  phone: string;
};

function emptyRow(): DraftRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employee_code: "",
    full_name: "",
    role_label: "front_desk",
    department: "",
    position_title: "",
    employment_type: "full_time",
    phone: "",
  };
}

const initial: HrActionState = { ok: false };

export function StaffInlineAddTable({
  departments = [],
}: {
  /** Property-used departments (defaults are merged in DepartmentSelect). */
  departments?: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);
  /** Newly named departments this session (shared across hire rows). */
  const [sessionDepartments, setSessionDepartments] = useState<string[]>([]);
  const [state, action, pending] = useActionState(upsertStaffMember, initial);
  useActionToast(state, { successMessage: "Staff added" });

  const departmentOptions = useMemo(
    () => mergeDepartmentOptions(departments, sessionDepartments),
    [departments, sessionDepartments],
  );

  useEffect(() => {
    if (state.ok) {
      setRows([emptyRow()]);
      router.refresh();
    }
  }, [state.ok, router]);

  function update(key: string, field: keyof DraftRow, value: string) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  function setDepartment(key: string, value: string) {
    update(key, "department", value);
    const trimmed = value.trim();
    if (
      trimmed &&
      !departmentOptions.some((d) => d.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSessionDepartments((prev) => [...prev, trimmed]);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add one or more staff — desktop shows a compact grid; on phones each
        hire is a stacked card. Save one row at a time. CSV import remains
        available for sheets.
      </p>

      {/* Mobile cards */}
      <div className="space-y-4 md:hidden">
        {rows.map((row, index) => (
          <article
            key={row.key}
            className="space-y-3 rounded-xl border bg-card p-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                New hire {index + 1}
              </p>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11"
                  onClick={() =>
                    setRows((prev) => prev.filter((r) => r.key !== row.key))
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <HireForm
              row={row}
              action={action}
              pending={pending}
              onChange={update}
              onDepartmentChange={setDepartment}
              departments={departmentOptions}
            />
          </article>
        ))}
      </div>

      {/* Desktop grid */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
              <th className="p-2 font-semibold">Code</th>
              <th className="p-2 font-semibold">Name</th>
              <th className="p-2 font-semibold">Role</th>
              <th className="p-2 font-semibold">Department</th>
              <th className="p-2 font-semibold">Position</th>
              <th className="p-2 font-semibold">Employment</th>
              <th className="p-2 font-semibold">Phone</th>
              <th className="p-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t align-top">
                <td className="p-1.5">
                  <Input
                    value={row.employee_code}
                    onChange={(e) => update(row.key, "employee_code", e.target.value)}
                    placeholder="EMP-0001"
                    className="h-11 font-mono text-xs"
                    form={`hire-${row.key}`}
                    name="employee_code"
                    required
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    value={row.full_name}
                    onChange={(e) => update(row.key, "full_name", e.target.value)}
                    className="h-11"
                    form={`hire-${row.key}`}
                    name="full_name"
                    required
                  />
                </td>
                <td className="p-1.5">
                  <select
                    value={row.role_label}
                    onChange={(e) => update(row.key, "role_label", e.target.value)}
                    className={selectClass}
                    form={`hire-${row.key}`}
                    name="role_label"
                  >
                    <RoleOptions />
                  </select>
                </td>
                <td className="p-1.5 min-w-[11rem]">
                  <DepartmentSelect
                    id={`${row.key}-dept-grid`}
                    form={`hire-${row.key}`}
                    value={row.department}
                    onChange={(value) => setDepartment(row.key, value)}
                    departments={departmentOptions}
                    compact
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    value={row.position_title}
                    onChange={(e) =>
                      update(row.key, "position_title", e.target.value)
                    }
                    className="h-11"
                    form={`hire-${row.key}`}
                    name="position_title"
                  />
                </td>
                <td className="p-1.5">
                  <select
                    value={row.employment_type}
                    onChange={(e) =>
                      update(row.key, "employment_type", e.target.value)
                    }
                    className={selectClass}
                    form={`hire-${row.key}`}
                    name="employment_type"
                  >
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="casual">Casual</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </td>
                <td className="p-1.5">
                  <Input
                    value={row.phone}
                    onChange={(e) => update(row.key, "phone", e.target.value)}
                    className="h-11"
                    form={`hire-${row.key}`}
                    name="phone"
                    type="tel"
                  />
                </td>
                <td className="p-1.5">
                  <form id={`hire-${row.key}`} action={action}>
                    <Button
                      type="submit"
                      variant="citrus"
                      size="sm"
                      className="h-11"
                      disabled={pending}
                    >
                      {pending ? "…" : "Save"}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
        >
          Add another row
        </Button>
      </div>

      {state.error || state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}>
          {state.message ?? state.error}
        </p>
      ) : null}
    </div>
  );
}

function HireForm({
  row,
  action,
  pending,
  onChange,
  onDepartmentChange,
  departments,
}: {
  row: DraftRow;
  action: (payload: FormData) => void;
  pending: boolean;
  onChange: (key: string, field: keyof DraftRow, value: string) => void;
  onDepartmentChange: (key: string, value: string) => void;
  departments: string[];
}) {
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${row.key}-code`}>Employee code</Label>
          <Input
            id={`${row.key}-code`}
            name="employee_code"
            value={row.employee_code}
            onChange={(e) => onChange(row.key, "employee_code", e.target.value)}
            required
            className="h-11 font-mono"
            autoCapitalize="characters"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${row.key}-name`}>Full name</Label>
          <Input
            id={`${row.key}-name`}
            name="full_name"
            value={row.full_name}
            onChange={(e) => onChange(row.key, "full_name", e.target.value)}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${row.key}-role`}>Role</Label>
          <select
            id={`${row.key}-role`}
            name="role_label"
            value={row.role_label}
            onChange={(e) => onChange(row.key, "role_label", e.target.value)}
            className={selectClass}
          >
            <RoleOptions />
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${row.key}-dept`}>Department</Label>
          <DepartmentSelect
            id={`${row.key}-dept`}
            value={row.department}
            onChange={(value) => onDepartmentChange(row.key, value)}
            departments={departments}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${row.key}-pos`}>Position</Label>
          <Input
            id={`${row.key}-pos`}
            name="position_title"
            value={row.position_title}
            onChange={(e) => onChange(row.key, "position_title", e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${row.key}-emp`}>Employment</Label>
          <select
            id={`${row.key}-emp`}
            name="employment_type"
            value={row.employment_type}
            onChange={(e) => onChange(row.key, "employment_type", e.target.value)}
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
          <Label htmlFor={`${row.key}-phone`}>Phone</Label>
          <Input
            id={`${row.key}-phone`}
            name="phone"
            type="tel"
            value={row.phone}
            onChange={(e) => onChange(row.key, "phone", e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <Button type="submit" variant="citrus" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : "Save hire"}
      </Button>
    </form>
  );
}

function RoleOptions() {
  return (
    <>
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
    </>
  );
}
