"use client";

import type { StayHubSummary } from "@/app/actions/stay-hub";
import { cn } from "@/lib/utils";

/**
 * Compact list of booking_rooms on one stay (New booking multi-category).
 * Not a formal party switcher — same booking, all categories.
 */
export function StayHubBookingRoomsStrip({
  roomLines,
  className,
}: {
  roomLines: StayHubSummary["roomLines"];
  className?: string;
}) {
  const guest = roomLines.filter(
    (l) => (l.inventoryKind || "sellable_guest") === "sellable_guest",
  );
  const lines = guest.length > 0 ? guest : roomLines;
  const totalQty = lines.reduce((s, l) => s + Math.max(0, l.qty), 0);
  if (lines.length === 0 || (lines.length === 1 && totalQty <= 1)) return null;

  return (
    <div
      className={cn(
        "shrink-0 space-y-1 border-b border-border bg-muted/10 px-3 py-2 pr-12 md:px-4 md:pr-14",
        className,
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Rooms on this stay
        <span className="ml-1.5 font-normal normal-case tracking-normal tabular-nums">
          {totalQty} room{totalQty === 1 ? "" : "s"}
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {lines.map((l) => {
          const assign =
            l.assignedLabels.length > 0
              ? l.assignedLabels.join(", ")
              : null;
          return (
            <span
              key={`${l.roomTypeId}:${l.inventoryKind}`}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
              title={assign ?? l.roomTypeName}
            >
              <span className="font-semibold tabular-nums">{l.qty}×</span>
              <span className="truncate font-medium">{l.roomTypeName}</span>
              {assign ? (
                <span className="truncate text-[10px] text-muted-foreground">
                  · {assign}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  · unassigned
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
