"use client";

import { Combobox } from "@/components/ui/combobox";
import { useMemo } from "react";

export type BookableStaff = {
  id: string;
  full_name: string;
  employee_code?: string | null;
  role_label?: string | null;
};

/**
 * Searchable staff picker for sales claims ("Sold by").
 * Clearable — no claim when empty.
 */
export function StaffPicker({
  staff,
  value,
  onValueChange,
  name = "sold_by_staff_id",
  disabled,
  placeholder = "— No sales claim —",
  className,
}: {
  staff: BookableStaff[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const options = useMemo(
    () =>
      [...staff]
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((s) => ({
          value: s.id,
          label: s.full_name,
          hint: [s.employee_code, s.role_label].filter(Boolean).join(" · "),
        })),
    [staff],
  );

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Combobox
        options={options}
        value={value || null}
        onValueChange={onValueChange}
        placeholder={placeholder}
        searchPlaceholder="Search staff…"
        allowClear
        clearLabel={placeholder}
        disabled={disabled}
        className={className}
      />
    </>
  );
}
