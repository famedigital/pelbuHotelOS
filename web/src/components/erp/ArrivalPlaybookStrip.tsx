"use client";

import type { ArrivalPlaybookStep } from "@/lib/folio/fo-settlement";
import { cn } from "@/lib/utils";

/** Compact Assign → CI → Reg → Settle strip for Today / Arrivals. */
export function ArrivalPlaybookStrip({
  steps,
  className,
}: {
  steps: ArrivalPlaybookStep[];
  className?: string;
}) {
  if (!steps.length) return null;
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1 text-[10px] font-medium",
        className,
      )}
      aria-label="Arrival playbook"
    >
      {steps.map((step, i) => (
        <li key={step.id} className="flex items-center gap-1">
          {i > 0 ? (
            <span className="text-muted-foreground/50" aria-hidden>
              →
            </span>
          ) : null}
          <span
            className={cn(
              "rounded px-1.5 py-0.5",
              step.done && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
              step.current &&
                !step.done &&
                "bg-citrus/20 text-foreground ring-1 ring-citrus/40",
              !step.done &&
                !step.current &&
                "bg-muted/40 text-muted-foreground",
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
