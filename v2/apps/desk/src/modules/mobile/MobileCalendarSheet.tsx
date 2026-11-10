import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, StaySheet } from "@hos-v2/ui";
import {
  addDays,
  stayOnDate,
  type Room,
  type Stay,
} from "../../lib/front-office-store";
import { staysForCalendarDay } from "./MobileMonthCalendar";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function monthStart(ymdStr: string): string {
  return `${ymdStr.slice(0, 7)}-01`;
}

function addMonths(ymdStr: string, delta: number): string {
  const d = new Date(`${ymdStr.slice(0, 7)}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function daysInMonth(ymdStr: string): number {
  const y = Number(ymdStr.slice(0, 4));
  const m = Number(ymdStr.slice(5, 7));
  return new Date(y, m, 0).getDate();
}

function mondayOffset(ymdStr: string): number {
  const dow = new Date(`${ymdStr}T12:00:00`).getDay();
  return (dow + 6) % 7;
}

type DayMarks = {
  arrivals: number;
  departures: number;
  inHouse: number;
};

function buildMarks(
  monthAnchor: string,
  stays: Stay[],
): Map<string, DayMarks> {
  const start = monthStart(monthAnchor);
  const n = daysInMonth(start);
  const map = new Map<string, DayMarks>();
  for (let i = 0; i < n; i += 1) {
    const date = addDays(start, i);
    map.set(date, {
      arrivals: stays.filter(
        (s) =>
          s.checkIn === date &&
          ["confirmed", "held", "checked_in"].includes(s.status),
      ).length,
      departures: stays.filter(
        (s) =>
          s.checkOut === date &&
          ["checked_in", "checked_out"].includes(s.status),
      ).length,
      inHouse: stays.filter(
        (s) =>
          !["cancelled", "no_show"].includes(s.status) && stayOnDate(s, date),
      ).length,
    });
  }
  return map;
}

/**
 * Mobile calendar as a bottom sheet — clean month grid (not occupancy heat map).
 * Tap a day to select and dismiss.
 */
export function MobileCalendarSheet({
  open,
  onOpenChange,
  selected,
  today,
  stays,
  rooms,
  onSelectDate,
  title = "Calendar",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string;
  today: string;
  stays: Stay[];
  rooms: Room[];
  onSelectDate: (ymd: string) => void;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const [monthAnchor, setMonthAnchor] = useState(() => monthStart(selected));
  const [draft, setDraft] = useState(selected);

  const start = monthStart(monthAnchor);
  const marks = useMemo(() => buildMarks(start, stays), [start, stays]);
  const dayStays = useMemo(
    () => staysForCalendarDay(stays, draft),
    [stays, draft],
  );

  const offset = mondayOffset(start);
  const count = daysInMonth(start);
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => addDays(start, i)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthTitle = new Date(`${start}T12:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const draftPretty = new Date(`${draft}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const occForDraft = rooms.length
    ? Math.round(
        (rooms.filter((r) =>
          stays.some((s) => s.roomId === r.id && stayOnDate(s, draft)),
        ).length /
          rooms.length) *
          100,
      )
    : 0;

  return (
    <StaySheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setMonthAnchor(monthStart(selected));
          setDraft(selected);
        }
        onOpenChange(next);
      }}
      title={title}
      subtitle={draftPretty}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="min-h-12 flex-1 !rounded-2xl"
            onClick={() => {
              setDraft(today);
              setMonthAnchor(monthStart(today));
            }}
          >
            Today
          </Button>
          <Button
            className="hos-btn-ink min-h-12 flex-[1.4] !rounded-2xl"
            onClick={() => {
              onSelectDate(draft);
              onOpenChange(false);
            }}
          >
            Use {draftPretty}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-surface)]"
            aria-label="Previous month"
            onClick={() => setMonthAnchor(addMonths(start, -1))}
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <p className="m-0 text-[16px] font-bold tracking-tight text-[var(--hos-ink)]">
            {monthTitle}
          </p>
          <button
            type="button"
            className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-surface)]"
            aria-label="Next month"
            onClick={() => setMonthAnchor(addMonths(start, 1))}
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </div>

        {/* Clean calendar sheet grid — date numbers + event dots only */}
        <div className="rounded-[18px] border border-[var(--hos-line)] bg-[var(--hos-surface)] p-2.5">
          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1.5 text-center text-[11px] font-bold text-[var(--hos-ink-3)]"
              >
                {d}
              </div>
            ))}
            {cells.map((date, idx) => {
              if (!date) {
                return <div key={`e-${idx}`} className="aspect-square" />;
              }
              const m = marks.get(date);
              const active = date === draft;
              const isToday = date === today;
              const hasDots =
                (m?.arrivals ?? 0) +
                  (m?.departures ?? 0) +
                  (m?.inHouse ?? 0) >
                0;
              return (
                <motion.button
                  key={date}
                  type="button"
                  whileTap={reduce ? undefined : { scale: 0.9 }}
                  onClick={() => setDraft(date)}
                  aria-label={date}
                  aria-pressed={active}
                  className={[
                    "relative mx-auto flex aspect-square w-full max-w-[44px] flex-col items-center justify-center rounded-full text-[15px] font-semibold tabular-nums transition",
                    active
                      ? "bg-[var(--hos-primary)] text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.7)]"
                      : isToday
                        ? "bg-[rgba(37,99,235,0.12)] font-bold text-[var(--hos-primary)]"
                        : "text-[var(--hos-ink)] hover:bg-[rgba(15,23,42,0.05)]",
                  ].join(" ")}
                >
                  {date.slice(8, 10).replace(/^0/, "")}
                  {hasDots ? (
                    <span className="absolute bottom-1 flex gap-0.5">
                      {(m?.arrivals ?? 0) > 0 ? (
                        <span
                          className={[
                            "size-1 rounded-full",
                            active ? "bg-white" : "bg-[var(--hos-gold)]",
                          ].join(" ")}
                        />
                      ) : null}
                      {(m?.departures ?? 0) > 0 ? (
                        <span
                          className={[
                            "size-1 rounded-full",
                            active ? "bg-white/80" : "bg-[var(--hos-ruby)]",
                          ].join(" ")}
                        />
                      ) : null}
                      {(m?.inHouse ?? 0) > 0 &&
                      !(m?.arrivals || m?.departures) ? (
                        <span
                          className={[
                            "size-1 rounded-full",
                            active ? "bg-white/70" : "bg-[var(--hos-emerald)]",
                          ].join(" ")}
                        />
                      ) : null}
                    </span>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-[var(--hos-ink-3)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--hos-gold)]" /> Arrival
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--hos-ruby)]" /> Departure
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--hos-emerald)]" /> Stay
          </span>
        </div>

        <div className="rounded-[16px] border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="m-0 text-[13px] font-bold text-[var(--hos-ink)]">
                {draftPretty}
              </p>
              <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                {dayStays.length} stay{dayStays.length === 1 ? "" : "s"} on sheet
              </p>
            </div>
            <Badge tone="default">{occForDraft}% occ</Badge>
          </div>
          {dayStays.length > 0 ? (
            <ul className="m-0 mt-2.5 max-h-[140px] list-none space-y-1.5 overflow-y-auto p-0">
              {dayStays.slice(0, 8).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] bg-[var(--hos-surface)] px-2.5 py-2 text-[12px]"
                >
                  <span className="min-w-0 truncate font-semibold text-[var(--hos-ink)]">
                    {s.guestName}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--hos-ink-3)]">
                    {s.checkIn === draft
                      ? "Arr"
                      : s.checkOut === draft
                        ? "Dep"
                        : `Rm ${s.roomNumber ?? "—"}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-2 text-[12px] text-[var(--hos-ink-3)]">
              No bookings on this date.
            </p>
          )}
        </div>
      </div>
    </StaySheet>
  );
}
