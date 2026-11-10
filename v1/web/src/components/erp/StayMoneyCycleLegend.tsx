import { STAY_MONEY_CYCLE_LEGEND } from "@/lib/folio/stay-money-cycle";
import { cn } from "@/lib/utils";

/** Compact numbered legend explaining the FO stay money cycle. */
export function StayMoneyCycleLegend({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <aside
      className={cn(
        "rounded-lg border border-accent/20 bg-accent/5",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        className,
      )}
      aria-label="Stay money cycle"
    >
      <p
        className={cn(
          "font-semibold tracking-[0.14em] text-accent uppercase",
          compact ? "text-[10px]" : "text-[11px]",
        )}
      >
        Stay money cycle
      </p>
      <ol
        className={cn(
          "mt-2 space-y-1.5",
          compact ? "text-[11px]" : "text-xs",
          "text-muted-foreground",
        )}
      >
        {STAY_MONEY_CYCLE_LEGEND.map((row) => (
          <li key={row.step} className="flex gap-2">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
              {row.step}
            </span>
            <span>
              <span className="font-medium text-foreground">{row.title}</span>
              {compact ? null : (
                <span className="block text-muted-foreground">{row.body}</span>
              )}
              {compact ? (
                <span className="text-muted-foreground"> — {row.body}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
