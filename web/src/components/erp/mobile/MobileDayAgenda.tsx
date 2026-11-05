"use client";

import { useState } from "react";
import type { RackStay, RackUnit } from "@/components/erp/RoomRackGrid";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  BedDoubleIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  LogInIcon,
  LogOutIcon,
  MoonIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";

interface MobileDayAgendaProps {
  stays: RackStay[];
  units: RackUnit[];
  today: string;
}

export function MobileDayAgenda({ stays, units, today }: MobileDayAgendaProps) {
  const [selectedDate, setSelectedDate] = useState(today);

  // Generate 7-day pill window: [Today - 2, Today - 1, Today, Today + 1, Today + 2, Today + 3, Today + 4]
  const dateWindow = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (i - 2));
    const iso = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const dayNum = d.getUTCDate();
    return { iso, dayName, dayNum, isToday: iso === today };
  });

  // Filter stays active on the selected date
  const activeStays = stays.filter(
    (s) => s.check_in <= selectedDate && s.check_out >= selectedDate
  );

  const arrivals = stays.filter((s) => s.check_in === selectedDate);
  const departures = stays.filter((s) => s.check_out === selectedDate);
  const inHouse = stays.filter(
    (s) => s.status === "checked_in" && s.check_in <= selectedDate && s.check_out > selectedDate
  );

  // Unit lookup map
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const openStayHub = (bookingId: string) => {
    window.dispatchEvent(
      new CustomEvent("hotelos-desk", { detail: { bookingId } })
    );
    window.dispatchEvent(
      new CustomEvent("innora:open-stay", {
        detail: { bookingId, step: "stay_summary" },
      })
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* 1. TOP 7-DAY HORIZONTAL SWIPEABLE DATE BAR */}
      <div className="shrink-0 border-b border-border/70 bg-card/60 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="size-4 text-sky-600 dark:text-sky-400" />
            <h2 className="text-xs font-bold tracking-tight uppercase text-foreground">
              {new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/80"
          >
            Today
          </button>
        </div>

        {/* Date pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {dateWindow.map(({ iso, dayName, dayNum, isToday }) => {
            const isSelected = iso === selectedDate;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  "touch-press flex min-w-[3.25rem] flex-1 flex-col items-center justify-center rounded-xl py-2 text-center transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                  isToday && !isSelected && "border border-primary/40 font-semibold"
                )}
              >
                <span className="text-[10px] font-medium leading-none uppercase">
                  {dayName}
                </span>
                <span className="mt-1 text-sm font-bold leading-none">{dayNum}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. OPERATIONAL KPI SUMMARY PILLS */}
      <div className="shrink-0 grid grid-cols-3 gap-2 border-b border-border/50 bg-muted/20 px-3 py-2">
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card p-1.5 shadow-xs">
          <span className="text-[10px] font-medium text-muted-foreground">In-House</span>
          <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
            {inHouse.length}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card p-1.5 shadow-xs">
          <span className="text-[10px] font-medium text-muted-foreground">Arrivals</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {arrivals.length}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card p-1.5 shadow-xs">
          <span className="text-[10px] font-medium text-muted-foreground">Departures</span>
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
            {departures.length}
          </span>
        </div>
      </div>

      {/* 3. STAYS FEED (TOUCH-FRIENDLY 3D GLASS CARDS) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2.5 pb-24">
        {activeStays.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-8 text-center">
            <BedDoubleIcon className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-semibold text-foreground">No stays on this day</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enjoy the calm Himalayan valley air.
            </p>
          </div>
        ) : (
          activeStays.map((stay) => {
            const unit = stay.room_unit_id ? unitMap.get(stay.room_unit_id) : null;
            const isDueOut = stay.check_out === selectedDate;
            const isArriving = stay.check_in === selectedDate;
            const balance = Number(stay.folio_balance ?? 0);

            return (
              <div
                key={stay.id}
                onClick={() => openStayHub(stay.booking_id)}
                className="touch-press group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-3.5 shadow-xs transition-all active:scale-[0.98] hover:border-primary/40"
              >
                {/* Status indicator bar on left */}
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1.5",
                    stay.status === "checked_in"
                      ? "bg-sky-500"
                      : stay.status === "confirmed"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  )}
                />

                {/* Top header row */}
                <div className="flex items-start justify-between gap-2 pl-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                        {unit?.label ? `Room ${unit.label}` : "Unassigned"}
                      </span>
                      {stay.agent_name ? (
                        <span className="truncate rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                          {stay.agent_name}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-bold text-foreground">
                      {stay.contact_name?.trim() || "Guest"}
                    </h3>
                  </div>

                  {/* Status chip */}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                      stay.status === "checked_in"
                        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    )}
                  >
                    {isArriving ? "Arriving" : isDueOut ? "Due Out" : stay.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Details grid */}
                <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-border/40 pt-2 pl-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MoonIcon className="size-3.5 text-muted-foreground/70" />
                    <span>
                      {stay.check_in.slice(5)} → {stay.check_out.slice(5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <CreditCardIcon className="size-3.5 text-muted-foreground/70" />
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        balance > 0.5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {balance > 0.5 ? `Due: ${formatGuestBtn(balance)}` : "Settled (0.00)"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
