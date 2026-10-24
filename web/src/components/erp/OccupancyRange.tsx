"use client";

import type { OccupancyNight } from "@/lib/erp/occupancy-nights";
import { cn } from "@/lib/utils";
import { useState } from "react";

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${names[Number(month) - 1] ?? month}`;
}

export function OccupancyRange({
  from,
  to,
  nights,
  action = "/erp/reservations",
  hidden,
}: {
  from: string;
  to: string;
  nights: OccupancyNight[];
  action?: string;
  hidden?: Record<string, string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const picked = nights.find((night) => night.date === open) ?? null;

  return (
    <div className="min-w-0">
      <form action={action} className="flex flex-wrap items-center gap-2">
        {hidden
          ? Object.entries(hidden).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))
          : null}
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          From
          <input
            type="date"
            name="occ_from"
            defaultValue={from}
            aria-label="From date"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          To
          <input
            type="date"
            name="occ_to"
            defaultValue={to}
            aria-label="To date"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          className="h-8 rounded-md border px-2.5 text-sm hover:bg-muted"
        >
          Show rooms
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto text-sm">
          <span className="shrink-0 text-muted-foreground">Empty</span>
          {nights.map((night) => (
            <button
              key={`e-${night.date}`}
              type="button"
              className={cn(
                "shrink-0 tabular-nums",
                open === night.date && "font-semibold text-foreground",
              )}
              onClick={() => setOpen((current) => (current === night.date ? null : night.date))}
            >
              {shortDate(night.date)} {night.empty}
            </button>
          ))}
          <span className="shrink-0 text-muted-foreground">Occupied</span>
          {nights.map((night) => (
            <span key={`o-${night.date}`} className="shrink-0 tabular-nums">
              {night.occupied}
            </span>
          ))}
        </div>
      </form>
      {picked ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {shortDate(picked.date)}
          {picked.types.map((type) => {
            const bits = [
              type.empty.length ? `${type.name} empty ${type.empty.length} (${type.empty.join(", ")})` : "",
              type.occupied.length
                ? `${type.name} occupied ${type.occupied.length} (${type.occupied.join(", ")})`
                : "",
              type.outOfOrder.length
                ? `${type.name} out of order ${type.outOfOrder.join(", ")}`
                : "",
            ].filter(Boolean);
            return bits.length ? ` · ${bits.join("; ")}` : "";
          })}
          {picked.outOfOrder ? ` · ${picked.outOfOrder} out of order` : ""}
        </p>
      ) : null}
    </div>
  );
}
