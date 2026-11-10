import { cn } from "@/lib/utils";

/** Desk KPI figure. Renders the number immediately. */
export function DeskMetricTicker({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return <span className={cn("tracking-tight tabular-nums", className)}>{value}</span>;
}
