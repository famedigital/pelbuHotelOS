"use client";

import { cn } from "@/lib/utils";

/** Subtle Syncing / Cached / Live chip for desk FO. */
export function DeskSyncChip({
  syncing,
  source,
  className,
}: {
  syncing: boolean;
  source?: "none" | "cache" | "network";
  className?: string;
}) {
  if (syncing) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase",
          className,
        )}
        aria-live="polite"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-citrus" />
        Syncing
      </span>
    );
  }
  if (source === "cache") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase",
          className,
        )}
      >
        Cached
      </span>
    );
  }
  return null;
}
