"use client";

import type { StayHubStep } from "@/lib/folio/stay-hub-cycle";
import { STAY_HUB_STEP_ORDER } from "@/lib/folio/stay-hub-cycle";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

/**
 * Stay lifecycle steps — horizontal (compact strip) or vertical (left rail hierarchy).
 * Done / earlier steps stay clickable for reverse-nav (e.g. Checkout → Folio).
 */
export function StayProgressStrip({
  steps,
  activePanel,
  terminal,
  onStepClick,
  className,
  orientation = "horizontal",
  canNavigateStep,
  dense = false,
}: {
  steps: StayHubStep[];
  activePanel: string;
  terminal?: string | null;
  onStepClick?: (id: StayHubStep["id"], locked: boolean, reason?: string) => void;
  className?: string;
  /** vertical = left FO hierarchy rail */
  orientation?: "horizontal" | "vertical";
  canNavigateStep?: (id: StayHubStep["id"], step: StayHubStep) => boolean;
  /** Left rail: shorter rows so 4 steps fit without a scroller */
  dense?: boolean;
}) {
  if (steps.length === 0) return null;

  const activeIdx = STAY_HUB_STEP_ORDER.indexOf(
    activePanel as StayHubStep["id"],
  );

  if (orientation === "vertical") {
    return (
      <nav
        className={cn("flex min-h-0 flex-col", dense ? "gap-0" : "gap-1", className)}
        aria-label="Stay progress"
      >
        {terminal ? (
          <p
            className="mb-0.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-center text-[10px] font-medium capitalize text-destructive"
            role="status"
          >
            {terminal.replace(/_/g, " ")}
          </p>
        ) : null}
        <ol className="flex flex-col gap-0">
          {steps.map((step, index) => {
            const viewing = step.id === activePanel;
            const interactive = Boolean(onStepClick);
            const stepOrderIdx = STAY_HUB_STEP_ORDER.indexOf(step.id);
            const isEarlier =
              stepOrderIdx >= 0 && activeIdx >= 0 && stepOrderIdx < activeIdx;
            const reverseOpen =
              Boolean(canNavigateStep?.(step.id, step)) ||
              step.done ||
              isEarlier ||
              viewing ||
              step.current;
            const looksLocked =
              interactive && step.locked && !reverseOpen && !viewing;

            return (
              <li key={step.id} className="min-w-0">
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() =>
                    onStepClick?.(
                      step.id,
                      step.locked && !reverseOpen,
                      step.lockReason,
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 text-left transition-colors",
                    dense
                      ? "min-h-8 py-1"
                      : "min-h-11 py-1.5",
                    viewing &&
                      "bg-background shadow-sm ring-1 ring-accent/40",
                    step.current && !viewing && "bg-background/50",
                    interactive &&
                      !looksLocked &&
                      "cursor-pointer hover:bg-background/80",
                    looksLocked && "cursor-not-allowed opacity-55",
                    !interactive && "cursor-default",
                  )}
                  aria-current={viewing ? "step" : undefined}
                  title={
                    looksLocked && step.lockReason
                      ? step.lockReason
                      : step.label
                  }
                >
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-full border font-semibold",
                      dense ? "size-5 text-[9px]" : "size-6 text-[10px]",
                      step.done
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : viewing || step.current
                          ? "border-accent bg-background text-accent"
                          : "border-border/80 bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {step.done ? (
                      <CheckIcon
                        className={dense ? "size-2.5" : "size-3"}
                        strokeWidth={2.5}
                      />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium leading-tight",
                      dense ? "text-[11px]" : "text-xs",
                      step.done
                        ? "text-emerald-700 dark:text-emerald-300"
                        : viewing || step.current
                          ? "text-accent"
                          : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

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
            const stepOrderIdx = STAY_HUB_STEP_ORDER.indexOf(step.id);
            const isEarlier =
              stepOrderIdx >= 0 && activeIdx >= 0 && stepOrderIdx < activeIdx;
            const reverseOpen =
              Boolean(canNavigateStep?.(step.id, step)) ||
              step.done ||
              isEarlier ||
              viewing ||
              step.current;
            const looksLocked =
              interactive && step.locked && !reverseOpen && !viewing;
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() =>
                    onStepClick?.(
                      step.id,
                      step.locked && !reverseOpen,
                      step.lockReason,
                    )
                  }
                  className={cn(
                    "flex min-h-11 w-full min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 transition-colors sm:min-h-10 sm:px-1",
                    viewing && "bg-background shadow-sm ring-1 ring-accent/35",
                    step.current && !viewing && "bg-background/60",
                    interactive &&
                      !looksLocked &&
                      "cursor-pointer hover:bg-background/80",
                    looksLocked && "cursor-not-allowed opacity-60",
                    !interactive && "cursor-default",
                  )}
                  aria-current={viewing ? "step" : undefined}
                  title={
                    looksLocked && step.lockReason
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
