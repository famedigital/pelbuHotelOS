"use client";

import type { BuildingSpace } from "@/lib/building/types";
import { spaceKindLabel } from "@/lib/building/amenity-defaults";
import { Button } from "@/components/ui/button";

export function BuildingSpaceSheet({
  space,
  onClose,
}: {
  space: (BuildingSpace & { id?: string }) | null;
  onClose: () => void;
}) {
  if (!space) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-label={space.label}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Building space · Floor {space.floor_key}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">
          {space.label}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {spaceKindLabel(space.kind)} — map massing only (not a bookable
          room). Restaurant seating is on POS floor plans.
        </p>
        {space.facade_side ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Facade: {space.facade_side}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
