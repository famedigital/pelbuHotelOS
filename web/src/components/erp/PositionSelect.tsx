"use client";

import {
  findStaffPosition,
  positionsForDepartment,
} from "@/lib/hr/positions";

const defaultSelectClass =
  "flex h-11 w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type Props = {
  id?: string;
  name?: string;
  department: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  form?: string;
};

/** Positions for the selected department. Catalog titles set desk access on save. */
export function PositionSelect({
  id,
  name = "position_title",
  department,
  value,
  onChange,
  className,
  form,
}: Props) {
  const positions = positionsForDepartment(department);
  const known = positions.some(
    (p) => p.title.toLowerCase() === value.trim().toLowerCase(),
  );
  const match = findStaffPosition(department, value);

  return (
    <div className="space-y-1">
      <select
        id={id}
        name={name}
        form={form}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className ?? defaultSelectClass}
        disabled={!department.trim()}
      >
        <option value="">
          {department.trim() ? "Select position…" : "Select a department first"}
        </option>
        {value.trim() && !known ? (
          <option value={value}>{value}</option>
        ) : null}
        {positions.map((p) => (
          <option key={`${p.department}:${p.title}`} value={p.title}>
            {p.title}
          </option>
        ))}
      </select>
      {match ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {positionHint(match.title, match.modules)}
        </p>
      ) : null}
    </div>
  );
}

function positionHint(
  title: string,
  modules: "full" | "defaults" | "none",
): string {
  if (modules === "full") {
    return `${title} gets the full desk — every module.`;
  }
  if (modules === "none") {
    return `${title} stays off the hotel desk.`;
  }
  return `${title} gets that role’s default screens.`;
}
