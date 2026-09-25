"use client";

import type {
  RackStay,
  RackUnit,
  RoomBlock,
  UnassignedBooking,
} from "@/components/erp/RoomRackGrid";
import { AgentNameLink } from "@/components/erp/AgentNameLink";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseISO } from "date-fns";
import {
  CalendarRangeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-BT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Thimphu",
  });
}

type DayFilter = "all" | "arrivals" | "departures" | "vacant" | "ooo";

type RoomRowStatus =
  | "vacant"
  | "arrival"
  | "stay"
  | "depart"
  | "ooo"
  | "dirty";

function statusForUnit(
  unit: RackUnit,
  date: string,
  stays: RackStay[],
  blocks: RoomBlock[],
): { status: RoomRowStatus; stay: RackStay | null; block: RoomBlock | null } {
  const block = blocks.find(
    (b) =>
      b.room_unit_id === unit.id &&
      b.from_date <= date &&
      date < b.to_date &&
      (b.block_kind === "ooo" || b.block_kind === "oos"),
  );
  if (block) return { status: "ooo", stay: null, block };

  const stay =
    stays.find(
      (s) =>
        s.room_unit_id === unit.id &&
        s.from_date <= date &&
        date < s.to_date,
    ) ?? null;

  if (!stay) {
    if (unit.hk_status === "dirty" || unit.hk_status === "inspect") {
      return { status: "dirty", stay: null, block: null };
    }
    return { status: "vacant", stay: null, block: null };
  }
  if (stay.check_in === date) return { status: "arrival", stay, block: null };
  if (stay.check_out === date) return { status: "depart", stay, block: null };
  return { status: "stay", stay, block: null };
}

const STATUS_STYLES: Record<RoomRowStatus, string> = {
  vacant: "bg-muted text-muted-foreground",
  arrival: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  stay: "bg-citrus/15 text-citrus",
  depart: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  ooo: "bg-maroon/15 text-maroon",
  dirty: "bg-rose-500/15 text-rose-800 dark:text-rose-200",
};

const STATUS_LABEL: Record<RoomRowStatus, string> = {
  vacant: "Vacant",
  arrival: "Arrival",
  stay: "In-house",
  depart: "Depart",
  ooo: "OOO",
  dirty: "Dirty",
};

/**
 * Phone-first calendar surface: one date × rooms list (not a 30-day Gantt).
 * Compact chrome so short phones still show the room list.
 */
