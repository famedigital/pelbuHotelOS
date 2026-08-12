"use client";

import { mergeBookingsIntoGroup } from "@/app/actions/erp-reservations-party";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { toast } from "sonner";

/**
 * Sticky FO chrome when stay bars are multi-selected on the rack.
 * Link as group reuses party merge (same as reservations board).
 */
export function RackPartySelectionBar({
  selectedBookingIds,
  onClear,
  onOpenParty,
  onLinked,
}: {
  selectedBookingIds: string[];
  onClear: () => void;
  onOpenParty: () => void;
  onLinked?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const n = selectedBookingIds.length;
  if (n < 1) return null;

  const link = () => {
    if (n < 2) return;
    startTransition(async () => {
      const result = await mergeBookingsIntoGroup(selectedBookingIds);
      if (result.ok) {
        toast.success(result.message ?? `Linked ${n} rooms as group`);
        onLinked?.();
        onClear();
      } else {
        toast.error(result.error ?? "Could not link group");
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-accent/30 bg-accent/10 px-2 py-1.5">
      <p className="text-xs font-medium text-foreground">
        <span className="tabular-nums">{n}</span> room
        {n === 1 ? "" : "s"} selected
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          disabled={pending}
          onClick={onClear}
        >
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={pending || n < 1}
          onClick={onOpenParty}
        >
          Open party
        </Button>
        <Button
          type="button"
          size="sm"
          variant="citrus"
          className="h-7 text-[11px]"
          disabled={pending || n < 2}
          title={n < 2 ? "Select at least two rooms to link" : undefined}
          onClick={link}
        >
          {pending ? "Linking…" : "Link as group"}
        </Button>
      </div>
    </div>
  );
}
