"use client";

import {
  assignCalendarBookingRoom,
  moveCalendarAssignment,
  moveCalendarAssignmentCrossType,
  previewCalendarCrossTypeMove,
  releaseCalendarRoomBlock,
  resizeCalendarAssignment,
  setCalendarAssignmentLock,
  undoCalendarAssignmentMove,
} from "@/app/actions/erp-calendar";
import { CalendarLiveRefresh } from "@/components/erp/CalendarLiveRefresh";
import { CalendarRoomBlockDialog } from "@/components/erp/CalendarRoomBlockDialog";
import { RoomDayBoard } from "@/components/erp/RoomDayBoard";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { CalendarRoomUnitEditDialog } from "@/components/erp/CalendarRoomUnitEditDialog";
import {
  CalendarReservationDialog,
  type CalendarAgent,
  type CalendarMealPlan,
  type CalendarSelection,
  type CalendarSelectedUnit,
} from "@/components/erp/CalendarReservationDialog";
import type { BookableStaff } from "@/components/erp/StaffPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BanIcon, MoreHorizontalIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/use-media-query";
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
  view_label: string | null;
  has_balcony: boolean;
  sort_order: number;
  room_type_id: string;
  room_type_code: string;
  room_type_name: string;
  hk_status?: string | null;
  service_requested_at?: string | null;
  connecting_room_unit_id?: string | null;
  connecting_room_label?: string | null;
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
  /** Staff sales claim */
  sold_by_staff_id?: string | null;
  sold_by_name?: string | null;
  sales_claim_status?: string | null;
  group_name: string | null;
  folio_id: string | null;
  /** Net open folio balance (BTN); >0 means guest owes. */
  folio_balance?: number;
  /** True when non-payment charge lines exist (room/meal/POS). */
  folio_has_charges?: boolean;
  room_label: string;
  room_type_id: string;
  room_type_name: string;
  /** International / regional SDF or passport incomplete for desk badge. */
  sdf_incomplete?: boolean;
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

export type RackAllotment = {
  id: string;
  room_type_id: string;
  agent_name: string;
  rooms_per_week: number;
  valid_from: string;
  valid_to: string;
};

const CELL_SM = 36;
const CELL_MD = 44;
const CELL_LG = 56;
const LEFT_DESKTOP = 148;
const LEFT_MOBILE = 104;
const CATEGORY_H = 24;
const ROW_H = 44;
const HEADER_H = 48;
const FOOTER_H = 32;
const TOOLBAR_H = 40;

type CellZoom = "sm" | "md" | "lg";

function cellWidthForZoom(z: CellZoom): number {
  if (z === "sm") return CELL_SM;
  if (z === "lg") return CELL_LG;
  return CELL_MD;
}

type RackRow =
  | {
      kind: "category";
      roomTypeId: string;
      code: string;
      name: string;
    }
  | { kind: "unit"; unit: RackUnit; unitIdx: number };

function buildRackRows(units: RackUnit[]): RackRow[] {
  const rows: RackRow[] = [];
  let lastTypeId: string | undefined;
  units.forEach((unit, unitIdx) => {
    if (unit.room_type_id !== lastTypeId) {
      rows.push({
        kind: "category",
        roomTypeId: unit.room_type_id,
        code:
          unit.room_type_code ||
          unit.room_type_name.slice(0, 3).toUpperCase(),
        name: unit.room_type_name,
      });
      lastTypeId = unit.room_type_id;
    }
    rows.push({ kind: "unit", unit, unitIdx });
  });
  return rows;
}

function useLeftPaneWidth(): number {
  const [left, setLeft] = useState(LEFT_DESKTOP);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setLeft(mq.matches ? LEFT_MOBILE : LEFT_DESKTOP);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return left;
}

function unitIdxFromContentY(
  contentY: number,
  rackRows: RackRow[],
  unitCount: number,
): number {
  if (unitCount <= 0) return 0;
  let y = 0;
  let lastUnitIdx = 0;
  for (const row of rackRows) {
    if (row.kind === "category") {
      y += CATEGORY_H;
      continue;
    }
    if (contentY < y + ROW_H) return row.unitIdx;
    lastUnitIdx = row.unitIdx;
    y += ROW_H;
  }
  return Math.max(0, Math.min(unitCount - 1, lastUnitIdx));
}

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

function statusBadgeClass(status: string): string {
  if (status === "checked_in")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "confirmed")
    return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (status === "pending" || status === "held")
    return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  return "border-border bg-muted text-muted-foreground";
}

/** Ops-first stay colors: lifecycle fill + optional dues cue. */
type StayOpsTone = {
  bar: string;
  accent: string;
  dues: boolean;
  lifeLabel: string;
};

