"use client";

import { FoStayActionButton, useFoOpsOpenStay } from "@/components/erp/FoOpsRowActions";
import { isFoCommandPath } from "@/lib/erp/fo-command-path";
import type { DailyDeskSnapshot, DayOpsPulse } from "@/lib/erp/daily-desk";
import type { DayOpsRow } from "@/lib/erp/day-ops-board";
import type { EmptyRoomBreakdown } from "@/lib/erp/fo-ops-blocks";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function FoCommandScope({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!isFoCommandPath(pathname)) return children;
  return (
    <div className="fo-command dark min-h-full bg-[#020617] text-slate-100">
      {children}
    </div>
  );
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

export function arrivalReady(row: DayOpsRow): boolean {
  return (
    row.rooms > 0 &&
    row.assigned_count >= row.rooms &&
    !row.has_unready_guest_room
  );
}

export function FoMetricCard({
  label,
  value,
  hint,
  percent,
  barClassName,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  percent?: number;
  barClassName?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xl font-bold text-white">{value}</span>
        {hint ? (
          <span className="text-right text-[11px] text-slate-400">{hint}</span>
        ) : null}
      </div>
      {percent != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn("h-full rounded-full bg-sky-500", barClassName)}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </>
  );

  const shell = "fo-glass-card p-4 text-left";
  if (!onClick) return <div className={shell}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(shell, "w-full")}>
      {body}
    </button>
  );
}

export function FoStayMetrics({
  snap,
  onOpen,
}: {
  snap: DailyDeskSnapshot;
  onOpen: (tab: "checkout" | "inhouse" | "arrival" | "empty") => void;
}) {
  const arrivals = snap.dayOps.arrivals;
  const ready = arrivals.filter(arrivalReady).length;
  const pulse = snap.dayOpsPulse;
  const sellable = snap.emptyRooms.sellableTotal;
  const occupied = snap.emptyRooms.occupiedToday;
  const occBase = sellable > 0 ? sellable : pulse.roomsTotal;
  const occCount = sellable > 0 ? occupied : pulse.roomsOccupied;
  const departures = snap.dayOps.departures.length;
  const house = Math.max(snap.dayOps.inHouse.length, departures, 1);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <FoMetricCard
        label="Expected arrivals"
        value={String(arrivals.length)}
        hint={arrivals.length ? `${pct(ready, arrivals.length)}% ready` : "None today"}
        percent={pct(ready, Math.max(arrivals.length, 1))}
        onClick={() => onOpen("arrival")}
      />
      <FoMetricCard
        label="Occupancy"
        value={occBase ? `${pct(occCount, occBase)}%` : "—"}
        hint={occBase ? `${occCount} / ${occBase} rooms` : "No sellable rooms"}
        percent={pct(occCount, occBase)}
        barClassName="bg-emerald-500"
        onClick={() => onOpen("inhouse")}
      />
      <FoMetricCard
        label="Clean rooms"
        value={String(pulse.roomsClean)}
        hint={
          pulse.roomsDirty
            ? `${pulse.roomsDirty} dirty or inspect`
            : "Ready for assignment"
        }
        percent={pct(pulse.roomsClean, Math.max(pulse.roomsTotal, 1))}
        barClassName="bg-amber-400"
        onClick={() => onOpen("empty")}
      />
      <FoMetricCard
        label="Departures"
        value={String(departures)}
        hint="Still on the board"
        percent={pct(departures, house)}
        barClassName="bg-amber-500"
        onClick={() => onOpen("checkout")}
      />
    </div>
  );
}

