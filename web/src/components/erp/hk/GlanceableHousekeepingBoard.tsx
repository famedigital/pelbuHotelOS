"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Printer,
  Clock,
  BedDouble,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Filter,
  UserCheck,
  DoorOpen,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { quickMarkRoomClean } from "@/app/actions/erp-hk";

export interface HkRoomCardData {
  id: string;
  label: string;
  hkStatus: "clean" | "dirty" | "inspect" | "out_of_order";
  occupancyStatus: "vacant" | "occupied" | "departing" | "arriving";
  guestName?: string | null;
  checkoutTime?: string | null;
  arrivalEta?: string | null;
  notes?: string | null;
}

interface GlanceableHousekeepingBoardProps {
  rooms: HkRoomCardData[];
  propertyTitle?: string;
  todayDate: string;
}

export function GlanceableHousekeepingBoard({
  rooms: initialRooms,
  propertyTitle = "Hotel OS Bhutan",
  todayDate,
}: GlanceableHousekeepingBoardProps) {
  const [rooms, setRooms] = useState<HkRoomCardData[]>(initialRooms);
  const [filter, setFilter] = useState<"all" | "dirty" | "stayover" | "clean">("all");
  const [timeStr, setTimeStr] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Keep local state in sync when initialRooms changes
  useEffect(() => {
    setRooms(initialRooms);
  }, [initialRooms]);

  // Live ticking clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).toUpperCase()
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1-Tap mark room clean with optimistic UI update
  const handleMarkClean = (roomId: string) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, hkStatus: "clean" } : r))
    );

    startTransition(async () => {
      await quickMarkRoomClean(roomId);
    });
  };

  // Metrics
  const dirtyCount = rooms.filter((r) => r.hkStatus === "dirty").length;
  const stayoverCount = rooms.filter((r) => r.occupancyStatus === "occupied").length;
  const cleanCount = rooms.filter((r) => r.hkStatus === "clean").length;
  const outOfOrderCount = rooms.filter((r) => r.hkStatus === "out_of_order").length;

  const filteredRooms = useMemo(() => {
    if (filter === "dirty") return rooms.filter((r) => r.hkStatus === "dirty");
    if (filter === "stayover") return rooms.filter((r) => r.occupancyStatus === "occupied");
    if (filter === "clean") return rooms.filter((r) => r.hkStatus === "clean");
    return rooms;
  }, [rooms, filter]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & CLOCK */}
      <div className="p-6 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Housekeeping Live Command
            </span>
            <span className="text-xs text-muted-foreground">• Touch-Friendly Floor Run</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground mt-1 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            {propertyTitle} — Floor Control
          </h1>
          <p className="text-sm text-muted-foreground">
            {todayDate} • Live room turnover, maid assignments, and 1-tap clean status.
          </p>
        </div>

        {/* Big Digital Clock & Print Pass Button */}
        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-right backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
              Bhutan Standard Time
            </span>
            <span className="text-2xl font-black tracking-widest text-blue-400 font-mono tabular-nums">
              {timeStr || "07:30:00 AM"}
            </span>
          </div>

          <Link
            href="/erp/hk/pass"
            target="_blank"
            className="h-12 px-5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Printer className="w-5 h-5" />
            <span>Print Floor Run Sheet (A4)</span>
          </Link>
        </div>
      </div>

      {/* 2. KPI METRIC HERO CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Dirty / Turnaround */}
        <div
          onClick={() => setFilter("dirty")}
          className={cn(
            "p-5 rounded-2xl sovereign-glass border cursor-pointer transition-all shadow-sm flex items-center justify-between",
            filter === "dirty"
              ? "border-rose-500 ring-2 ring-rose-500/30"
              : "border-white/20 dark:border-white/10 hover:border-rose-500/40"
          )}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              🔴 Needs Turnaround
            </span>
            <div className="text-4xl font-black text-rose-600 dark:text-rose-400 tabular-stat tracking-tight">
              {dirtyCount}
            </div>
            <p className="text-xs text-muted-foreground">Dirty rooms to clean</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Stayovers */}
        <div
          onClick={() => setFilter("stayover")}
          className={cn(
            "p-5 rounded-2xl sovereign-glass border cursor-pointer transition-all shadow-sm flex items-center justify-between",
            filter === "stayover"
              ? "border-amber-500 ring-2 ring-amber-500/30"
              : "border-white/20 dark:border-white/10 hover:border-amber-500/40"
          )}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              🟡 Occupied Stayovers
            </span>
            <div className="text-4xl font-black text-amber-600 dark:text-amber-400 tabular-stat tracking-tight">
              {stayoverCount}
            </div>
            <p className="text-xs text-muted-foreground">Tidy &amp; fresh towels</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
            <BedDouble className="w-6 h-6" />
          </div>
        </div>

        {/* Clean Ready */}
        <div
          onClick={() => setFilter("clean")}
          className={cn(
            "p-5 rounded-2xl sovereign-glass border cursor-pointer transition-all shadow-sm flex items-center justify-between",
            filter === "clean"
              ? "border-emerald-500 ring-2 ring-emerald-500/30"
              : "border-white/20 dark:border-white/10 hover:border-emerald-500/40"
          )}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              🟢 Clean &amp; Ready
            </span>
            <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tabular-stat tracking-tight">
              {cleanCount}
            </div>
            <p className="text-xs text-muted-foreground">Ready for check-in</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Total Rooms */}
        <div
          onClick={() => setFilter("all")}
          className={cn(
            "p-5 rounded-2xl sovereign-glass border cursor-pointer transition-all shadow-sm flex items-center justify-between",
            filter === "all"
              ? "border-primary ring-2 ring-primary/30"
              : "border-white/20 dark:border-white/10 hover:border-primary/40"
          )}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Units
            </span>
            <div className="text-4xl font-black text-foreground tabular-stat tracking-tight">
              {rooms.length}
            </div>
            <p className="text-xs text-muted-foreground">{outOfOrderCount} Out of Order</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground border border-border/40">
            <DoorOpen className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. FILTER CHIP BAR */}
      <div className="flex items-center justify-between p-3 rounded-xl sovereign-glass border border-white/20 dark:border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-muted-foreground px-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Show:
          </span>
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              filter === "all"
                ? "bg-primary text-primary-foreground shadow"
                : "hover:bg-muted/60 text-muted-foreground"
            )}
          >
            All Rooms ({rooms.length})
          </button>
          <button
            onClick={() => setFilter("dirty")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              filter === "dirty"
                ? "bg-rose-600 text-white shadow"
                : "hover:bg-muted/60 text-muted-foreground"
            )}
          >
            🔴 Priority Dirty ({dirtyCount})
          </button>
          <button
            onClick={() => setFilter("stayover")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              filter === "stayover"
                ? "bg-amber-600 text-white shadow"
                : "hover:bg-muted/60 text-muted-foreground"
            )}
          >
            🟡 Stayovers ({stayoverCount})
          </button>
          <button
            onClick={() => setFilter("clean")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              filter === "clean"
                ? "bg-emerald-600 text-white shadow"
                : "hover:bg-muted/60 text-muted-foreground"
            )}
          >
            🟢 Clean Ready ({cleanCount})
          </button>
        </div>

        <span className="text-xs text-muted-foreground pr-2 font-medium">
          Showing <span className="font-bold text-foreground">{filteredRooms.length}</span> rooms
        </span>
      </div>

      {/* 4. LARGE TACTILE ROOM GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredRooms.map((room) => {
          const isDirty = room.hkStatus === "dirty";
          const isClean = room.hkStatus === "clean";
          const isOccupied = room.occupancyStatus === "occupied";

          return (
            <div
              key={room.id}
              className={cn(
                "p-5 rounded-2xl sovereign-glass border shadow-md flex flex-col justify-between transition-all",
                isDirty
                  ? "border-rose-500/50 bg-rose-500/5"
                  : isClean
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-white/20 dark:border-white/10"
              )}
            >
              <div>
                {/* Room Card Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-foreground font-mono">
                      {room.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {isOccupied ? "Occupied" : "Vacant"}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      isDirty
                        ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : isClean
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    )}
                  >
                    {room.hkStatus}
                  </span>
                </div>

                {/* Stay Info */}
                <div className="py-3 space-y-1.5 text-xs">
                  {room.guestName ? (
                    <div className="flex items-center gap-1.5 text-foreground font-semibold">
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      <span className="truncate">{room.guestName}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">No guest checked in</span>
                  )}

                  {room.checkoutTime && (
                    <div className="text-amber-600 dark:text-amber-400 font-medium">
                      • Due out today at {room.checkoutTime}
                    </div>
                  )}

                  {room.arrivalEta && (
                    <div className="text-blue-600 dark:text-blue-400 font-medium">
                      • Arrival expected at {room.arrivalEta}
                    </div>
                  )}

                  {room.notes && (
                    <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg mt-1">
                      {room.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/40">
                {isDirty ? (
                  <button
                    onClick={() => handleMarkClean(room.id)}
                    disabled={isPending}
                    className="w-full h-11 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-500 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✨ Tap to Mark Clean</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold px-2 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Ready for Guest
                    </span>
                    <button
                      onClick={() => {
                        setRooms((prev) =>
                          prev.map((r) =>
                            r.id === room.id ? { ...r, hkStatus: "dirty" } : r
                          )
                        );
                      }}
                      className="text-[10px] text-muted-foreground hover:text-rose-500 underline"
                    >
                      Make Dirty
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