function stayOpsTone(stay: RackStay, today: string): StayOpsTone {
  const overdueDeparture =
    stay.status === "checked_in" && stay.check_out <= today;
  const arrivingToday =
    stay.check_in === today &&
    (stay.status === "confirmed" ||
      stay.status === "pending" ||
      stay.status === "held");
  const departingToday =
    stay.status === "checked_in" && stay.check_out === today;
  const dues = Number(stay.folio_balance ?? 0) > 0.5;

  if (overdueDeparture) {
    return {
      bar: "bg-rose-700 text-white ring-1 ring-rose-300/70",
      accent: "bg-rose-950",
      dues,
      lifeLabel: "Overdue out",
    };
  }
  if (arrivingToday) {
    return {
      bar: "bg-sky-500 text-white",
      accent: "bg-sky-700",
      dues,
      lifeLabel: "Arriving",
    };
  }
  if (departingToday) {
    return {
      bar: "bg-amber-500 text-foreground",
      accent: "bg-amber-700",
      dues,
      lifeLabel: "Departing",
    };
  }
  if (stay.status === "checked_in") {
    return {
      bar: "bg-emerald-600 text-white",
      accent: "bg-emerald-800",
      dues,
      lifeLabel: "In-house",
    };
  }
  if (stay.status === "confirmed") {
    return {
      bar: "bg-sky-700 text-white",
      accent: "bg-sky-900",
      dues,
      lifeLabel: "Confirmed",
    };
  }
  if (stay.status === "pending" || stay.status === "held") {
    return {
      bar: "bg-amber-300 text-foreground",
      accent: "bg-amber-600",
      dues,
      lifeLabel: "Held",
    };
  }
  return {
    bar: "bg-muted text-foreground",
    accent: "bg-foreground/25",
    dues,
    lifeLabel: stay.status,
  };
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

function sourceLabel(stay: RackStay): string {
  const source = stay.booked_by_role || stay.source;
  return (
    {
      owner: "Owner",
      reservation: "Reservation",
      agent: "Agent",
      mou_agent: "MOU agent",
      client: "Direct",
      ota: "OTA",
    }[source ?? ""] ?? "Reservation"
  );
}

function groupTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 55%)`;
}

function categoryColor(roomTypeId: string): string {
  let hash = 0;
  for (let i = 0; i < roomTypeId.length; i++) {
    hash = (hash * 31 + roomTypeId.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 65% 42%)`;
}

