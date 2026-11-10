import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  stayOnDate,
  type Stay,
  type Room,
} from "../../lib/front-office-store";

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

/** Monday=0 … Sunday=6 for grid start. */
function mondayOffset(ymdStr: string): number {
  const dow = new Date(`${ymdStr}T12:00:00`).getDay(); // 0 Sun
  return (dow + 6) % 7;
}

export type DayPulse = {
  date: string;
  occPct: number;
  arrivals: number;
  departures: number;
  inHouse: number;
};

function buildPulses(
  monthAnchor: string,
  stays: Stay[],
  rooms: Room[],
): Map<string, DayPulse> {
  const start = monthStart(monthAnchor);
  const n = daysInMonth(start);
  const map = new Map<string, DayPulse>();
  for (let i = 0; i < n; i += 1) {
    const date = addDays(start, i);
    const occupied = rooms.filter((r) =>
      stays.some((s) => s.roomId === r.id && stayOnDate(s, date)),
    ).length;
    const arrivals = stays.filter(
      (s) =>
        s.checkIn === date && ["confirmed", "held", "checked_in"].includes(s.status),
    ).length;
    const departures = stays.filter(
      (s) =>
        s.checkOut === date &&
        ["checked_in", "checked_out"].includes(s.status),
    ).length;
    const inHouse = stays.filter(
      (s) => s.status === "checked_in" && stayOnDate(s, date),
    ).length;
    map.set(date, {
      date,
      occPct: rooms.length ? Math.round((occupied / rooms.length) * 100) : 0,
      arrivals,
      departures,
      inHouse,
    });
  }
  return map;
}

function heatClass(occPct: number): string {
  if (occPct >= 90) return "bg-[rgba(239,68,68,0.22)] text-[var(--hos-ruby)]";
  if (occPct >= 70) return "bg-[rgba(245,158,11,0.2)] text-[var(--hos-brass-ink)]";
  if (occPct >= 40) return "bg-[rgba(59,130,246,0.16)] text-[var(--hos-primary)]";
  if (occPct > 0) return "bg-[rgba(16,185,129,0.14)] text-[var(--hos-emerald)]";
  return "bg-[var(--hos-cell)] text-[var(--hos-ink)]";
}

export function MobileMonthCalendar({
  monthAnchor,
  selected,
  today,
  stays,
  rooms,
  onSelectDate,
  onChangeMonth,
}: {
  monthAnchor: string;
  selected: string;
  today: string;
  stays: Stay[];
  rooms: Room[];
  onSelectDate: (ymd: string) => void;
  onChangeMonth: (monthStartYmd: string) => void;
}) {
  const reduce = useReducedMotion();
  const start = monthStart(monthAnchor);
  const pulses = useMemo(
    () => buildPulses(start, stays, rooms),
    [start, stays, rooms],
  );
  const offset = mondayOffset(start);
  const count = daysInMonth(start);
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => addDays(start, i)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const title = new Date(`${start}T12:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="hos-luxury-card flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)]"
          aria-label="Previous month"
          onClick={() => onChangeMonth(addMonths(start, -1))}
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <div className="min-w-0 text-center">
          <p className="m-0 text-[15px] font-bold tracking-tight text-[var(--hos-ink)]">
            {title}
          </p>
          <p className="m-0 mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
            Tap a day · heat = occupancy
          </p>
        </div>
        <button
          type="button"
          className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)]"
          aria-label="Next month"
          onClick={() => onChangeMonth(addMonths(start, 1))}
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]"
          >
            {d}
          </div>
        ))}
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`e-${idx}`} className="min-h-[56px] rounded-xl" />;
          }
          const pulse = pulses.get(date);
          const active = date === selected;
          const isToday = date === today;
          const occ = pulse?.occPct ?? 0;
          return (
            <motion.button
              key={date}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.94 }}
              onClick={() => onSelectDate(date)}
              className={[
                "relative flex min-h-[56px] flex-col items-center justify-between rounded-xl px-0.5 py-1.5 transition",
                active
                  ? "bg-[#111] text-white shadow-[0_10px_24px_-12px_#111]"
                  : heatClass(occ),
                isToday && !active ? "ring-1 ring-[var(--hos-primary)]" : "",
              ].join(" ")}
              aria-label={`${date} occupancy ${occ}%`}
              aria-pressed={active}
            >
              <span
                className={[
                  "font-mono text-[13px] font-black tabular-nums leading-none",
                  active ? "text-white" : "",
                ].join(" ")}
              >
                {date.slice(8, 10)}
              </span>
              <span
                className={[
                  "font-mono text-[9px] font-bold tabular-nums",
                  active ? "text-white/75" : "opacity-80",
                ].join(" ")}
              >
                {occ}%
              </span>
              <span className="flex h-1.5 items-center justify-center gap-0.5">
                {(pulse?.arrivals ?? 0) > 0 ? (
                  <span
                    className={[
                      "size-1.5 rounded-full",
                      active ? "bg-[var(--hos-gold)]" : "bg-[var(--hos-gold)]",
                    ].join(" ")}
                    title="Arrivals"
                  />
                ) : null}
                {(pulse?.departures ?? 0) > 0 ? (
                  <span
                    className={[
                      "size-1.5 rounded-full",
                      active ? "bg-white/80" : "bg-[var(--hos-ruby)]",
                    ].join(" ")}
                    title="Departures"
                  />
                ) : null}
                {(pulse?.inHouse ?? 0) > 0 &&
                !(pulse?.arrivals || pulse?.departures) ? (
                  <span
                    className={[
                      "size-1.5 rounded-full",
                      active ? "bg-[var(--hos-emerald)]" : "bg-[var(--hos-emerald)]",
                    ].join(" ")}
                    title="In-house"
                  />
                ) : null}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-[var(--hos-ink-3)]">
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-[var(--hos-gold)]" /> Arrivals
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-[var(--hos-ruby)]" /> Departures
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-[var(--hos-emerald)]" /> In-house
        </span>
      </div>
    </div>
  );
}

export function staysForCalendarDay(stays: Stay[], date: string): Stay[] {
  return stays
    .filter((s) => {
      if (["cancelled", "no_show"].includes(s.status)) return false;
      if (s.checkIn === date || s.checkOut === date) return true;
      if (s.status === "checked_in" && stayOnDate(s, date)) return true;
      if (
        ["confirmed", "held"].includes(s.status) &&
        s.checkIn <= date &&
        date < s.checkOut
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      const rank = (s: Stay) =>
        s.checkIn === date ? 0 : s.checkOut === date ? 1 : 2;
      return rank(a) - rank(b) || a.guestName.localeCompare(b.guestName);
    });
}
