"use client";

import {
  assignCalendarBookingRoom,
  moveCalendarAssignment,
  moveCalendarAssignmentCrossType,
  previewCalendarCrossTypeMove,
  releaseCalendarRoomBlock,
  setCalendarAssignmentLock,
  undoCalendarAssignmentMove,
} from "@/app/actions/erp-calendar";
import { CalendarLiveRefresh } from "@/components/erp/CalendarLiveRefresh";
import { CalendarReservationEditDialog } from "@/components/erp/CalendarReservationEditDialog";
import { CalendarRoomBlockDialog } from "@/components/erp/CalendarRoomBlockDialog";
import {
  CalendarReservationDialog,
  type CalendarAgent,
  type CalendarSelection,
  type CalendarSelectedUnit,
} from "@/components/erp/CalendarReservationDialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type RackUnit = {
  id: string;
  label: string;
  floor_label: string | null;
  sort_order: number;
  room_type_id: string;
  room_type_code: string;
  room_type_name: string;
  hk_status?: string | null;
};

export type RackStay = {
  id: string;
  booking_id: string;
  room_unit_id: string;
  from_date: string;
  to_date: string;
  is_locked: boolean;
  lock_reason: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  check_in: string;
  check_out: string;
  adults: number;
  rooms: number;
  guide_number: string | null;
  agent_id: string | null;
  payment_mode: string | null;
  source: string | null;
  booked_by_role: string | null;
  guest_origin: string | null;
  notes: string | null;
  agent_name: string | null;
  group_name: string | null;
  folio_id: string | null;
  room_label: string;
  room_type_id: string;
  room_type_name: string;
};

export type UnassignedBooking = {
  id: string;
  booking_id: string;
  contact_name: string;
  contact_phone: string | null;
  status: string;
  check_in: string;
  check_out: string;
  room_type_id: string;
  room_type_code: string;
  room_type_name: string;
  missing_rooms: number;
  agent_name: string | null;
};

export type RoomBlock = {
  id: string;
  room_unit_id: string;
  block_kind: "ooo" | "oos" | "hold";
  from_date: string;
  to_date: string;
  reason: string;
};