export function RoomDayBoard({
  units,
  stays,
  blocks,
  unassigned,
  today,
  selectedDate,
  onDateChange,
  onOpenStay,
  onBookVacant,
  onAssignUnassigned,
  onBookFab,
  onOpenTimeline,
}: {
  units: RackUnit[];
  stays: RackStay[];
  blocks: RoomBlock[];
  unassigned: UnassignedBooking[];
  today: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenStay: (stay: RackStay) => void;
  onBookVacant: (unit: RackUnit, date: string) => void;
  onAssignUnassigned: (item: UnassignedBooking) => void;
  onBookFab: () => void;
  onOpenTimeline?: () => void;
}) {
  const [filter, setFilter] = useState<DayFilter>("all");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const groups = useMemo(() => {
    const byType = new Map<
      string,
      { name: string; code: string; rows: typeof units }
    >();
    for (const unit of units) {
      const key = unit.room_type_id;
      if (!byType.has(key)) {
        byType.set(key, {
          name: unit.room_type_name,
          code: unit.room_type_code,
          rows: [],
        });
      }
      byType.get(key)!.rows.push(unit);
    }
    return [...byType.values()];
  }, [units]);

  /** ±3 days strip for quick jump without opening a huge window */
  const weekStrip = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3)),
    [selectedDate],
  );

  const q = query.trim().toLowerCase();

  const needsRoom = unassigned.filter(
    (u) => u.check_in <= selectedDate && selectedDate < u.check_out,
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-1.5 border-b bg-background px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0"
            aria-label="Previous day"
            onClick={() => onDateChange(addDays(selectedDate, -1))}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold leading-tight">
              {fmtDay(selectedDate)}
            </p>
            {selectedDate !== today ? (
              <button
                type="button"
                className="text-[11px] text-accent underline-offset-2 hover:underline"
                onClick={() => onDateChange(today)}
              >
                Today
              </button>
            ) : (
              <p className="text-[10px] text-muted-foreground">Today</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0"
            aria-label="Next day"
            onClick={() => onDateChange(addDays(selectedDate, 1))}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                aria-label="Go to date"
              >
                <CalendarRangeIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={parseISO(`${selectedDate}T12:00:00`)}
                defaultMonth={parseISO(`${selectedDate}T12:00:00`)}
                onSelect={(d) => {
                  if (!d) return;
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  onDateChange(`${y}-${m}-${day}`);
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant={showSearch || q ? "secondary" : "outline"}
            size="icon"
            className="size-10 shrink-0"
            aria-label="Search"
            aria-pressed={showSearch}
            onClick={() => setShowSearch((v) => !v)}
          >
            <SearchIcon className="size-4" />
          </Button>
        </div>

        {/* Horizontal day chips — fits phones without a Gantt */}
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {weekStrip.map((d) => {
            const active = d === selectedDate;
            const isToday = d === today;
            const short = new Date(`${d}T12:00:00`).toLocaleDateString("en-BT", {
              weekday: "narrow",
              day: "numeric",
              timeZone: "Asia/Thimphu",
            });
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDateChange(d)}
                className={cn(
                  "flex h-9 min-w-10 shrink-0 flex-col items-center justify-center rounded-md border px-1.5 text-[10px] leading-none",
                  active
                    ? "border-accent bg-accent/15 font-semibold text-accent"
                    : "bg-card text-muted-foreground",
                  isToday && !active && "border-accent/40",
                )}
              >
                {short}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(
            [
              ["all", "All"],
              ["arrivals", "In"],
              ["departures", "Out"],
              ["vacant", "Free"],
              ["ooo", "OOO"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "h-8 shrink-0 rounded-md border px-2.5 text-xs font-medium",
                filter === key
                  ? "border-accent bg-accent/10 text-accent"
                  : "bg-card text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
          {onOpenTimeline ? (
            <button
              type="button"
              onClick={onOpenTimeline}
              className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-accent"
            >
              <CalendarRangeIcon className="size-3.5" aria-hidden />
              Timeline
            </button>
          ) : null}
        </div>

        {showSearch || q ? (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Guest, phone, room…"
            className="h-9"
            autoFocus={showSearch}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {needsRoom.length > 0 ? (
          <section className="mb-3 rounded-lg border border-amber-500/30 bg-amber-50/40 p-2.5 dark:bg-amber-950/20">
            <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Needs room ({needsRoom.length})
            </h2>
            <ul className="mt-1.5 space-y-1.5">
              {needsRoom.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onAssignUnassigned(u)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm active:bg-muted/50"
                  >
                    <p className="font-medium">{u.contact_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.room_type_name} · {u.missing_rooms} missing ·{" "}
                      {u.check_in} → {u.check_out}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                      Tap to assign →
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {groups.map((group) => {
          const rows = group.rows
            .map((unit) => {
              const info = statusForUnit(unit, selectedDate, stays, blocks);
              return { unit, ...info };
            })
            .filter((row) => {
              if (filter === "arrivals" && row.status !== "arrival")
                return false;
              if (filter === "departures" && row.status !== "depart")
                return false;
              if (filter === "vacant" && row.status !== "vacant") return false;
              if (filter === "ooo" && row.status !== "ooo") return false;
              if (!q) return true;
              const hay = [
                row.unit.label,
                row.stay?.contact_name,
                row.stay?.contact_phone,
                row.stay?.agent_name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return hay.includes(q);
            });

          if (rows.length === 0) return null;

          return (
            <section key={group.name} className="mb-3">
              <h2 className="sticky top-0 z-[1] bg-background/95 py-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase backdrop-blur">
                {group.name}
              </h2>
              <ul className="space-y-1">
                {rows.map(({ unit, status, stay }) => (
                  <li key={unit.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (stay) onOpenStay(stay);
                        else if (status === "vacant" || status === "dirty")
                          onBookVacant(unit, selectedDate);
                      }}
                      className="flex min-h-12 w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left active:bg-muted/40"
                    >
                      <span className="w-11 shrink-0 text-base font-semibold tabular-nums">
                        {unit.label}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                          STATUS_STYLES[status],
                        )}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {stay?.contact_name ??
                          (status === "ooo" ? "Blocked" : "—")}
                        {stay?.agent_name ? (
                          <span className="text-muted-foreground">
                            {" "}
                            ·{" "}
                            <AgentNameLink
                              agentId={stay.agent_id}
                              name={stay.agent_name}
                              className="text-sm"
                            />
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {units.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No rooms on this property yet.
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="citrus"
        size="icon"
        className="fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 size-12 rounded-full shadow-lg md:hidden"
        aria-label="Book stay"
        onClick={onBookFab}
      >
        <PlusIcon className="size-5" />
      </Button>
    </div>
  );
}
