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
    <div className="flex shrink-0 items-center gap-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">{n}</span>{" "}
        selected
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={onClear}
        className="h-8 px-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Clear
      </button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2 text-xs"
        disabled={pending || n < 1}
        onClick={onOpenParty}
      >
        Open
      </Button>
      {n >= 2 ? (
        <Button
          type="button"
          size="sm"
          variant="citrus"
          className="h-8 px-2.5 text-xs"
          disabled={pending}
          onClick={link}
        >
          {pending ? "Linking…" : "Link group"}
        </Button>
      ) : null}
    </div>
  );
}
