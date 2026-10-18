"use client";

import {
  FO_RATE_SHEET_OPTIONS,
  type FoRateSheetOption,
} from "@/lib/ask/fo-rate-sheet";
import type { RateTier } from "@/lib/rates";
import { cn } from "@/lib/utils";

type Value = RateTier | "custom";

/**
 * One FO rate control — sheet tiers only. Custom is an escape hatch (PIN later).
 */
export function FoRateSheetSelect({
  value,
  onChange,
  options = FO_RATE_SHEET_OPTIONS,
  className,
  id = "fo-rate-sheet",
}: {
  value: Value;
  onChange: (next: Value) => void;
  options?: readonly FoRateSheetOption[];
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <label
        htmlFor={id}
        className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Rate
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as Value)}
        className="h-9 min-w-[9rem] rounded-md border border-input bg-background px-2.5 text-sm font-medium shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Rate sheet"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