function stayPill(row: DayOpsRow, board: "arrivals" | "in_house" | "departures") {
  if (board === "departures") {
    return { label: "Due out", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
  }
  if (row.status === "checked_in") {
    return { label: "In house", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
  }
  if (arrivalReady(row)) {
    return { label: "Ready", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
  }
  if (row.has_unready_guest_room || row.dirty_or_ooo) {
    return { label: "Needs HK", className: "border-rose-500/40 bg-rose-500/10 text-rose-300" };
  }
  return { label: "Needs room", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
}

export function FoStayCommandTable({
  rows,
  board,
}: {
  rows: DayOpsRow[];
  board: "arrivals" | "in_house" | "departures";
}) {
  const openStay = useFoOpsOpenStay();
  const action =
    board === "arrivals" ? "Check in" : board === "departures" ? "Check out" : "Open";
  const step =
    board === "arrivals" ? "check_in" : board === "departures" ? "check_out" : "stay_money";

  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-sm text-slate-400">Nothing on this list today.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-xs">
        <thead className="border-b border-slate-800 font-mono text-[10px] tracking-wide text-slate-400 uppercase">
          <tr>
            <th className="px-2 py-2 font-medium">Guest</th>
            <th className="px-2 py-2 font-medium">Confirmation</th>
            <th className="px-2 py-2 font-medium">Room</th>
            <th className="px-2 py-2 font-medium">Agent</th>
            <th className="px-2 py-2 font-medium">Balance</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80 text-slate-200">
          {rows.map((row) => {
            const pill = stayPill(row, board);
            const balance = row.folio_balance_btn;
            return (
              <tr key={row.id} className="hover:bg-slate-900/50">
                <td className="max-w-[12rem] truncate px-2 py-2.5 font-semibold text-white">
                  {row.contact_name ?? "Guest"}
                </td>
                <td className="px-2 py-2.5 font-mono text-slate-400">
                  {bookingConfirmationLabel({
                    confirmationCode: row.confirmation_code,
                    bookingId: row.id,
                  })}
                </td>
                <td className="px-2 py-2.5">
                  {row.room_labels?.trim() ? row.room_labels : "Unassigned"}
                </td>
                <td className="max-w-[9rem] truncate px-2 py-2.5 text-slate-300">
                  {row.agent_name ?? "Direct"}
                </td>
                <td
                  className={cn(
                    "px-2 py-2.5 font-mono tabular-nums",
                    balance != null && balance > 0 ? "text-citrus" : "text-slate-300",
                  )}
                >
                  {balance == null ? "—" : formatBtn(balance)}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      pill.className,
                    )}
                  >
                    {pill.label}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <FoStayActionButton
                    label={action}
                    variant={board === "arrivals" ? "default" : "outline"}
                    onClick={() => openStay(row, board, step)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const RAIL = [
  {
    key: "ready",
    label: "Vacant and ready",
    dot: "bg-emerald-400",
    valueClass: "text-emerald-300",
    href: "/erp/stayview?tab=empty",
  },
  {
    key: "dirty",
    label: "Dirty vacant",
    dot: "bg-amber-400",
    valueClass: "text-amber-300",
    href: "/erp/housekeeping",
  },
  {
    key: "occupied",
    label: "Occupied",
    dot: "bg-sky-400",
    valueClass: "text-sky-300",
    href: "/erp/in-house",
  },
  {
    key: "ooo",
    label: "Out of order",
    dot: "bg-rose-500",
    valueClass: "text-rose-300",
    href: "/erp/housekeeping",
  },
] as const;

export function FoHkRail({
  empty,
  pulse,
}: {
  empty: EmptyRoomBreakdown;
  pulse: DayOpsPulse;
}) {
  const ready = Math.max(0, empty.vacant - empty.dirtyVacant);
  const values: Record<(typeof RAIL)[number]["key"], number> = {
    ready,
    dirty: empty.dirtyVacant,
    occupied: empty.occupiedToday || pulse.roomsOccupied,
    ooo: empty.ooo,
  };

  return (
    <section className="fo-glass p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white">Live inventory</h2>
        <Link href="/erp/calendar" className="text-xs text-sky-400 hover:underline">
          Rack
        </Link>
      </div>
      <ul className="space-y-2">
        {RAIL.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-2 hover:border-sky-500/40"
            >
              <span className="flex items-center gap-2 text-xs text-slate-200">
                <span className={cn("size-2.5 rounded-full", row.dot)} />
                {row.label}
              </span>
              <span className={cn("font-mono text-sm font-bold", row.valueClass)}>
                {values[row.key]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FoHkLegend({
  units,
}: {
  units: { hk_status?: string | null }[];
}) {
  const counts = { clean: 0, inspect: 0, dirty: 0, occupied: 0, ooo: 0 };
  for (const unit of units) {
    const hk = unit.hk_status ?? "clean";
    if (hk === "inspect") counts.inspect += 1;
    else if (hk === "dirty") counts.dirty += 1;
    else if (hk === "occupied") counts.occupied += 1;
    else if (hk === "ooo" || hk === "out_of_order") counts.ooo += 1;
    else if (hk === "clean") counts.clean += 1;
  }
  const items = [
    { label: "Clean", value: counts.clean, dot: "bg-emerald-400" },
    { label: "Inspect", value: counts.inspect, dot: "bg-sky-400" },
    { label: "Dirty", value: counts.dirty, dot: "bg-amber-400" },
    { label: "Occupied", value: counts.occupied, dot: "bg-slate-300" },
    { label: "Out of order", value: counts.ooo, dot: "bg-rose-500" },
  ];
  return (
    <div className="fo-glass flex flex-wrap items-center gap-2 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        Housekeeping
      </p>
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-200"
        >
          <span className={cn("size-2 rounded-full", item.dot)} />
          {item.label}
          <span className="font-mono font-semibold">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