function categoryTint(roomTypeId: string, dark = false): string {
  let hash = 0;
  for (let i = 0; i < roomTypeId.length; i++) {
    hash = (hash * 31 + roomTypeId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return dark
    ? `hsl(${hue} 28% 17%)`
    : `hsl(${hue} 45% 92%)`;
}

function floorAbbrev(floorLabel: string | null): string | null {
  const trimmed = floorLabel?.trim();
  if (!trimmed) return null;
  const num = trimmed.match(/\d+/);
  if (num) return `F${num[0]}`;
  return trimmed.length <= 4 ? trimmed : trimmed.slice(0, 3);
}

/**
 * Prefer a short door number for the rack. `DELUXE SUITE-01` → `01`,
 * `101` stays `101`. Full inventory label remains in the tooltip.
 */
function displayRoomNumber(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "—";
  const dashed = trimmed.match(/[-–—]\s*([A-Za-z]?\d+)\s*$/);
  if (dashed?.[1]) return dashed[1];
  const trailing = trimmed.match(/(\d+)\s*$/);
  if (trailing?.[1] && trimmed.length > trailing[1].length) {
    return trailing[1];
  }
  return trimmed;
}

function roomAttrLine(unit: RackUnit): string | null {
  const parts: string[] = [];
  const floor = floorAbbrev(unit.floor_label);
  if (floor) parts.push(floor);
  const view = unit.view_label?.trim();
  if (view) parts.push(view);
  if (unit.has_balcony) parts.push("Balc");
  if (unit.connecting_room_label) {
    parts.push(`↔ ${unit.connecting_room_label}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function roomTooltip(unit: RackUnit): string {
  const parts = [unit.label, unit.room_type_name];
  if (unit.floor_label?.trim()) parts.push(unit.floor_label.trim());
  if (unit.view_label?.trim()) parts.push(unit.view_label.trim());
  if (unit.has_balcony) parts.push("Balcony");
  if (unit.connecting_room_label) {
    parts.push(`Connects ${unit.connecting_room_label}`);
  }
  return parts.join(" · ");
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
  today,
  suppressed,
  onOpenDetail,
}: {
  stay: RackStay;
  today: string;
  suppressed: boolean;
  onOpenDetail: () => void;
}) {
  const nights = nightsBetween(stay.check_in, stay.check_out);
  const overdueDeparture =
    stay.status === "checked_in" && stay.check_out <= today;
  const checkedIn = stay.status === "checked_in";
  const tone = stayOpsTone(stay, today);
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
            "relative flex h-[calc(100%-4px)] w-full flex-col justify-center gap-0.5 overflow-hidden rounded-sm py-0.5 pl-2 pr-1.5 text-left",
            tone.bar,
            tone.dues && "ring-2 ring-inset ring-violet-300/90",
          )}
          title={
            [
              tone.lifeLabel,
              overdueDeparture ? "Departure due — still checked in" : null,
              tone.dues ? "Open folio balance / dues" : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          onClick={onOpenDetail}
        >
          <span
            aria-hidden
            className={cn("absolute inset-y-0 left-0 w-[3px]", tone.accent)}
          />
          {tone.dues ? (
            <span
              aria-hidden
              className="absolute inset-y-0 right-0 w-1 bg-violet-400"
            />
          ) : null}
          {/* Row 1 — guest name (like room number line) */}
          <span className="flex min-w-0 items-center gap-1 leading-none">
            {stay.group_name ? (
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: groupTint(stay.group_name) }}
                title={stay.group_name}
              />
            ) : null}
            <span className="min-w-0 truncate text-[11px] font-semibold tracking-tight md:text-[12px]">
              {stay.contact_name ?? "Guest"}
            </span>
            {stay.is_locked ? (
              <span
                className="ml-auto shrink-0 text-[8px] opacity-80"
                aria-label="Assignment locked"
              >
                ◆
              </span>
            ) : null}
          </span>
          {/* Row 2 — source + flags (like room attr line) */}
          <span className="flex min-w-0 items-center gap-1 text-[9px] leading-none opacity-90">
            <span
              className="shrink-0 font-mono font-semibold opacity-80"
              title={sourceLabel(stay)}
            >
              {sourceAbbreviation(stay)}
            </span>
            {overdueDeparture ? (
              <span className="shrink-0 font-bold" title="Not checked out">
                OUT
              </span>
            ) : tone.lifeLabel === "Arriving" ? (
              <span className="shrink-0 font-bold" title="Arriving today">
                IN
              </span>
            ) : tone.lifeLabel === "Departing" ? (
              <span className="shrink-0 font-bold" title="Departing today">
                DEP
              </span>
            ) : null}
            {stay.guide_number ? (
              <span
                className="shrink-0 opacity-90"
                title={`Guide ${stay.guide_number}`}
              >
                G
              </span>
            ) : null}
            {stay.payment_mode === "on_credit" ? (
              <span className="shrink-0 opacity-90" title="On credit">
                $
              </span>
            ) : null}
            {tone.dues ? (
              <span
                className="shrink-0 rounded-[2px] bg-violet-950/40 px-0.5 text-[8px] font-bold leading-none"
                title={`Dues ${Number(stay.folio_balance ?? 0).toFixed(0)}`}
              >
                DUE
              </span>
            ) : null}
            {stay.sdf_incomplete ? (
              <span
                className="shrink-0 rounded-[2px] bg-destructive/90 px-0.5 text-[8px] font-bold leading-none text-destructive-foreground"
                title="SDF / passport incomplete"
              >
                SDF
              </span>
            ) : null}
            {stay.agent_name ? (
              <span
                className="min-w-0 truncate opacity-75"
                title={stay.agent_name}
              >
                {stay.agent_name}
              </span>
            ) : null}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="erp z-50 w-72 space-y-2.5 p-3 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {stay.contact_name ?? "Guest"}
            </p>
            <p className="text-xs text-muted-foreground">
              {stay.room_label} · {stay.room_type_name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {sourceLabel(stay)}
              {stay.agent_name ? ` · ${stay.agent_name}` : ""}
              {` · ${tone.lifeLabel}`}
            </p>
            {tone.dues ? (
              <p className="mt-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
                Open balance / dues
              </p>
            ) : null}
            {stay.sdf_incomplete ? (
              <p className="mt-1 text-[11px] font-medium text-destructive">
                SDF / passport incomplete
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize",
              statusBadgeClass(stay.status),
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
        <div className="flex flex-wrap gap-1.5 border-t pt-2">
          {!checkedIn ? (
            <Link
              href={`/erp/check-in?id=${stay.booking_id}`}
              className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs text-primary-foreground"
            >
              Check-in
            </Link>
          ) : null}
          <Link
            href={`/erp/bookings/${stay.booking_id}`}
            className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs"
          >
            Booking
          </Link>
          {stay.folio_id ? (
            <Link
              href={`/erp/folios/${stay.folio_id}`}
              className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs"
            >
              Folio
            </Link>
          ) : null}
          {checkedIn ? (
            <Link
              href={`/erp/check-in?id=${stay.booking_id}`}
              className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs"
            >
              Guest docs
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
  staff = [],
  defaultSoldByStaffId = "",
  unassigned,
  blocks,
  allotments = [],
  propertyId,
  mealPlans,
  defaultMealPlanCode,
}: {
  units: RackUnit[];
  stays: RackStay[];
  start: string;
  days: string[];
  today: string;
  windowDays: number;
  agents: CalendarAgent[];
  staff?: BookableStaff[];
  defaultSoldByStaffId?: string;
  unassigned: UnassignedBooking[];
  blocks: RoomBlock[];
  allotments?: RackAllotment[];
  propertyId: string;
  mealPlans: CalendarMealPlan[];
  defaultMealPlanCode: string;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const stayHub = useStayHubOptional();
  const leftWidth = useLeftPaneWidth();
  const [cellZoom, setCellZoom] = useState<CellZoom>("md");
  const CELL = cellWidthForZoom(cellZoom);
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
  const [contextStayId, setContextStayId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const [flashStayId, setFlashStayId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<DayFilter | null>(null);
  const [movingStayId, setMovingStayId] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [undoMoveId, setUndoMoveId] = useState<string | null>(null);
  const [movingPending, startMoving] = useTransition();
  const [blockUnit, setBlockUnit] = useState<RackUnit | null>(null);
  const [editUnit, setEditUnit] = useState<RackUnit | null>(null);
  const [, startResizing] = useTransition();
  const [dayBoardDate, setDayBoardDate] = useState(today);

  const openStay = useCallback(
    (stay: RackStay) => {
      setSelectedStayId(stay.id);
      if (stayHub) {
        stayHub.openStayHub({
          bookingId: stay.booking_id,
          assignmentId: stay.id,
          seedStay: stay,
          agents,
          staff,
          units,
          onToggleLock: (seed) => {
            // seed may be StayHubSeedStay shape
            const match =
              stays.find((s) => s.id === seed.id) ??
              stays.find((s) => s.booking_id === seed.booking_id);
            if (match) toggleStayLockRef.current?.(match);
          },
        });
        return;
      }
    },
    [stayHub, agents, staff, units, stays],
  );

  const toggleStayLockRef = useRef<((stay: RackStay) => void) | null>(null);

  const beginStayResize = useCallback(
    (edge: "start" | "end", stay: RackStay, event: ReactPointerEvent) => {
      if (stay.is_locked) return;
      event.preventDefault();
      event.stopPropagation();
      const originX = event.clientX;
      const originFrom = stay.from_date;
      const originTo = stay.to_date;
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointerup", onUp);
        const deltaDays = Math.round((ev.clientX - originX) / CELL);
        if (!deltaDays) return;
        let from = originFrom;
        let to = originTo;
        if (edge === "start") {
          from = addDays(originFrom, deltaDays);
          if (from >= to) from = addDays(to, -1);
        } else {
          to = addDays(originTo, deltaDays);
          if (to <= from) to = addDays(from, 1);
        }
        startResizing(async () => {
          const result = await resizeCalendarAssignment(stay.id, from, to);
          setOperationMessage(
            result.ok
              ? (result.message ?? "Stay resized")
              : (result.error ?? "Could not resize stay"),
          );
          if (result.ok) router.refresh();
        });
      };
      window.addEventListener("pointerup", onUp);
    },
    [CELL, router, startResizing],
  );

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

  const focusStay = useCallback(
    (stay: RackStay) => {
      const element = document.querySelector<HTMLElement>(
        `[data-stay-id="${stay.id}"]`,
      );
      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
      setFlashStayId(stay.id);
      openStay(stay);
      window.setTimeout(
        () =>
          setFlashStayId((current) => (current === stay.id ? null : current)),
        1400,
      );
    },
    [openStay],
  );

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
  toggleStayLockRef.current = toggleStayLock;

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

  const rackRows = useMemo(() => buildRackRows(units), [units]);

  /** Windowed row render for large inventories (virtualization without extra deps). */
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewportH(el.clientHeight || 600);
    onResize();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const rowOffsets = useMemo(() => {
    const offsets: number[] = [];
    let y = 0;
    for (const row of rackRows) {
      offsets.push(y);
      y += row.kind === "category" ? CATEGORY_H : ROW_H;
    }
    return { offsets, totalH: y };
  }, [rackRows]);

  const VIRTUALIZE_THRESHOLD = 40;
  const useVirtual = rackRows.length > VIRTUALIZE_THRESHOLD;
  const overscan = 8;
  const visibleRowRange = useMemo(() => {
    if (!useVirtual) {
      return { start: 0, end: rackRows.length, totalH: rowOffsets.totalH };
    }
    const { offsets, totalH } = rowOffsets;
    const contentTop = Math.max(0, scrollTop - HEADER_H);
    let start = 0;
    while (
      start < offsets.length - 1 &&
      offsets[start + 1]! <= contentTop
    ) {
      start += 1;
    }
    start = Math.max(0, start - overscan);
    let end = start;
    const bottom = contentTop + viewportH + ROW_H * overscan;
    while (end < offsets.length && offsets[end]! < bottom) {
      end += 1;
    }
    end = Math.min(rackRows.length, end + overscan);
    return { start, end, totalH };
  }, [useVirtual, rackRows.length, rowOffsets, scrollTop, viewportH]);

  const visibleCategories = useMemo(() => {
    const seen = new Map<string, { code: string; name: string }>();
    for (const unit of units) {
      if (!seen.has(unit.room_type_id)) {
        seen.set(unit.room_type_id, {
          code:
            unit.room_type_code ||
            unit.room_type_name.slice(0, 3).toUpperCase(),
          name: unit.room_type_name,
        });
      }
    }
    return [...seen.entries()].map(([id, info]) => ({ id, ...info }));
  }, [units]);

  const gridWidth = leftWidth + days.length * CELL;
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
      const contentX = x - rect.left + scroller.scrollLeft - leftWidth;
      const contentY = y - rect.top + scroller.scrollTop - HEADER_H;
      if (contentX < 0 || contentY < 0) return null;
      return {
        unitIdx: unitIdxFromContentY(contentY, rackRows, units.length),
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
  }, [CELL, dragging, days.length, leftWidth, openFromSelection, rackRows, units.length]);

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

  const openVacantBook = useCallback(
    (unit: RackUnit, date: string) => {
      setSelection({
        checkIn: date,
        checkOut: addDays(date, 1),
        units: [
          {
            id: unit.id,
            label: unit.label,
            room_type_name: unit.room_type_name,
            room_type_code: unit.room_type_code,
          },
        ],
      });
      setDialogOpen(true);
    },
    [],
  );

  // Phone: Day board (not pinch Gantt). Desktop/tablet keep full rack.
  if (!isMdUp) {
    return (
      <div className="erp flex h-[calc(100dvh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
          <div>
            <p className="text-sm font-medium">Day board</p>
            <p className="text-[11px] text-muted-foreground">
              Tap a room or guest · FAB to book
            </p>
          </div>
          <CalendarLiveRefresh />
        </div>
        <RoomDayBoard
          units={units}
          stays={stays}
          blocks={blocks}
          unassigned={unassigned}
          today={today}
          selectedDate={dayBoardDate}
          onDateChange={setDayBoardDate}
          onOpenStay={openStay}
          onBookVacant={openVacantBook}
          onBookFab={() => {
            setSelection({
              checkIn: dayBoardDate,
              checkOut: addDays(dayBoardDate, 1),
              units: [],
            });
            setDialogOpen(true);
          }}
        />
        <CalendarReservationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          selection={selection}
          agents={agents}
          staff={staff}
          defaultSoldByStaffId={defaultSoldByStaffId}
          mealPlans={mealPlans}
          defaultMealPlanCode={defaultMealPlanCode}
        />
      </div>
    );
  }

  return (
    <div className="erp flex h-[calc(100dvh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden">
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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] font-medium"
            >
              Stay colors
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="erp w-auto max-w-[min(92vw,280px)] space-y-2 p-3"
          >
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Stay colors
            </p>
            <ul className="space-y-1.5 text-xs">
              {[
                { swatch: "bg-sky-500", label: "Arriving today" },
                { swatch: "bg-emerald-600", label: "In-house" },
                { swatch: "bg-amber-500", label: "Departing today" },
                { swatch: "bg-sky-700", label: "Confirmed (future)" },
                { swatch: "bg-amber-300", label: "Held / pending" },
                { swatch: "bg-rose-700", label: "Overdue checkout" },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  <span
                    className={cn("size-3 shrink-0 rounded-sm", row.swatch)}
                  />
                  <span>{row.label}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 border-t pt-1.5">
                <span className="size-3 shrink-0 rounded-sm bg-sky-600 ring-2 ring-inset ring-violet-400" />
                <span>Violet edge / DUE = open folio balance</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="rounded-[2px] bg-destructive px-1 text-[9px] font-bold text-white">
                  SDF
                </span>
                <span>Passport / SDF incomplete</span>
              </li>
            </ul>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] font-medium"
            >
              Categories
              {visibleCategories.length > 0 ? (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {visibleCategories.length}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="erp w-auto max-w-[min(92vw,320px)] space-y-2 p-3"
          >
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Room categories
            </p>
            <ul className="space-y-1">
              {visibleCategories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs"
                >
                  <span
                    className="inline-flex min-w-[2rem] shrink-0 items-center justify-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                    style={{ backgroundColor: categoryColor(cat.id) }}
                  >
                    {cat.code}
                  </span>
                  <span className="truncate text-foreground">{cat.name}</span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] font-medium"
            >
              Occupancy
              {monthStats[0] ? (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {monthStats[0].percent}%
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="erp w-auto max-w-[min(92vw,420px)] space-y-2 p-3"
          >
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Visible months
            </p>
            <div className="flex flex-wrap gap-1.5">
              {monthStats.map((stat) => {
                const tone = occupancyTone(stat.percent);
                return (
                  <div
                    key={stat.key}
                    title={`${stat.label}: ${stat.booked} booked and ${stat.empty} empty room-nights across ${stat.days} visible days`}
                    className={cn(
                      "relative min-w-[112px] overflow-hidden rounded-md border px-2 py-1 shadow-xs",
                      tone.card,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {stat.label}
                      </span>
                      <span className={cn("text-sm font-bold tabular-nums", tone.value)}>
                        {stat.percent}%
                      </span>
                    </div>
                    <div className="mt-0.5 flex gap-2 text-[9px] tabular-nums text-muted-foreground">
                      <span>B {stat.booked}</span>
                      <span>E {stat.empty}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/5">
                      <div
                        className={cn("h-full", tone.bar)}
                        style={{ width: `${stat.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {todayIndex >= 0 ? (
                <div className="relative min-w-[100px] overflow-hidden rounded-md border border-violet-300 bg-violet-50/80 px-2 py-1 shadow-xs dark:border-violet-800 dark:bg-violet-950/25">
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
          </PopoverContent>
        </Popover>
        <label className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-1.5 text-[10px] text-muted-foreground">
          <span className="hidden sm:inline">Go to</span>
          <input
            type="date"
            value={start}
            aria-label="Go to date"
            className="h-6 max-w-[9.5rem] border-0 bg-transparent text-[11px] text-foreground outline-none"
            onChange={(event) => {
              const next = event.target.value;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
              router.push(`/erp/calendar?days=${windowDays}&start=${next}`);
            }}
          />
        </label>
        <Link
          href={`/erp/calendar?days=${windowDays}&start=${today}`}
          className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] text-muted-foreground hover:bg-muted/50"
        >
          Today
        </Link>
        <div
          className="inline-flex h-7 items-center gap-0.5 rounded-md border bg-card p-0.5"
          role="group"
          aria-label="Day column zoom"
        >
          {(
            [
              ["sm", "S"],
              ["md", "M"],
              ["lg", "L"],
            ] as const
          ).map(([z, label]) => (
            <button
              key={z}
              type="button"
              aria-pressed={cellZoom === z}
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[10px] font-semibold",
                cellZoom === z
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
              onClick={() => setCellZoom(z)}
            >
              {label}
            </button>
          ))}
        </div>
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
            className="h-7 w-36 border-0 bg-transparent py-1 pr-8 text-xs shadow-none focus-visible:ring-1 sm:w-52"
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
        <span
          className="inline-flex h-7 items-center rounded-md border border-violet-300 bg-violet-50/70 px-2 text-[10px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/25 dark:text-violet-300"
          title="Click any room number in the frozen left column to create an OOO, OOS, or hold block."
        >
          Blocks {blocks.length}
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
        <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-card">
          <div style={{ width: gridWidth, minWidth: "100%" }}>
            <div
              className="sticky top-0 z-30 flex border-b bg-card"
              style={{ height: HEADER_H }}
            >
              <div
                className="sticky left-0 z-30 flex shrink-0 items-end border-r bg-card px-2 pb-2"
                style={{ width: leftWidth }}
              >
                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Room
                </span>
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

            {useVirtual ? (
              <div
                aria-hidden
                style={{
                  height: rowOffsets.offsets[visibleRowRange.start ?? 0] ?? 0,
                }}
              />
            ) : null}
            {rackRows
              .slice(visibleRowRange.start ?? 0, visibleRowRange.end ?? rackRows.length)
              .map((row, sliceIdx) => {
              const rowIdx = (visibleRowRange.start ?? 0) + sliceIdx;
              if (row.kind === "category") {
                const tint = categoryTint(row.roomTypeId, isDark);
                const accent = categoryColor(row.roomTypeId);
                return (
                  <div
                    key={`cat-${row.roomTypeId}-${rowIdx}`}
                    className="sticky left-0 z-10 flex border-b"
                    style={{
                      height: CATEGORY_H,
                      width: gridWidth,
                      backgroundColor: tint,
                    }}
                  >
                    <div
                      className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r px-2"
                      style={{
                        width: leftWidth,
                        backgroundColor: tint,
                      }}
                    >
                      <span
                        className="inline-flex shrink-0 items-center rounded px-1 py-0.5 font-mono text-[9px] font-bold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {row.code}
                      </span>
                      <span
                        className={cn(
                          "truncate text-[10px] font-semibold",
                          isDark ? "text-foreground/70" : "text-foreground/80",
                        )}
                      >
                        {row.name}
                      </span>
                    </div>
                    <div
                      className="relative"
                      style={{
                        width: days.length * CELL,
                        backgroundColor: tint,
                      }}
                    >
                      {allotments
                        .filter((a) => a.room_type_id === row.roomTypeId)
                        .map((a) => {
                          const from =
                            a.valid_from < start ? start : a.valid_from;
                          const toExclusive = addDays(
                            a.valid_to < endExclusive
                              ? a.valid_to
                              : addDays(endExclusive, -1),
                            1,
                          );
                          const to =
                            toExclusive > endExclusive
                              ? endExclusive
                              : toExclusive;
                          if (to <= start || from >= endExclusive) return null;
                          const left = dayIndex(start, from) * CELL;
                          const width = Math.max(
                            CELL,
                            dayIndex(from, to) * CELL,
                          );
                          return (
                            <div
                              key={a.id}
                              className="pointer-events-none absolute inset-y-0 border border-dashed border-violet-500/50 bg-violet-500/15"
                              style={{ left: left + 1, width: width - 2 }}
                              title={`Allotment · ${a.agent_name} · ${a.rooms_per_week}/wk`}
                            />
                          );
                        })}
                      <span className="sr-only">
                        {allotments.filter((a) => a.room_type_id === row.roomTypeId)
                          .length
                          ? "Agent allotment overlay"
                          : ""}
                      </span>
                    </div>
                  </div>
                );
              }

              const { unit, unitIdx } = row;
              const rowStays = staysByUnit.get(unit.id) ?? [];
              const rowBlocks = blocksByUnit.get(unit.id) ?? [];
              const attrLine = roomAttrLine(unit);
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
                    className="group/room sticky left-0 z-20 flex shrink-0 items-center gap-0.5 border-r bg-card px-1 md:px-1.5"
                    style={{ width: leftWidth, height: ROW_H }}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col justify-center gap-0 py-0 text-left hover:text-accent"
                      title={`${roomTooltip(unit)} · HK ${unit.hk_status ?? "unknown"} · click to block`}
                      onClick={() => setBlockUnit(unit)}
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            hkStatusClass(unit.hk_status),
                          )}
                        />
                        <span className="min-w-0 truncate text-[13px] font-bold leading-none tabular-nums text-foreground md:text-[14px]">
                          {displayRoomNumber(unit.label)}
                        </span>
                        {unit.service_requested_at ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-violet-500 ring-1 ring-violet-300"
                            title="Service requested"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 truncate pl-2.5 text-[9px] leading-tight text-muted-foreground md:pl-3">
                        {unit.room_type_name}
                      </span>
                      {attrLine ? (
                        <span className="min-w-0 truncate pl-2.5 text-[8px] leading-tight text-muted-foreground/80 md:pl-3">
                          {attrLine}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 items-center gap-0 opacity-100 md:opacity-0 md:group-hover/room:opacity-100 md:group-focus-within/room:opacity-100">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="hidden size-6 text-muted-foreground md:inline-flex"
                        title="Block room"
                        aria-label={`Block ${unit.label}`}
                        onClick={() => setBlockUnit(unit)}
                      >
                        <BanIcon className="size-3" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-6 text-muted-foreground"
                            aria-label={`More actions for ${unit.label}`}
                          >
                            <MoreHorizontalIcon className="size-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="erp w-44">
                          <DropdownMenuItem
                            onSelect={() => setEditUnit(unit)}
                          >
                            <PencilIcon className="size-3.5" />
                            Edit room
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setBlockUnit(unit)}
                          >
                            <BanIcon className="size-3.5" />
                            Block room
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              void navigator.clipboard?.writeText(unit.label);
                            }}
                          >
                            Copy label
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div
                    className="relative flex select-none"
                    style={{ width: days.length * CELL, height: ROW_H }}
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
                          onPointerDown={(e) => {
                            if (selectedPool) {
                              e.preventDefault();
                              assignPoolBooking(unit);
                              return;
                            }
                            onCellPointerDown(e, unitIdx, dayIdx);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            if (selectedPool) {
                              assignPoolBooking(unit);
                              return;
                            }
                            openFromSelection({
                              unitStart: unitIdx,
                              unitEnd: unitIdx,
                              dayStart: dayIdx,
                              dayEnd: dayIdx,
                            });
                          }}
                          className={cn(
                            "absolute top-0 h-full cursor-cell border-r",
                            isWeekend(day) && "bg-muted/30",
                            day === today && "bg-accent/5",
                            selected &&
                              "bg-sky-500/35 ring-1 ring-inset ring-sky-600",
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
                      const width = Math.max(CELL, dayIndex(from, to) * CELL);
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
                      if (to <= start || from >= endExclusive || to <= from) {
                        return null;
                      }
                      const left = dayIndex(start, from) * CELL;
                      const width = Math.max(CELL, dayIndex(from, to) * CELL);
                      return (
                        <div
                          key={stay.id}
                          data-stay-id={stay.id}
                          className={cn(
                            "group/stay absolute top-0 z-10 h-full rounded-sm transition-[opacity,box-shadow] duration-200",
                            dayFilter &&
                              !matchesDayFilter(stay) &&
                              "opacity-20",
                            flashStayId === stay.id &&
                              "z-20 ring-2 ring-accent ring-offset-2",
                          )}
                          style={{ left: left + 2, width: width - 4 }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextStayId(stay.id);
                          }}
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
                          {!stay.is_locked ? (
                            <>
                              <button
                                type="button"
                                aria-label="Resize stay start"
                                className="absolute top-0 left-0 z-20 h-full w-1.5 cursor-ew-resize rounded-l-sm bg-foreground/15 opacity-0 transition-opacity group-hover/stay:opacity-100 focus-visible:opacity-100"
                                onPointerDown={(e) =>
                                  beginStayResize("start", stay, e)
                                }
                              />
                              <button
                                type="button"
                                aria-label="Resize stay end"
                                className="absolute top-0 right-0 z-20 h-full w-1.5 cursor-ew-resize rounded-r-sm bg-foreground/15 opacity-0 transition-opacity group-hover/stay:opacity-100 focus-visible:opacity-100"
                                onPointerDown={(e) =>
                                  beginStayResize("end", stay, e)
                                }
                              />
                            </>
                          ) : null}
                          <StayHoverCard
                            stay={stay}
                            today={today}
                            suppressed={
                              dragging ||
                              selectedStayId === stay.id ||
                              contextStayId === stay.id
                            }
                            onOpenDetail={() => openStay(stay)}
                          />
                          <DropdownMenu
                            open={contextStayId === stay.id}
                            onOpenChange={(open) => {
                              if (!open && contextStayId === stay.id) {
                                setContextStayId(null);
                              }
                            }}
                          >
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="sr-only"
                                aria-label={`Actions for ${stay.contact_name ?? "stay"}`}
                              >
                                Stay actions
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="erp w-48"
                              onCloseAutoFocus={(e) => e.preventDefault()}
                            >
                              <DropdownMenuItem
                                onSelect={() => {
                                  setContextStayId(null);
                                  openStay(stay);
                                }}
                              >
                                Open stay
                              </DropdownMenuItem>
                              {stay.status !== "checked_in" ? (
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setContextStayId(null);
                                    stayHub?.openStayHub({
                                      bookingId: stay.booking_id,
                                      assignmentId: stay.id,
                                      seedStay: stay,
                                      agents,
                                      units,
                                      step: "check_in",
                                    });
                                  }}
                                >
                                  Check-in
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setContextStayId(null);
                                    stayHub?.openStayHub({
                                      bookingId: stay.booking_id,
                                      assignmentId: stay.id,
                                      seedStay: stay,
                                      agents,
                                      units,
                                      step: "check_out",
                                    });
                                  }}
                                >
                                  Check-out
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link href={`/erp/bookings/${stay.booking_id}`}>
                                  Booking
                                </Link>
                              </DropdownMenuItem>
                              {stay.folio_id ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/erp/folios/${stay.folio_id}`}>
                                    Folio
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onSelect={() => {
                                  void navigator.clipboard?.writeText(
                                    stay.contact_name ?? stay.booking_id,
                                  );
                                }}
                              >
                                Copy guest name
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {useVirtual ? (
              <div
                aria-hidden
                style={{
                  height: Math.max(
                    0,
                    rowOffsets.totalH -
                      (rowOffsets.offsets[visibleRowRange.end ?? 0] ??
                        rowOffsets.totalH),
                  ),
                }}
              />
            ) : null}

            <div
              className="sticky bottom-0 z-30 flex border-t bg-card"
              style={{ height: FOOTER_H }}
            >
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-card px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                style={{ width: leftWidth }}
              >
                Occ
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
        staff={staff}
        defaultSoldByStaffId={defaultSoldByStaffId}
        mealPlans={mealPlans}
        defaultMealPlanCode={defaultMealPlanCode}
      />
      <CalendarRoomBlockDialog
        unit={blockUnit}
        open={blockUnit != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setBlockUnit(null);
        }}
        start={today}
      />
      <CalendarRoomUnitEditDialog
        unit={editUnit}
        propertyId={propertyId}
        open={editUnit != null}
        peerUnits={units.map((u) => ({ id: u.id, label: u.label }))}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditUnit(null);
        }}
      />
    </div>
  );
}
