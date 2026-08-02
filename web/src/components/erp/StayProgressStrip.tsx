"use client";

import type { StayHubStep } from "@/lib/folio/stay-hub-cycle";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

/**
 * Segmented lifecycle track for Stay hub — denser, in muted pill container.
 */
export function StayProgressStrip({
  steps,
  activePanel,
  terminal,
  onStepClick,
  className,
}: {
  steps: StayHubStep[];
  activePanel: string;
  terminal?: string | null;
  onStepClick?: (id: StayHubStep["id"], locked: boolean, reason?: string) => void;
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {terminal ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-center text-[11px] font-medium capitalize text-destructive"
          role="status"
        >
          {terminal.replace(/_/g, " ")}
        </p>
      ) : null}
      <div className="rounded-lg bg-muted/60 p-1">
        <ol
          className="flex gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Stay progress"
        >
          {steps.map((step, index) => {
            const viewing = step.id === activePanel;
            const interactive = Boolean(onStepClick);
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() =>
                    onStepClick?.(step.id, step.locked, step.lockReason)
                  }
                  className={cn(
                    "flex min-h-9 w-full min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 transition-colors sm:min-h-10 sm:px-1",
                    viewing && "bg-background shadow-sm ring-1 ring-accent/35",
                    step.current && !viewing && "bg-background/60",
                    interactive &&
                      !step.locked &&
                      "cursor-pointer hover:bg-background/80",
                    step.locked && interactive && "cursor-not-allowed opacity-60",
                    !interactive && "cursor-default",
                  )}
                  aria-current={viewing ? "step" : undefined}
                  title={
                    step.locked && step.lockReason
                      ? step.lockReason
                      : step.label
                  }
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border text-[9px] font-semibold sm:size-6 sm:text-[10px]",
                      step.done
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : viewing || step.current
                          ? "border-accent bg-background text-accent"
                          : "border-border/80 bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {step.done ? (
                      <CheckIcon className="size-3" strokeWidth={2.5} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "max-w-full truncate text-[8px] font-medium leading-tight sm:text-[10px]",
                      step.done
                        ? "text-emerald-700 dark:text-emerald-300"
                        : viewing || step.current
                          ? "text-accent"
                          : "text-muted-foreground",
                    )}
                  >
                    <span className="sm:hidden">{step.shortLabel}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
