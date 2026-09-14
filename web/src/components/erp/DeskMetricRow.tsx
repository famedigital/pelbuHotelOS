import { cn } from "@/lib/utils";
import Link from "next/link";

export type DeskMetric = {
  label: string;
  value: string;
  /** Optional click-to-filter facet. */
  href?: string;
  tone?: "default" | "destructive" | "accent";
  hint?: string;
};

/**
 * Thin KPI strip for desk sections — not tall card soup.
 * Prefer clickable facets when a metric maps to a list view.
 */
export function DeskMetricRow({
  metrics,
  className,
}: {
  metrics: DeskMetric[];
  className?: string;
}) {
  if (metrics.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-2",
        metrics.length === 1 && "grid-cols-1",
        metrics.length === 2 && "grid-cols-2",
        metrics.length === 3 && "grid-cols-1 sm:grid-cols-3",
        metrics.length >= 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {metrics.map((m) => {
        const valueClass =
          m.tone === "destructive"
            ? "text-destructive"
            : m.tone === "accent"
              ? "text-accent"
              : "text-foreground";

        const body = (
          <>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {m.label}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-semibold tracking-tight tabular-nums",
                valueClass,
              )}
            >
              {m.value}
            </p>
            {m.hint ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{m.hint}</p>
            ) : null}
          </>
        );

        const shell = cn(
          "rounded-lg border border-border bg-card px-3 py-2.5",
          m.href &&
            "transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        );

        if (m.href) {
          return (
            <Link
              key={m.label}
              href={m.href}
              className={shell}
              aria-label={`${m.label}: ${m.value}`}
            >
              {body}
            </Link>
          );
        }

        return (
          <div key={m.label} className={shell}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
