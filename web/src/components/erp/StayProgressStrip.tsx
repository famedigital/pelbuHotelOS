"use client";

import type { StayHubStep, StayHubStepId } from "@/lib/folio/stay-hub-cycle";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

/** Clickable 6-step StayHub progress (phone scrolls horizontally). */
export function StayProgressStrip({
  steps,
  activePanel,
  terminal,
  onStepClick,
  className,
}: {
  steps: StayHubStep[];
  /** Panel the user is viewing (may differ from auto-current) */
  activePanel: StayHubStepId;
  terminal?: string | null;
  onStepClick?: (id: StayHubStepId, locked: boolean, reason?: string) => void;
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {terminal ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-center text-[11px] font-medium text-destructive"
          role="status"
        >
          {terminal.replace(/_/g, " ")}
        </p>
      ) : null}
      <ol
        className="flex gap-0.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Stay progress"
      >
        {steps.map((step, index) => {
          const viewing = step.id === activePanel;
          const interactive = Boolean(onStepClick);
          return (
            <li key={step.id} className="flex min-w-[3.25rem] flex-1 items-center gap-0.5 sm:min-w-0">
              <button
                type="button"
                disabled={!interactive}
                onClick={() =>
                  onStepClick?.(step.id, step.locked, step.lockReason)
                }
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 transition-colors",
                  viewing && "bg-accent/15 ring-1 ring-accent/30",
                  step.current && !viewing && "bg-accent/10",
                  interactive && !step.locked && "hover:bg-muted/80 cursor-pointer",
                  step.locked && interactive && "cursor-not-allowed opacity-70",
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
                    "flex size-7 items-center justify-center rounded-full border text-[10px] font-semibold sm:size-6",
                    step.done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : viewing || step.current
                        ? "border-accent bg-background text-accent"
                        : "border-border bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {step.done ? (
                    <CheckIcon className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-[9px] font-medium sm:text-[10px]",
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
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mb-5 hidden h-px w-1.5 shrink-0 sm:block",
                    step.done ? "bg-emerald-500" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
