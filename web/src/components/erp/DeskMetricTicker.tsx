"use client";

import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

/**
 * Animate simple numeric KPI strings. Non-numeric / compound values render as-is.
 */
export function DeskMetricTicker({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return (
      <NumberTicker
        value={Number(trimmed)}
        className={cn("tracking-tight", className)}
      />
    );
  }
  const money = trimmed.match(/^(BTN|Nu)\s+([\d,]+(?:\.\d+)?)$/i);
  if (money) {
    const n = Number(money[2].replace(/,/g, ""));
    if (!Number.isNaN(n)) {
      return (
        <span className={cn("inline-flex items-baseline gap-1", className)}>
          <span className="text-[0.65em] font-medium opacity-80">{money[1]}</span>
          <NumberTicker value={n} decimalPlaces={n % 1 ? 2 : 0} className="tracking-tight" />
        </span>
      );
    }
  }
  return <span className={className}>{value}</span>;
}
