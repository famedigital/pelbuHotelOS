import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  stayOnDate,
  type Room,
  type Stay,
} from "../../lib/front-office-store";

/** Thin room gutter — freeze-pane left. */
const LABEL_W = 44;
/** Day cell width — enough for a truncated guest name. */
const CELL_W = 76;
const ROW_H = 34;
const HEAD_H = 32;

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 10);
  const last = parts[parts.length - 1]!;
  return `${parts[0]![0]}. ${last}`.slice(0, 12);
}

function cellStay(
  stays: Stay[],
  roomId: string,
  date: string,
): Stay | undefined {
  return stays.find(
    (s) =>
      s.roomId === roomId &&
      !["cancelled", "no_show"].includes(s.status) &&
      stayOnDate(s, date),
  );
}

function cellTone(stay: Stay | undefined, ooo: boolean): string {
  if (ooo) return "bg-[rgba(239,68,68,0.14)] text-[var(--hos-ruby)]";
  if (!stay) return "bg-[var(--hos-cell)] active:bg-[rgba(16,185,129,0.14)]";
  if (stay.status === "checked_in")
    return "bg-[rgba(16,185,129,0.88)] text-white";
  if (stay.status === "held")
    return "bg-[rgba(245,158,11,0.85)] text-[#1a1200]";
  return "bg-[rgba(37,99,235,0.88)] text-white";
}

/**
 * Mobile StayView calendar = room × date rack (not month sheet).
 * Sticky date header (freeze pane) + thin sticky room column.
 */
export function MobileRackCalendar({
  today,
  anchor,
  days = 10,
  rooms,
  stays,
  onShiftAnchor,
  onSelectStay,
  onBookCell,
}: {
  today: string;
  anchor: string;
  days?: number;
  rooms: Room[];
  stays: Stay[];
  onShiftAnchor: (deltaDays: number) => void;
  onSelectStay: (stayId: string) => void;
  onBookCell: (room: Room, date: string) => void;
}) {
  const dates = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(anchor, i)),
    [anchor, days],
  );

  const byFloor = useMemo(() => {
    const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
    return floors.map((floor) => ({
      floor,
      rooms: rooms.filter((r) => r.floor === floor),
    }));
  }, [rooms]);

  const width = LABEL_W + dates.length * CELL_W;
  const rangeLabel = `${dates[0]?.slice(5) ?? ""} → ${dates[dates.length - 1]?.slice(5) ?? ""}`;

  return (
    <div className="hos-mobile-rack flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
            Rack calendar
          </p>
          <p className="m-0 mt-0.5 font-mono text-[11px] tabular-nums text-[var(--hos-ink-2)]">
            {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="hos-btn-tactile inline-flex size-8 items-center justify-center rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)]"
            aria-label="Previous days"
            onClick={() => onShiftAnchor(-days)}
          >
            <ChevronLeft className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="hos-btn-tactile inline-flex h-8 items-center rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 text-[11px] font-bold"
            onClick={() => onShiftAnchor(0)}
          >
            Today
          </button>
          <button
            type="button"
            className="hos-btn-tactile inline-flex size-8 items-center justify-center rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)]"
            aria-label="Next days"
            onClick={() => onShiftAnchor(days)}
          >
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 px-0.5 text-[10px] font-semibold text-[var(--hos-ink-3)]">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm bg-[rgba(37,99,235,0.88)]" /> Own
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm bg-[rgba(16,185,129,0.88)]" /> In-house
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm border border-[var(--hos-line)] bg-[var(--hos-cell)]" /> Free
        </span>
      </div>

      <div
        className="hos-scrollbar-slim min-h-0 flex-1 overflow-auto rounded-[14px] border border-[var(--hos-line)] bg-[var(--hos-cell)]"
        style={{
          /* Bounded pane so sticky date header freezes while rooms scroll */
          maxHeight:
            "calc(100dvh - var(--mobile-dock-height) - env(safe-area-inset-bottom, 0px) - 7.5rem)",
          minHeight: "18rem",
        }}
      >
        <div style={{ width, minWidth: "100%" }}>
          {/* Freeze-pane date header */}
          <div
            className="sticky top-0 z-[4] flex border-b border-[var(--hos-line)] bg-[var(--hos-cell)]"
            style={{ height: HEAD_H }}
          >
            <div
              className="sticky left-0 z-[5] flex items-center justify-center border-r border-[var(--hos-line)] bg-[var(--hos-cell)] text-[9px] font-black uppercase tracking-[0.1em] text-[var(--hos-ink-3)]"
              style={{ width: LABEL_W, minWidth: LABEL_W }}
            >
              Rm
            </div>
            {dates.map((d) => {
              const isToday = d === today;
              return (
                <div
                  key={d}
                  className={[
                    "flex flex-col items-center justify-center border-r border-[var(--hos-line)] font-mono text-[10px] font-bold tabular-nums",
                    isToday
                      ? "bg-[rgba(59,130,246,0.14)] text-[var(--hos-primary)]"
                      : "text-[var(--hos-ink-3)]",
                  ].join(" ")}
                  style={{ width: CELL_W, minWidth: CELL_W }}
                >
                  {d.slice(5)}
                </div>
              );
            })}
          </div>

          {byFloor.map(({ floor, rooms: floorRooms }) => (
            <div key={floor}>
              <div
                className="sticky left-0 z-[2] flex items-center border-b border-[var(--hos-line)] bg-[rgba(37,99,235,0.06)] px-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--hos-ink-2)]"
                style={{ width, height: 22 }}
              >
                Floor {floor}
              </div>
              {floorRooms.map((room) => {
                const ooo = room.hkStatus === "ooo";
                return (
                  <div
                    key={room.id}
                    className="relative flex border-b border-[var(--hos-line)]"
                    style={{ height: ROW_H }}
                  >
                    <div
                      className="sticky left-0 z-[3] flex items-center justify-center border-r border-[var(--hos-line)] bg-[var(--hos-cell)] font-mono text-[11px] font-bold tabular-nums text-[var(--hos-ink)]"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                      title={`${room.number} · ${room.typeCode}`}
                    >
                      {room.number}
                    </div>
                    <div className="relative flex flex-1">
                      {dates.map((d) => {
                        const stay = cellStay(stays, room.id, d);
                        const free = !stay && !ooo;
                        const isToday = d === today;
                        return (
                          <button
                            key={d}
                            type="button"
                            title={
                              stay
                                ? `${stay.guestName} · ${stay.checkIn}→${stay.checkOut}`
                                : ooo
                                  ? "Out of order"
                                  : `Book Rm ${room.number} · ${d}`
                            }
                            disabled={ooo}
                            onClick={() => {
                              if (stay) onSelectStay(stay.id);
                              else if (free) onBookCell(room, d);
                            }}
                            className={[
                              "flex items-center overflow-hidden border-r border-[var(--hos-line)] px-1 text-left text-[9px] font-semibold leading-tight",
                              cellTone(stay, ooo),
                              isToday && !stay && !ooo
                                ? "bg-[rgba(59,130,246,0.06)]"
                                : "",
                              free ? "cursor-pointer" : "",
                              ooo ? "cursor-not-allowed opacity-70" : "",
                            ].join(" ")}
                            style={{ width: CELL_W, minWidth: CELL_W, height: ROW_H }}
                          >
                            <span className="truncate">
                              {ooo
                                ? "OOO"
                                : stay
                                  ? shortName(stay.guestName)
                                  : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
