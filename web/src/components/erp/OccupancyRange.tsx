"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OccupancyNight } from "@/lib/erp/occupancy-nights";
import { cn } from "@/lib/utils";
import { useState } from "react";

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${names[Number(month) - 1] ?? month}`;
}

function roomList(rooms: string[]): string {
  return rooms.length ? rooms.join(", ") : "—";
}

export function OccupancyRange({
  from,
  to,
  nights,
  action = "/erp/reservations",
  hidden,
  focusDate,
  dates = "bar",
}: {
  from: string;
  to: string;
  nights: OccupancyNight[];
  action?: string;
  hidden?: Record<string, string>;
  /** Date row to mark when the report opens. */
  focusDate?: string;
  /** Day page keeps the range inside the report so the bar does not scroll. */
  dates?: "bar" | "dialog";
}) {
  const [open, setOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState(focusDate && nights.some((night) => night.date === focusDate) ? focusDate : (nights[0]?.date ?? ""));
  const picked = nights.find((night) => night.date === pickedDate) ?? nights[0] ?? null;
  const rangeForm = (
    <form action={action} className="flex shrink-0 flex-nowrap items-center gap-2">
      {hidden
        ? Object.entries(hidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))
        : null}
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        From
        <input
          type="date"
          name="occ_from"
          defaultValue={from}
          aria-label="From date"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        To
        <input
          type="date"
          name="occ_to"
          defaultValue={to}
          aria-label="To date"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        />
      </label>
      <button type="submit" className="h-8 rounded-md border px-2.5 text-sm hover:bg-muted">
        Apply
      </button>
    </form>
  );

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      {dates === "bar" ? rangeForm : null}
      <button
        type="button"
        className="h-8 rounded-md border border-foreground px-2.5 text-sm font-medium hover:bg-muted"
        onClick={() => {
          const marked = focusDate && nights.some((night) => night.date === focusDate) ? focusDate : nights[0]?.date ?? "";
          setPickedDate(marked);
          setOpen(true);
        }}
      >
        Room report
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Rooms</DialogTitle>
            <DialogDescription>
              {nights.length
                ? `${shortDate(from)} – ${shortDate(to)}. Guest rooms in the counts. Guide and driver rooms are listed with their type.`
                : "Choose a from and to date, then apply, to load this report."}
            </DialogDescription>
          </DialogHeader>
          {dates === "dialog" ? rangeForm : null}
          {nights.length && picked ? (
            <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
              <div className="max-h-[60vh] overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Date</th>
                      <th className="px-2 py-1.5 text-right font-medium">Empty</th>
                      <th className="px-2 py-1.5 text-right font-medium">In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nights.map((night) => (
                      <tr key={night.date} className="border-t">
                        <td colSpan={3} className="p-0">
                          <button
                            type="button"
                            className={cn(
                              "grid w-full grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 text-left tabular-nums hover:bg-muted/60",
                              picked.date === night.date && "bg-[#1a1410] font-semibold text-[#f6f1ea] hover:bg-[#1a1410]",
                            )}
                            onClick={() => setPickedDate(night.date)}
                          >
                            <span>{shortDate(night.date)}</span>
                            <span>{night.empty}</span>
                            <span>{night.occupied}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="max-h-[60vh] min-w-0 overflow-auto rounded-lg border">
                <div className="sticky top-0 border-b bg-card px-3 py-2">
                  <p className="text-sm font-semibold">{shortDate(picked.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    Empty {picked.empty} · Occupied {picked.occupied}
                    {picked.outOfOrder ? ` · Out of order ${picked.outOfOrder}` : ""}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Type</th>
                      <th className="px-3 py-1.5 text-left font-medium">Empty</th>
                      <th className="px-3 py-1.5 text-left font-medium">Occupied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picked.types.map((type) => (
                      <tr key={type.name} className="border-t align-top">
                        <td className="px-3 py-2 font-medium">{type.name}</td>
                        <td className="px-3 py-2">{roomList(type.empty)}</td>
                        <td className="px-3 py-2">
                          {roomList(type.occupied)}
                          {type.outOfOrder.length ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Out of order {type.outOfOrder.join(", ")}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No nights in this range.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
