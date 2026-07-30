"use client";

import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
import { Badge } from "@/components/ui/badge";
import type { OpenPosTicket } from "@/lib/pos";
import { useMemo } from "react";

type Props = {
  openTickets: OpenPosTicket[];
  onOpenTickets: () => void;
};

export function KitchenTicketStrip({ openTickets, onOpenTickets }: Props) {
  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    let parked = 0;
    let online = 0;
    let pendingConfirm = 0;
    let awaitingPayment = 0;
    const byStation = new Map<string, number>();
    for (const t of openTickets) {
      byStatus.set(t.kot_status, (byStatus.get(t.kot_status) ?? 0) + 1);
      if (t.is_parked) parked += 1;
      if (t.order_source === "public") {
        online += 1;
        if (!t.confirmed_at) pendingConfirm += 1;
        else if (!t.payment_recorded_at) awaitingPayment += 1;
      }
      // Station load counts only tickets the kitchen can actually fire:
      // desk tickets, plus online orders that are confirmed *and* paid.
      const skip =
        t.is_parked ||
        (t.order_source === "public" &&
          (!t.confirmed_at || !t.payment_recorded_at));
      if (!skip) {
        for (const item of t.order_items) {
          const station = item.prep_station || "kitchen";
          byStation.set(station, (byStation.get(station) ?? 0) + item.qty);
        }
      }
    }
    return {
      new: byStatus.get("new") ?? 0,
      preparing: byStatus.get("preparing") ?? 0,
      ready: byStatus.get("ready") ?? 0,
      parked,
      online,
      pendingConfirm,
      awaitingPayment,
      byStation,
    };
  }, [openTickets]);

  const stations = [...counts.byStation.entries()].sort(
    (a, b) =>
      (["kitchen", "bar", "pastry", "grill", "cold"].indexOf(a[0]) === -1
        ? 99
        : ["kitchen", "bar", "pastry", "grill", "cold"].indexOf(a[0])) -
      (["kitchen", "bar", "pastry", "grill", "cold"].indexOf(b[0]) === -1
        ? 99
        : ["kitchen", "bar", "pastry", "grill", "cold"].indexOf(b[0])),
  );

  return (
    <button
      type="button"
      onClick={onOpenTickets}
      className="erp flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5 text-left transition-colors hover:bg-secondary/40"
      aria-label="Open tickets"
    >
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Kitchen
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {counts.pendingConfirm > 0 ? (
            <Badge variant="gold">Pending confirm · {counts.pendingConfirm}</Badge>
          ) : null}
          {counts.awaitingPayment > 0 ? (
            <Badge variant="gold">
              Awaiting payment · {counts.awaitingPayment}
            </Badge>
          ) : null}
          {counts.new > 0 ? (
            <Badge variant="secondary">New · {counts.new}</Badge>
          ) : null}
          {counts.preparing > 0 ? (
            <Badge variant="secondary">Preparing · {counts.preparing}</Badge>
          ) : null}
          {counts.ready > 0 ? (
            <Badge variant="gold">Ready · {counts.ready}</Badge>
          ) : null}
          {counts.parked > 0 ? (
            <Badge variant="outline">Parked · {counts.parked}</Badge>
          ) : null}
          {stations.length > 1
            ? stations.map(([station, qty]) => (
                <Badge key={station} variant="outline" className="capitalize">
                  {station} · {qty}
                </Badge>
              ))
            : null}
          {counts.online > 0 ? (
            <Badge variant="gold">Online · {counts.online}</Badge>
          ) : null}
          {openTickets.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No open tickets
            </span>
          ) : null}
        </div>
      </div>
      <DeskLiveRefresh label="Live" />
    </button>
  );
}
