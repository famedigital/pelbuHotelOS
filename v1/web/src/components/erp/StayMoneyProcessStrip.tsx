import type { StayMoneyStep } from "@/lib/folio/stay-money-cycle";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

/** Scannable process strip: Booked → … → Checkout */
export function StayMoneyProcessStrip({
  steps,
  className,
}: {
  steps: StayMoneyStep[];
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <ol
      className={cn(
        "flex gap-1 overflow-x-auto pb-0.5",
        className,
      )}
      aria-label="Stay money progress"
    >
      {steps.map((step, index) => (
        <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1.5",
              step.current && "bg-accent/10",
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                step.done
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : step.current
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
                "truncate text-[10px] font-medium",
                step.done
                  ? "text-emerald-700 dark:text-emerald-300"
                  : step.current
                    ? "text-accent"
                    : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                "mb-4 hidden h-px w-2 shrink-0 sm:block",
                step.done ? "bg-emerald-500" : "bg-border",
              )}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
