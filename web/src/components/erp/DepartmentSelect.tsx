"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mergeDepartmentOptions } from "@/lib/hr/departments";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const ADD_VALUE = "__add_department__";

const defaultSelectClass =
  "flex h-11 w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type DepartmentSelectProps = {
  id?: string;
  name?: string;
  /** Controlled value written to `staff_members.department` (or form field). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Property-used departments (merged with defaults inside). */
  departments?: readonly string[];
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
  /** HTML form attribute when controls live outside the form (desk hire grid). */
  form?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  compact?: boolean;
};

/**
 * Department dropdown: defaults + property-used + session-added,
 * with "+ Add department…" for free-text not yet on the list.
 */
export function DepartmentSelect({
  id,
  name = "department",
  value: valueProp,
  defaultValue = "",
  onChange,
  departments = [],
  className,
  selectClassName,
  inputClassName,
  form,
  required,
  allowEmpty = true,
  emptyLabel = "Select department…",
  disabled,
  compact = false,
}: DepartmentSelectProps) {
  const isControlled = valueProp !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = isControlled ? (valueProp ?? "") : uncontrolled;
  const [session, setSession] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const options = useMemo(
    () =>
      mergeDepartmentOptions(departments, session, value ? [value] : []),
    [departments, session, value],
  );

  function setValue(next: string) {
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
  }

  function commitNew() {
    const next = draft.trim();
    if (!next) {
      setAdding(false);
      setDraft("");
      return;
    }
    setSession((prev) =>
      prev.some((d) => d.toLowerCase() === next.toLowerCase())
        ? prev
        : [...prev, next],
    );
    setValue(next);
    setAdding(false);
    setDraft("");
  }

  function cancelAdd() {
    setAdding(false);
    setDraft("");
  }

  const selectValue = adding ? ADD_VALUE : value;

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5", className)}>
      {name ? (
        <input
          type="hidden"
          name={name}
          form={form}
          value={value}
          required={Boolean(required) && !value}
        />
      ) : null}
      <select
        id={id}
        value={selectValue}
        disabled={disabled}
        className={cn(defaultSelectClass, selectClassName)}
        aria-label={id ? undefined : "Department"}
        onChange={(event) => {
          const next = event.target.value;
          if (next === ADD_VALUE) {
            setAdding(true);
            setDraft("");
            return;
          }
          setAdding(false);
          setValue(next);
        }}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
        <option value={ADD_VALUE}>+ Add department…</option>
      </select>
      {adding ? (
        <div
          className={cn(
            "flex gap-1.5",
            compact ? "flex-col sm:flex-row" : "flex-row flex-wrap",
          )}
        >
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitNew();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelAdd();
              }
            }}
            placeholder="New department name"
            className={cn("h-11 min-w-0 flex-1", inputClassName)}
            aria-label="New department name"
            required={Boolean(required) && !value}
          />
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={commitNew}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={cancelAdd}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