const CELL = 44;
const LEFT = 340;
const LEFT_GRID_COLUMNS = "56px 32px minmax(120px, 1fr) minmax(72px, 88px)";
const ROW_H = 40;
const HEADER_H = 48;
const FOOTER_H = 32;
const TOOLBAR_H = 40;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayIndex(start: string, day: string): number {
  const a = new Date(`${start}T12:00:00Z`).getTime();
  const b = new Date(`${day}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, dayIndex(checkIn, checkOut));
}

function fmtHeader(iso: string): { dow: string; day: string; mon: string } {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dow: d.toLocaleDateString("en-BT", {
      weekday: "short",
      timeZone: "Asia/Thimphu",
    }),
    day: d.toLocaleDateString("en-BT", {
      day: "2-digit",
      timeZone: "Asia/Thimphu",
    }),
    mon: d.toLocaleDateString("en-BT", {
      month: "short",
      timeZone: "Asia/Thimphu",
    }),
  };
}

function statusBarClass(status: string): string {
  if (status === "checked_in") return "bg-citrus text-white border-citrus";
  if (status === "confirmed") return "bg-sky-600 text-white border-sky-700";
  if (status === "pending" || status === "held")
    return "bg-amber-400 text-foreground border-amber-500";
  return "bg-muted text-foreground border-border";
}

function hkStatusClass(status?: string | null): string {
  if (status === "clean") return "bg-emerald-500";
  if (status === "dirty") return "bg-rose-500";
  if (status === "inspect") return "bg-amber-500";
  if (status === "ooo") return "bg-slate-500";
  if (status === "occupied") return "bg-sky-500";
  return "bg-muted-foreground/40";
}

function blockBarClass(kind: RoomBlock["block_kind"]): string {
  if (kind === "ooo") return "border-slate-700 bg-slate-700 text-white";
  if (kind === "oos") return "border-rose-700 bg-rose-600 text-white";
  return "border-violet-600 bg-violet-500 text-white";
}

function sourceAbbreviation(stay: RackStay): string {
  const source = stay.booked_by_role || stay.source;
  return (
    {
      owner: "O",
      reservation: "R",
      agent: "A",
      mou_agent: "M",
      client: "D",
      ota: "OTA",
    }[source ?? ""] ?? "R"
  );
}

function groupTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 55%)`;
}

function occupancyTone(percent: number): {
  card: string;
  bar: string;
  value: string;
} {
  if (percent >= 80) {
    return {
      card: "border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/25",
      bar: "bg-gradient-to-r from-emerald-400 to-emerald-600",
      value: "text-emerald-700 dark:text-emerald-300",
    };
  }
  if (percent >= 50) {
    return {
      card: "border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/25",
      bar: "bg-gradient-to-r from-amber-300 to-amber-500",
      value: "text-amber-700 dark:text-amber-300",
    };
  }
  return {
    card: "border-sky-300 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/25",
    bar: "bg-gradient-to-r from-sky-300 to-sky-600",
    value: "text-sky-700 dark:text-sky-300",
  };
}

type DayFilter = "arrivals" | "in_house" | "departures";

function isWeekend(iso: string): boolean {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

type DragSel = {
  unitStart: number;
  unitEnd: number;
  dayStart: number;
  dayEnd: number;
};

function normalizeSel(s: DragSel): DragSel {
  return {
    unitStart: Math.min(s.unitStart, s.unitEnd),
    unitEnd: Math.max(s.unitStart, s.unitEnd),
    dayStart: Math.min(s.dayStart, s.dayEnd),
    dayEnd: Math.max(s.dayStart, s.dayEnd),
  };
}

function selectionConflicts(
  sel: DragSel,
  units: RackUnit[],
  staysByUnit: Map<string, RackStay[]>,
  blocksByUnit: Map<string, RoomBlock[]>,
  days: string[],
): string | null {
  const n = normalizeSel(sel);
  const checkIn = days[n.dayStart];
  const checkOut = addDays(days[n.dayEnd], 1);
  for (let ui = n.unitStart; ui <= n.unitEnd; ui++) {
    const unit = units[ui];
    if (!unit) continue;
    for (const stay of staysByUnit.get(unit.id) ?? []) {
      if (stay.from_date < checkOut && stay.to_date > checkIn) {
        return `${unit.label} occupied ${stay.from_date}→${stay.to_date}`;
      }
    }
    for (const block of blocksByUnit.get(unit.id) ?? []) {
      if (block.from_date < checkOut && block.to_date > checkIn) {
        return `${unit.label} blocked ${block.from_date}→${block.to_date}: ${block.reason}`;
      }
    }
  }
  return null;
}

function StayHoverCard({
  stay,
  suppressed,
  onOpenDetail,
}: {
  stay: RackStay;
  suppressed: boolean;
  onOpenDetail: () => void;
}) {
  const nights = nightsBetween(stay.check_in, stay.check_out);
  // Controlled for the whole lifetime — flipping between `false` and
  // `undefined` while dragging makes Radix warn about switching modes.
  const [open, setOpen] = useState(false);
  return (
    <HoverCard
      openDelay={300}
      closeDelay={100}
      open={suppressed ? false : open}
      onOpenChange={setOpen}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-[calc(100%-8px)] w-full items-center overflow-hidden rounded-md border px-1.5 text-left text-[11px] font-medium shadow-sm",
            statusBarClass(stay.status),
          )}
          onClick={onOpenDetail}
        >
          <span className="mr-1 shrink-0 rounded border border-current/25 bg-black/10 px-1 font-mono text-[8px] font-bold">
            {sourceAbbreviation(stay)}
          </span>
          {stay.group_name ? (
            <span
              className="mr-1 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: groupTint(stay.group_name) }}
              title={stay.group_name}
            />
          ) : null}
          <span className="truncate">{stay.contact_name ?? "Guest"}</span>
          {stay.guide_number ? (
            <span className="ml-1 shrink-0 text-[8px] opacity-90" title={`Guide ${stay.guide_number}`}>
              G
            </span>
          ) : null}
          {stay.payment_mode === "on_credit" ? (
            <span className="ml-0.5 shrink-0 text-[8px] opacity-90" title="On credit">
              $
            </span>
          ) : null}
          {stay.is_locked ? (
            <span className="ml-auto pl-1 text-[9px]" aria-label="Assignment locked">
              ◆
            </span>
          ) : null}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="erp z-50 space-y-2 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-foreground">
              {stay.contact_name ?? "Guest"}
            </p>
            <p className="text-xs text-muted-foreground">
              {stay.room_label} · {stay.room_type_name}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              statusBarClass(stay.status),
            )}
          >
            {stay.status.replace(/_/g, " ")}
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Stay</dt>
          <dd>
            {stay.check_in} → {stay.check_out} · {nights}n
          </dd>
          <dt className="text-muted-foreground">Pax</dt>
          <dd>
            {stay.adults} adult{stay.adults === 1 ? "" : "s"} · {stay.rooms} room
            {stay.rooms === 1 ? "" : "s"}
          </dd>
          {stay.agent_name ? (
            <>
              <dt className="text-muted-foreground">Agent</dt>
              <dd>{stay.agent_name}</dd>
            </>
          ) : null}
          {stay.contact_phone ? (
            <>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{stay.contact_phone}</dd>
            </>
          ) : null}
          {stay.contact_email ? (
            <>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{stay.contact_email}</dd>
            </>
          ) : null}
          {stay.guide_number ? (
            <>
              <dt className="text-muted-foreground">Guide</dt>
              <dd>{stay.guide_number}</dd>
            </>
          ) : null}
          {stay.payment_mode ? (
            <>
              <dt className="text-muted-foreground">Pay</dt>
              <dd className="capitalize">
                {stay.payment_mode.replace(/_/g, " ")}
              </dd>
            </>
          ) : null}
          {stay.group_name ? (
            <>
              <dt className="text-muted-foreground">Group</dt>
              <dd>{stay.group_name}</dd>
            </>
          ) : null}
          {stay.notes ? (
            <>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="line-clamp-3">{stay.notes}</dd>
            </>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-2 border-t pt-2">
          <Link
            href={`/erp/check-in?id=${stay.booking_id}`}
            className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs text-primary-foreground"
          >
            Check-in
          </Link>
          {stay.folio_id ? (
            <Link
              href={`/erp/folios/${stay.folio_id}`}
              className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs"
            >
              Folio
            </Link>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function RoomRackGrid({
  units,
  stays,
  start,
  days,
  today,
  windowDays,
  agents,
  unassigned,
  blocks,
}: {
  units: RackUnit[];
  stays: RackStay[];
  start: string;
  days: string[];
  today: string;
  windowDays: number;
  agents: CalendarAgent[];
  unassigned: UnassignedBooking[];
  blocks: RoomBlock[];
}) {
  const router = useRouter();
  const endExclusive = addDays(start, days.length);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<DragSel | null>(null);
  const draftRef = useRef<DragSel | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [selectedPool, setSelectedPool] = useState<UnassignedBooking | null>(
    null,
  );
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assigning, startAssigning] = useTransition();
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const [flashStayId, setFlashStayId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<DayFilter | null>(null);
  const [movingStayId, setMovingStayId] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [undoMoveId, setUndoMoveId] = useState<string | null>(null);
  const [movingPending, startMoving] = useTransition();
  const [blockUnit, setBlockUnit] = useState<RackUnit | null>(null);

  const staysByUnit = useMemo(() => {
    const map = new Map<string, RackStay[]>();
    for (const s of stays) {
      const list = map.get(s.room_unit_id) ?? [];
      list.push(s);
      map.set(s.room_unit_id, list);
    }
    return map;
  }, [stays]);

  const blocksByUnit = useMemo(() => {
    const map = new Map<string, RoomBlock[]>();
    for (const block of blocks) {
      const list = map.get(block.room_unit_id) ?? [];
      list.push(block);
      map.set(block.room_unit_id, list);
    }
    return map;
  }, [blocks]);

  const bookedPerDay = useMemo(() => {
    return days.map((day) => {
      let n = 0;
      for (const s of stays) {
        if (s.from_date <= day && day < s.to_date) n += 1;
      }
      return n;
    });
  }, [days, stays]);

  const monthStats = useMemo(() => {
    const stats = new Map<
      string,
      { key: string; label: string; days: number; booked: number; total: number }
    >();
    days.forEach((day, index) => {
      const key = day.slice(0, 7);
      const current = stats.get(key) ?? {
        key,
        label: new Date(`${day}T12:00:00Z`).toLocaleDateString("en-BT", {
          month: "short",
          year: "2-digit",
          timeZone: "Asia/Thimphu",
        }),
        days: 0,
        booked: 0,
        total: 0,
      };
      current.days += 1;
      current.booked += bookedPerDay[index] ?? 0;
      current.total += units.length;
      stats.set(key, current);
    });
    return [...stats.values()].map((stat) => ({
      ...stat,
      empty: Math.max(0, stat.total - stat.booked),
      percent:
        stat.total > 0 ? Math.round((stat.booked / stat.total) * 100) : 0,
    }));
  }, [bookedPerDay, days, units.length]);

  const todayIndex = days.indexOf(today);
  const todayBooked = todayIndex >= 0 ? (bookedPerDay[todayIndex] ?? 0) : 0;

  const selectedStay =
    stays.find((stay) => stay.id === selectedStayId) ?? null;
  const movingStay =
    stays.find((stay) => stay.id === movingStayId) ?? null;

  const searchMatches = useMemo(() => {
    if (!deferredSearch) return [];
    return stays.filter((stay) =>
      [
        stay.contact_name,
        stay.contact_phone,
        stay.guide_number,
        stay.booking_id,
        stay.room_label,
        stay.agent_name,
        stay.group_name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(deferredSearch)),
    );
  }, [deferredSearch, stays]);

  const dayGroups = useMemo(() => {
    const unique = (matches: RackStay[]) => {
      const byBooking = new Map<string, RackStay>();
      for (const stay of matches) {
        if (!byBooking.has(stay.booking_id)) {
          byBooking.set(stay.booking_id, stay);
        }
      }
      return [...byBooking.values()];
    };
    return {
      arrivals: unique(stays.filter((stay) => stay.check_in === today)),
      in_house: unique(
        stays.filter(
          (stay) =>
            stay.check_in <= today &&
            today < stay.check_out &&
            ["confirmed", "checked_in"].includes(stay.status),
        ),
      ),
      departures: unique(stays.filter((stay) => stay.check_out === today)),
    };
  }, [stays, today]);

  const matchesDayFilter = useCallback(
    (stay: RackStay) => {
      if (!dayFilter) return true;
      return dayGroups[dayFilter].some(
        (item) => item.booking_id === stay.booking_id,
      );
    },
    [dayFilter, dayGroups],
  );

  const focusStay = useCallback((stay: RackStay) => {
    const element = document.querySelector<HTMLElement>(
      `[data-stay-id="${stay.id}"]`,
    );
    element?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
    setFlashStayId(stay.id);
    setSelectedStayId(stay.id);
    window.setTimeout(
      () => setFlashStayId((current) => (current === stay.id ? null : current)),
      1400,
    );
  }, []);

  const moveStayToUnit = useCallback(
    (stay: RackStay, unit: RackUnit) => {
      if (movingPending || stay.room_unit_id === unit.id) return;
      if (stay.is_locked) {
        setOperationMessage("Unlock this assignment before moving it.");
        return;
      }
      if (
        (blocksByUnit.get(unit.id) ?? []).some(
          (block) =>
            block.from_date < stay.to_date && block.to_date > stay.from_date,
        )
      ) {
        setOperationMessage("Destination room is blocked during this stay.");
        return;
      }
      startMoving(async () => {
        if (stay.room_type_id !== unit.room_type_id) {
          const preview = await previewCalendarCrossTypeMove(stay.id, unit.id);
          if (!preview.ok) {
            setOperationMessage(preview.error ?? "Could not preview rates.");
            setMovingStayId(null);
            return;
          }
          const delta =
            preview.deltaBtn == null
              ? "rate unavailable"
              : `Δ Nu ${preview.deltaBtn}`;
          const continueMove = window.confirm(
            `Move from ${preview.fromTypeName} to ${preview.toTypeName}?\n${delta} over ${preview.nights} night(s).\n\nOK = continue at new category rate\nCancel = abort\n\nUse Override only when manager approves a different amount.`,
          );
          if (!continueMove) {
            setMovingStayId(null);
            return;
          }
          let decision: "continue" | "override" = "continue";
          let overrideAmount: number | undefined;
          let overrideReason: string | undefined;
          const wantsOverride = window.confirm(
            "Override the calculated rate instead of continuing at the new category rate?",
          );
          if (wantsOverride) {
            const amountRaw = window.prompt(
              "Override total Nu amount for the stay",
              String(preview.toRateBtn ?? ""),
            );
            const reason = window.prompt("Override reason (required)");
            const amount = Number(amountRaw);
            if (!reason || !Number.isFinite(amount) || amount < 0) {
              setOperationMessage("Override cancelled — amount and reason required.");
              setMovingStayId(null);
              return;
            }
            decision = "override";
            overrideAmount = amount;
            overrideReason = reason;
          }
          const result = await moveCalendarAssignmentCrossType(
            stay.id,
            unit.id,
            decision,
            overrideAmount,
            overrideReason,
          );
          setOperationMessage(result.message ?? result.error ?? null);
          setMovingStayId(null);
          if (result.ok && result.moveId) {
            setUndoMoveId(result.moveId);
            window.setTimeout(
              () =>
                setUndoMoveId((current) =>
                  current === result.moveId ? null : current,
                ),
              60_000,
            );
            router.refresh();
          }
          return;
        }

        const result = await moveCalendarAssignment(stay.id, unit.id);
        setOperationMessage(result.message ?? result.error ?? null);
        setMovingStayId(null);
        if (result.ok && result.moveId) {
          setUndoMoveId(result.moveId);
          window.setTimeout(
            () =>
              setUndoMoveId((current) =>
                current === result.moveId ? null : current,
              ),
            60_000,
          );
          router.refresh();
        }
      });
    },
    [blocksByUnit, movingPending, router],
  );

  const toggleStayLock = useCallback(
    (stay: RackStay) => {
      if (movingPending) return;
      startMoving(async () => {
        const result = await setCalendarAssignmentLock(
          stay.id,
          !stay.is_locked,
          stay.is_locked ? undefined : "Protected from automatic reassignment",
        );
        setOperationMessage(result.message ?? result.error ?? null);
        if (result.ok) router.refresh();
      });
    },
    [movingPending, router],
  );

  const undoLastMove = useCallback(() => {
    if (!undoMoveId || movingPending) return;
    startMoving(async () => {
      const result = await undoCalendarAssignmentMove(undoMoveId);
      setOperationMessage(result.message ?? result.error ?? null);
      if (result.ok) {
        setUndoMoveId(null);
        router.refresh();
      }
    });
  }, [movingPending, router, undoMoveId]);

  const releaseRoomBlock = useCallback(
    (block: RoomBlock) => {
      if (
        movingPending ||
        !window.confirm(
          `Release ${block.block_kind.toUpperCase()} block (${block.from_date} → ${block.to_date})?`,
        )
      ) {
        return;
      }
      startMoving(async () => {
        const result = await releaseCalendarRoomBlock(block.id);
        setOperationMessage(result.message ?? result.error ?? null);
        if (result.ok) router.refresh();
      });
    },
    [movingPending, router],
  );

  const gridWidth = LEFT + days.length * CELL;
  const norm = draft ? normalizeSel(draft) : null;

  const assignPoolBooking = useCallback(
    (unit: RackUnit) => {
      if (!selectedPool || assigning) return;
      if (unit.room_type_id !== selectedPool.room_type_id) {
        setAssignMessage(
          `Choose a ${selectedPool.room_type_name} room for this booking.`,
        );
        return;
      }
      const busy = (staysByUnit.get(unit.id) ?? []).some(
        (stay) =>
          stay.from_date < selectedPool.check_out &&
          stay.to_date > selectedPool.check_in,
      );
      if (busy) {
        setAssignMessage(
          `${unit.label} is occupied during ${selectedPool.check_in} → ${selectedPool.check_out}.`,
        );
        return;
      }
      const blocked = (blocksByUnit.get(unit.id) ?? []).some(
        (block) =>
          block.from_date < selectedPool.check_out &&
          block.to_date > selectedPool.check_in,
      );
      if (blocked) {
        setAssignMessage(`${unit.label} is blocked during this stay.`);
        return;
      }

      setAssignMessage(`Assigning ${unit.label}…`);
      startAssigning(async () => {
        const result = await assignCalendarBookingRoom(
          selectedPool.booking_id,
          unit.id,
        );
        setAssignMessage(result.message ?? result.error ?? null);
        if (result.ok) {
          setSelectedPool(null);
          router.refresh();
        }
      });
    },
    [assigning, blocksByUnit, router, selectedPool, staysByUnit],
  );

  const openFromSelection = useCallback(
    (sel: DragSel) => {
      const n = normalizeSel(sel);
      const err = selectionConflicts(
        n,
        units,
        staysByUnit,
        blocksByUnit,
        days,
      );
      if (err) {
        setConflict(err);
        setDraft(null);
        return;
      }
      const checkIn = days[n.dayStart];
      const checkOut = addDays(days[n.dayEnd], 1);
      const selectedUnits: CalendarSelectedUnit[] = [];
      for (let ui = n.unitStart; ui <= n.unitEnd; ui++) {
        const u = units[ui];
        if (!u) continue;
        selectedUnits.push({
          id: u.id,
          label: u.label,
          room_type_name: u.room_type_name,
          room_type_code: u.room_type_code,
        });
      }
      if (!selectedUnits.length || !checkIn) return;
      setSelection({ checkIn, checkOut, units: selectedUnits });
      setDialogOpen(true);
      setDraft(null);
      setConflict(null);
    },
    [units, staysByUnit, blocksByUnit, days],
  );

  const onCellPointerDown = (
    e: ReactPointerEvent,
    unitIdx: number,
    dayIdx: number,
  ) => {
    if (e.button !== 0) return;
    if (selectedPool) return;
    // No pointer capture here: capturing would send every later pointer event
    // back to this cell, so the rectangle could never grow past one cell.
    e.preventDefault();
    const start = {
      unitStart: unitIdx,
      unitEnd: unitIdx,
      dayStart: dayIdx,
      dayEnd: dayIdx,
    };
    draftRef.current = start;
    setDragging(true);
    setConflict(null);
    setDraft(start);
  };

  useEffect(() => {
    if (!dragging) return;

    const clamp = (value: number, max: number) =>
      Math.max(0, Math.min(max, value));

    const cellFromPoint = (x: number, y: number) => {
      const target = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-rack-cell]");
      if (target) {
        const unitIdx = Number(target.dataset.unitIdx);
        const dayIdx = Number(target.dataset.dayIdx);
        if (Number.isInteger(unitIdx) && Number.isInteger(dayIdx)) {
          return { unitIdx, dayIdx };
        }
      }

      // Stay bars and blocks paint above the cells, so fall back to grid
      // geometry to keep the rectangle growing across occupied rows.
      const scroller = scrollRef.current;
      if (!scroller) return null;
      const rect = scroller.getBoundingClientRect();
      const contentX = x - rect.left + scroller.scrollLeft - LEFT;
      const contentY = y - rect.top + scroller.scrollTop - HEADER_H;
      if (contentX < 0 || contentY < 0) return null;
      return {
        unitIdx: clamp(Math.floor(contentY / ROW_H), units.length - 1),
        dayIdx: clamp(Math.floor(contentX / CELL), days.length - 1),
      };
    };

    const onMove = (event: PointerEvent) => {
      const current = draftRef.current;
      if (!current) return;
      event.preventDefault();
      const cell = cellFromPoint(event.clientX, event.clientY);
      if (!cell) return;
      if (
        cell.unitIdx === current.unitEnd &&
        cell.dayIdx === current.dayEnd
      ) {
        return;
      }
      const next = {
        ...current,
        unitEnd: cell.unitIdx,
        dayEnd: cell.dayIdx,
      };
      draftRef.current = next;
      setDraft(next);
    };

    const onUp = () => {
      const current = draftRef.current;
      draftRef.current = null;
      setDragging(false);
      if (current) openFromSelection(current);
    };

    const onCancel = () => {
      draftRef.current = null;
      setDragging(false);
      setDraft(null);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [dragging, days.length, openFromSelection, units.length]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        draftRef.current = null;
        setDraft(null);
        setDragging(false);
        setConflict(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cellSelected = (unitIdx: number, dayIdx: number) => {
    if (!norm) return false;
    return (
      unitIdx >= norm.unitStart &&
      unitIdx <= norm.unitEnd &&
      dayIdx >= norm.dayStart &&
      dayIdx <= norm.dayEnd
    );
  };

  return (
    <div className="erp flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
      <div
        className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-2"
        style={{ minHeight: TOOLBAR_H }}
      >
        {[30, 60, 90].map((n) => (
          <Link
            key={n}
            href={`/erp/calendar?days=${n}&start=${start}`}
            className={cn(
              "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium",
              windowDays === n
                ? "border-accent bg-accent/10 text-accent"
                : "bg-card text-muted-foreground hover:bg-muted/50",
            )}
          >
            {n}d
          </Link>
        ))}
        <div className="ml-1 flex max-w-[min(62vw,760px)] items-stretch gap-1 overflow-x-auto py-1">
          {monthStats.map((stat) => {
            const tone = occupancyTone(stat.percent);
            return (
              <div
                key={stat.key}
                title={`${stat.label}: ${stat.booked} booked and ${stat.empty} empty room-nights across ${stat.days} visible days`}
                className={cn(
                  "group relative min-w-[112px] shrink-0 overflow-hidden rounded-md border px-2 py-1 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
                  tone.card,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {stat.label}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums transition-transform duration-300 group-hover:scale-110",
                      tone.value,
                    )}
                  >
                    {stat.percent}%
                  </span>
                </div>
                <div className="mt-0.5 flex gap-2 text-[9px] tabular-nums text-muted-foreground">
                  <span>B {stat.booked}</span>
                  <span>E {stat.empty}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/5">
                  <div
                    className={cn(
                      "h-full transition-[width] duration-1000 ease-out",
                      tone.bar,
                    )}
                    style={{ width: `${stat.percent}%` }}
                  />
                </div>
              </div>
            );
          })}
          {todayIndex >= 0 ? (
            <div className="relative min-w-[100px] shrink-0 overflow-hidden rounded-md border border-violet-300 bg-violet-50/80 px-2 py-1 shadow-xs dark:border-violet-800 dark:bg-violet-950/25">
              <span className="absolute top-1 right-1 size-1.5 animate-pulse rounded-full bg-violet-500" />
              <p className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                Today rooms
              </p>
              <p className="text-[10px] tabular-nums text-violet-700 dark:text-violet-300">
                <strong>{todayBooked}</strong> booked ·{" "}
                <strong>{Math.max(0, units.length - todayBooked)}</strong> empty
              </p>
            </div>
          ) : null}
        </div>
        <Link
          href={`/erp/calendar?days=${windowDays}&start=${today}`}
          className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] text-muted-foreground hover:bg-muted/50"
        >
          Today
        </Link>
        <Link
          href={`/erp/calendar?days=${windowDays}&start=${addDays(start, -windowDays)}`}
          className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] text-muted-foreground hover:bg-muted/50"
        >
          ←
        </Link>
        <Link
          href={`/erp/calendar?days=${windowDays}&start=${addDays(start, windowDays)}`}
          className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] text-muted-foreground hover:bg-muted/50"
        >
          →
        </Link>
        <div className="relative ml-1 flex items-center gap-1 rounded-md border border-accent/30 bg-accent/5 pl-2">
          <span className="text-[9px] font-semibold tracking-wide text-accent uppercase">
            Search
          </span>
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchMatches[0]) {
                event.preventDefault();
                focusStay(searchMatches[0]);
              }
            }}
            placeholder="Guest, phone, guide #…"
            aria-label="Search calendar stays"
            className="h-7 w-52 border-0 bg-transparent py-1 pr-8 text-xs shadow-none focus-visible:ring-1"
          />
          {deferredSearch ? (
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] text-muted-foreground">
              {searchMatches.length}
            </span>
          ) : null}
        </div>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          {start} → {addDays(start, days.length - 1)} · {units.length} rooms
          {conflict ? (
            <span className="ml-2 text-destructive">{conflict}</span>
          ) : null}
          {draft && !conflict ? (
            <span className="ml-2 text-accent">Drag to select nights…</span>
          ) : null}
        </span>
        <Link
          href={`/erp/calendar/day-sheet?date=${today}`}
          className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] text-muted-foreground hover:bg-muted/50"
        >
          Day sheet
        </Link>
        <span
          className="inline-flex h-7 items-center rounded-md border border-violet-300 bg-violet-50/70 px-2 text-[10px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/25 dark:text-violet-300"
          title="Click any room number in the frozen left column to create an OOO, OOS, or hold block."
        >
          Blocks {blocks.length} · click room
        </span>
        <CalendarLiveRefresh />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-b bg-muted/20 px-2 py-1">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </span>
        {(
          [
            ["arrivals", "Arrivals"],
            ["in_house", "In house"],
            ["departures", "Departures"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={dayFilter === key}
            onClick={() => {
              const next = dayFilter === key ? null : key;
              setDayFilter(next);
              if (next && dayGroups[next][0]) focusStay(dayGroups[next][0]);
            }}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
              dayFilter === key
                ? "border-accent bg-accent/10 text-accent"
                : "bg-card text-muted-foreground hover:bg-muted/50",
            )}
          >
            {label}
            <span className="rounded-full bg-muted px-1.5 text-[9px] tabular-nums text-foreground">
              {dayGroups[key].length}
            </span>
          </button>
        ))}
        {undoMoveId ? (
          <button
            type="button"
            onClick={undoLastMove}
            disabled={movingPending}
            className="inline-flex h-7 items-center rounded-md border border-amber-400 bg-amber-50 px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950/30 dark:text-amber-200"
          >
            Undo room move
          </button>
        ) : null}
        {operationMessage ? (
          <span
            aria-live="polite"
            className="max-w-72 truncate text-[10px] text-muted-foreground"
          >
            {operationMessage}
          </span>
        ) : null}
        {searchMatches.length > 1 ? (
          <div className="ml-auto flex min-w-0 gap-1 overflow-x-auto">
            {searchMatches.slice(0, 6).map((stay) => (
              <button
                key={stay.id}
                type="button"
                onClick={() => focusStay(stay)}
                className="shrink-0 rounded-md border bg-card px-2 py-1 text-[10px] hover:border-accent"
              >
                {stay.contact_name ?? "Guest"} · {stay.room_label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {unassigned.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 border-b bg-amber-50/70 px-2 py-1.5 dark:bg-amber-950/20">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Unassigned {unassigned.reduce((n, item) => n + item.missing_rooms, 0)}
          </span>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {unassigned.map((item) => {
              const selected = selectedPool?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedPool(selected ? null : item);
                    setAssignMessage(
                      selected
                        ? null
                        : `Now click a free ${item.room_type_name} room.`,
                    );
                  }}
                  className={cn(
                    "shrink-0 rounded-md border bg-card px-2 py-1 text-left text-[11px] shadow-xs",
                    selected
                      ? "border-amber-600 ring-2 ring-amber-500/30"
                      : "hover:border-amber-400",
                  )}
                >
                  <span className="font-medium text-foreground">
                    {item.contact_name}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    {item.room_type_code || item.room_type_name} · {item.check_in}
                    →{item.check_out}
                    {item.missing_rooms > 1 ? ` · ${item.missing_rooms} rooms` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {assignMessage ? (
            <span
              aria-live="polite"
              className="max-w-64 shrink-0 truncate text-[11px] text-muted-foreground"
            >
              {assignMessage}
            </span>
          ) : null}
        </div>
      ) : null}

      {units.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          No sellable rooms yet. Add room numbers under{" "}
          <Link
            href="/erp/settings"
            className="text-accent underline-offset-4 hover:underline"
          >
            Settings → Rooms
          </Link>
          .
        </p>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-card">
          <div style={{ width: gridWidth, minWidth: "100%" }}>
            <div
              className="sticky top-0 z-30 flex border-b bg-card"
              style={{ height: HEADER_H }}
            >
              <div
                className="sticky left-0 z-40 flex shrink-0 items-end border-r bg-card px-3 pb-2"
                style={{ width: LEFT }}
              >
                <div
                  className="grid w-full gap-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                  style={{ gridTemplateColumns: LEFT_GRID_COLUMNS }}
                >
                  <span>Floor</span>
                  <span>#</span>
                  <span>Category</span>
                  <span>Room</span>
                </div>
              </div>
              <div className="flex">
                {days.map((day) => {
                  const h = fmtHeader(day);
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex shrink-0 flex-col items-center justify-end border-r px-0.5 pb-1 text-center",
                        isWeekend(day) && "bg-muted/40",
                        day === today && "bg-accent/10",
                      )}
                      style={{ width: CELL }}
                    >
                      <span className="text-[9px] text-muted-foreground">
                        {h.dow}
                      </span>
                      <span className="text-sm font-semibold tabular-nums leading-none">
                        {h.day}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {h.mon}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {units.map((unit, unitIdx) => {
              const rowStays = staysByUnit.get(unit.id) ?? [];
              const rowBlocks = blocksByUnit.get(unit.id) ?? [];
              return (
                <div
                  key={unit.id}
                  className={cn(
                    "relative flex border-b",
                    movingStay &&
                      movingStay.room_unit_id !== unit.id &&
                      "bg-sky-50/70 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/20",
                  )}
                  style={{ height: ROW_H }}
                  onDragOver={(event) => {
                    if (movingStay && movingStay.room_unit_id !== unit.id) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (movingStay) moveStayToUnit(movingStay, unit);
                  }}
                >
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-3 text-xs"
                    style={{ width: LEFT }}
                  >
                    <div
                      className="grid w-full items-center gap-2"
                      style={{ gridTemplateColumns: LEFT_GRID_COLUMNS }}
                    >
                      <span
                        className="truncate text-muted-foreground"
                        title={unit.floor_label ?? "No floor"}
                      >
                        {unit.floor_label ?? "—"}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {unitIdx + 1}
                      </span>
                      <span
                        className="flex min-w-0 items-center gap-1.5"
                        title={`${unit.room_type_name}${unit.room_type_code ? ` (${unit.room_type_code})` : ""}`}
                      >
                        {unit.room_type_code ? (
                          <span className="shrink-0 rounded border bg-muted px-1 py-0.5 font-mono text-[9px] font-semibold text-foreground">
                            {unit.room_type_code}
                          </span>
                        ) : null}
                        <span className="truncate font-medium text-foreground">
                          {unit.room_type_name}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-1.5 truncate text-left font-semibold text-foreground hover:text-accent"
                        title={`${unit.label} · HK ${unit.hk_status ?? "unknown"} · click to block`}
                        onClick={() => setBlockUnit(unit)}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            hkStatusClass(unit.hk_status),
                          )}
                        />
                        <span className="truncate">{unit.label}</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className="relative flex select-none"
                    style={{ width: days.length * CELL }}
                  >
                    {days.map((day, dayIdx) => {
                      const selected = cellSelected(unitIdx, dayIdx);
                      return (
                        <div
                          key={day}
                          role="gridcell"
                          tabIndex={0}
                          aria-label={`Book ${unit.label} on ${day}`}
                          aria-disabled={
                            selectedPool
                              ? unit.room_type_id !== selectedPool.room_type_id
                              : undefined
                          }
                          data-rack-cell="1"
                          data-unit-idx={unitIdx}
                          data-day-idx={dayIdx}
                          onPointerDown={(e) =>
                            onCellPointerDown(e, unitIdx, dayIdx)
                          }
                          onClick={() => assignPoolBooking(unit)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (selectedPool) {
                                assignPoolBooking(unit);
                              } else {
                                openFromSelection({
                                  unitStart: unitIdx,
                                  unitEnd: unitIdx,
                                  dayStart: dayIdx,
                                  dayEnd: dayIdx,
                                });
                              }
                            }
                          }}
                          className={cn(
                            "absolute top-0 h-full cursor-cell border-r",
                            isWeekend(day) && "bg-muted/30",
                            day === today && "bg-accent/5",
                            selected && "bg-sky-500/35 ring-1 ring-inset ring-sky-600",
                            selectedPool &&
                              unit.room_type_id === selectedPool.room_type_id &&
                              "bg-amber-200/45 hover:bg-amber-300/60",
                            selectedPool &&
                              unit.room_type_id !== selectedPool.room_type_id &&
                              "cursor-not-allowed opacity-45",
                            "hover:bg-accent/15",
                          )}
                          style={{
                            left: dayIdx * CELL,
                            width: CELL,
                          }}
                        />
                      );
                    })}

                    {rowBlocks.map((block) => {
                      const from =
                        block.from_date < start ? start : block.from_date;
                      const to =
                        block.to_date > endExclusive
                          ? endExclusive
                          : block.to_date;
                      if (to <= start || from >= endExclusive || to <= from) {
                        return null;
                      }
                      const left = dayIndex(start, from) * CELL;
                      const width = Math.max(
                        CELL,
                        dayIndex(from, to) * CELL,
                      );
                      return (
                        <button
                          key={block.id}
                          type="button"
                          className={cn(
                            "absolute top-1 z-10 flex h-[calc(100%-8px)] items-center overflow-hidden rounded-md border px-1.5 text-left text-[10px] font-semibold shadow-sm",
                            blockBarClass(block.block_kind),
                          )}
                          style={{ left: left + 2, width: width - 4 }}
                          title={`${block.block_kind.toUpperCase()}: ${block.reason}. Click to release.`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => releaseRoomBlock(block)}
                        >
                          <span className="truncate">
                            {block.block_kind.toUpperCase()} · {block.reason}
                          </span>
                        </button>
                      );
                    })}

                    {rowStays.map((stay) => {
                      const from =
                        stay.from_date < start ? start : stay.from_date;
                      const to =
                        stay.to_date > endExclusive
                          ? endExclusive
                          : stay.to_date;
                      if (to <= start || from >= endExclusive || to <= from)
                        return null;
                      const left = dayIndex(start, from) * CELL;
                      const width = Math.max(
                        CELL,
                        dayIndex(from, to) * CELL,
                      );
                      return (
                        <div
                          key={stay.id}
                          data-stay-id={stay.id}
                          className={cn(
                            "absolute top-0 z-10 h-full rounded-md transition-[opacity,box-shadow] duration-200",
                            dayFilter &&
                              !matchesDayFilter(stay) &&
                              "opacity-20",
                            flashStayId === stay.id &&
                              "z-20 ring-2 ring-accent ring-offset-2",
                          )}
                          style={{ left: left + 2, width: width - 4 }}
                          onPointerDown={(e) => e.stopPropagation()}
                          draggable={!stay.is_locked}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", stay.id);
                            setMovingStayId(stay.id);
                            setOperationMessage(
                              `Move ${stay.contact_name ?? "guest"} to another ${stay.room_type_name} room.`,
                            );
                          }}
                          onDragEnd={() => setMovingStayId(null)}
                        >
                          <StayHoverCard
                            stay={stay}
                            suppressed={
                              dragging || selectedStayId === stay.id
                            }
                            onOpenDetail={() => setSelectedStayId(stay.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div
              className="sticky bottom-0 z-30 flex border-t bg-card"
              style={{ height: FOOTER_H }}
            >
              <div
                className="sticky left-0 z-40 flex shrink-0 items-center border-r bg-card px-3 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                style={{ width: LEFT }}
              >
                Booked / empty
              </div>
              <div className="flex">
                {days.map((day, i) => {
                  const booked = bookedPerDay[i];
                  const empty = Math.max(0, units.length - booked);
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex shrink-0 flex-col items-center justify-center border-r text-[10px] tabular-nums",
                        isWeekend(day) && "bg-muted/40",
                      )}
                      style={{ width: CELL }}
                    >
                      <span className="font-medium text-foreground">
                        {booked}
                      </span>
                      <span className="text-muted-foreground">{empty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <CalendarReservationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selection={selection}
        agents={agents}
      />
      <CalendarReservationEditDialog
        stay={selectedStay}
        open={selectedStay != null}
        parentPending={movingPending}
        units={units}
        agents={agents}
        onToggleLock={toggleStayLock}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedStayId(null);
        }}
      />
      <CalendarRoomBlockDialog
        unit={blockUnit}
        open={blockUnit != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setBlockUnit(null);
        }}
        start={today}
      />
    </div>
  );
}
