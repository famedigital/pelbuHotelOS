import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  AttentionChip,
  Badge,
  Button,
  GlassElevated,
  MorphTabs,
  StatusLegend,
  useIsPhone,
} from "@hos-v2/ui";
import {
  SmartAssignSheet,
  type SmartAssignMode,
} from "./SmartAssignSheet";
import {
  addDays,
  computeMonthStayviewStats,
  firstOfMonth,
  formatNu,
  folioBalance,
  listTourGroups,
  monthLabel,
  nightsBetween,
  parseYearMonth,
  stayOnDate,
  unassignedNearTerm,
  useFrontOfficeStore,
  type MealPlan,
  type Room,
  type RoomBlock,
  type RoomTypeCode,
  type Stay,
  ymd,
} from "../lib/front-office-store";
import { deskCan } from "../lib/desk-auth";
import { isApiUuid } from "../lib/fo-remote";
import { rateCardById, useCommercialStore } from "../lib/commercial-store";

const GROUP_MEALS: MealPlan[] = ["EP", "CP", "MAP", "AP"];

const CELL_W = 104;
const LABEL_W = 148;
const OCC_ROW_H = 36;
const ROW_H = 40;

type DragPayload =
  | { kind: "unassigned"; stayId: string; label: string }
  | { kind: "ribbon"; stayId: string; label: string };

type FloorFilter = "all" | "1" | "2" | "3";
type TypeFilter = "all" | "deluxe_king" | "deluxe_twin" | "deluxe_queen" | "suite";
type HkFilter = "all" | "clean" | "dirty" | "ooo";
/** One-tap desk focus — system does the filter work */
type AttentionFocus =
  | "all"
  | "need_rooms"
  | "dirty"
  | "arrivals"
  | "due"
  | "vip";

function stayMatchesQuery(stay: Stay, q: string): boolean {
  if (!q) return true;
  const hay = [
    stay.guestName,
    stay.confirmationNo,
    stay.roomNumber,
    stay.groupName,
    stay.agencyName,
    stay.guestPhone,
    stay.guestEmail,
    stay.nationality,
    stay.passportOrCid,
    stay.typeCode,
    stay.mealPlan,
    stay.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function roomMatchesQuery(
  room: Room,
  q: string,
  roomStays: Stay[],
): boolean {
  if (!q) return true;
  if (
    room.number.toLowerCase().includes(q) ||
    room.typeCode.toLowerCase().includes(q) ||
    room.typeName.toLowerCase().includes(q) ||
    room.hkStatus.toLowerCase().includes(q)
  ) {
    return true;
  }
  return roomStays.some((s) => stayMatchesQuery(s, q));
}

function isWeekend(dateYmd: string): boolean {
  const dow = new Date(`${dateYmd}T12:00:00`).getDay();
  return dow === 0 || dow === 6;
}

function HkDot({ status }: { status: Room["hkStatus"] }) {
  const color =
    status === "clean" || status === "inspected"
      ? "bg-[var(--hos-emerald)]"
      : status === "dirty"
        ? "bg-[var(--hos-ruby)]"
        : status === "ooo"
          ? "bg-[var(--hos-ink-3)]"
          : "bg-[var(--hos-primary)]";
  return <span className={`inline-block size-1.5 rounded-full ${color}`} />;
}

function occTone(pct: number): string {
  if (pct >= 90) return "bg-[rgba(239,68,68,0.18)] text-[var(--hos-ruby)] font-black";
  if (pct >= 70) return "bg-[rgba(245,158,11,0.18)] text-[var(--hos-brass-ink)] font-bold";
  return "bg-[rgba(16,185,129,0.16)] text-[var(--hos-emerald)] font-semibold";
}

function UnassignedChip({
  stay,
  onOpen,
  onSmartAssign,
}: {
  stay: Stay;
  onOpen: () => void;
  onSmartAssign: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unassigned:${stay.id}`,
    data: {
      kind: "unassigned",
      stayId: stay.id,
      label: `${stay.confirmationNo} · ${stay.guestName}`,
    } satisfies DragPayload,
  });

  return (
    <motion.div
      ref={setNodeRef}
      className={`hos-cell rounded-xl p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        className="text-left text-sm font-semibold text-[var(--hos-primary)]"
        onClick={onOpen}
      >
        {stay.guestName}
        {stay.vip ? (
          <Badge tone="vip" className="ml-1.5 !align-middle">
            VIP
          </Badge>
        ) : null}
      </button>
      <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
        {stay.confirmationNo} · {stay.typeCode} · {stay.checkIn.slice(5)}→
        {stay.checkOut.slice(5)}
      </p>
      {stay.groupName ? (
        <p className="m-0 mt-1 text-[10px] font-semibold text-[var(--hos-teal)]">
          👥 {stay.groupName}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          className="hos-btn-ink !min-h-8 !rounded-full !px-2.5 text-[11px]"
          onClick={onSmartAssign}
        >
          ⚡ Smart
        </Button>
        <button
          type="button"
          className="inline-flex min-h-8 cursor-grab items-center rounded-full border border-dashed border-[rgba(37,99,235,0.4)] bg-[rgba(37,99,235,0.06)] px-2.5 text-[11px] font-semibold text-[var(--hos-primary)] active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          Drag → room
        </button>
      </div>
    </motion.div>
  );
}

function RoomLabelCell({
  room,
  onAssignClick,
}: {
  room: Room;
  onAssignClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `room:${room.id}`,
    data: { roomId: room.id, date: "", typeCode: room.typeCode },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={() => onAssignClick?.()}
      title="Assign arrival into this room"
      className={[
        "sticky left-0 z-[2] flex items-center gap-2 border-b border-r border-[var(--hos-line)] bg-[#f8fafc] px-2.5 text-left dark:bg-[#0f1623]",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out",
        "hover:bg-[rgba(37,99,235,0.1)] hover:shadow-[inset_3px_0_0_0_var(--hos-primary)]",
        "active:scale-[0.99]",
        isOver ? "bg-[rgba(37,99,235,0.14)] ring-2 ring-inset ring-[var(--hos-primary)]" : "",
      ].join(" ")}
      style={{ width: LABEL_W, minHeight: ROW_H }}
    >
      <HkDot status={room.hkStatus} />
      <div className="min-w-0">
        <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--hos-ink)]">
          {room.number}
        </div>
        <div className="truncate text-[10px] capitalize text-[var(--hos-ink-3)]">
          {room.typeCode} · {room.hkStatus}
        </div>
      </div>
    </button>
  );
}

function EmptyCell({
  roomId,
  date,
  typeCode,
  onPaintStart,
  onPaintEnter,
  painting,
  isTodayCol,
  weekend,
  blocked,
  blockLabel,
}: {
  roomId: string;
  date: string;
  typeCode: string;
  onPaintStart: () => void;
  onPaintEnter: () => void;
  painting: boolean;
  isTodayCol: boolean;
  weekend: boolean;
  blocked?: boolean;
  blockLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${roomId}:${date}`,
    data: { roomId, date, typeCode },
    disabled: Boolean(blocked),
  });

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      title={blocked ? blockLabel : undefined}
      onMouseDown={(e) => {
        if (blocked) return;
        if (e.button === 0) onPaintStart();
      }}
      onMouseEnter={() => {
        if (painting && !blocked) onPaintEnter();
      }}
      className={[
        "hos-rack-cell relative border-b border-r border-[var(--hos-line)] transition-[background-color,box-shadow,transform] duration-150 ease-out",
        weekend
          ? "bg-[rgba(15,23,42,0.04)] dark:bg-[rgba(255,255,255,0.03)]"
          : "bg-[var(--hos-cell)]",
        isTodayCol ? "bg-[rgba(59,130,246,0.07)]" : "",
        blocked
          ? "cursor-not-allowed bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,rgba(239,68,68,0.14)_4px,rgba(239,68,68,0.14)_8px)]"
          : "hover:bg-[rgba(37,99,235,0.12)] hover:shadow-[inset_0_0_0_1px_rgba(37,99,235,0.35)] active:bg-[rgba(37,99,235,0.2)] active:scale-[0.98]",
        isOver || painting
          ? "!bg-[rgba(37,99,235,0.2)] !shadow-[inset_0_0_0_2px_var(--hos-primary)]"
          : "",
      ].join(" ")}
      style={{ width: CELL_W, minHeight: ROW_H }}
    >
      {blocked ? (
        <span className="pointer-events-none absolute inset-x-1 top-1 truncate text-[8px] font-bold uppercase tracking-wide text-[var(--hos-ruby)]">
          {blockLabel ?? "OOO"}
        </span>
      ) : null}
    </div>
  );
}

function StayHoverDossier({
  stay,
  x,
  y,
  today,
  rateCardLabel,
  onCheckIn,
  onStayHub,
  onShift,
  onSaveNote,
}: {
  stay: Stay;
  x: number;
  y: number;
  today: string;
  rateCardLabel?: string;
  onCheckIn: () => void;
  onStayHub: () => void;
  onShift: () => void;
  onSaveNote: (notes: string) => void;
}) {
  const bal = folioBalance(stay);
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const canCheckIn =
    ["confirmed", "held"].includes(stay.status) && stay.checkIn === today;
  const [noteDraft, setNoteDraft] = useState(stay.notes ?? "");

  return (
    <div
      className="pointer-events-auto fixed z-[100] w-[300px] rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,0.55)]"
      style={{
        left: Math.min(x + 14, window.innerWidth - 320),
        top: Math.min(y + 14, window.innerHeight - 320),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="text-sm text-[var(--hos-ink)]">{stay.guestName}</strong>
        {stay.vip ? <Badge tone="vip">VIP</Badge> : null}
      </div>
      <p className="m-0 mt-1 text-[11px] text-[var(--hos-ink-3)]">
        {stay.passportOrCid} · {stay.nationality}
      </p>
      <p className="m-0 mt-1 text-[11px] text-[var(--hos-ink-2)]">
        {stay.checkIn} → {stay.checkOut} · {nights} night{nights === 1 ? "" : "s"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="teal">{stay.mealPlan}</Badge>
        {stay.groupName ? (
          <Badge tone="default">{stay.groupName.split(" ")[0]}</Badge>
        ) : null}
        {rateCardLabel ? <Badge tone="default">{rateCardLabel}</Badge> : null}
      </div>
      <p
        className={`m-0 mt-2 text-sm font-bold tabular-nums ${
          bal > 0.5 ? "text-[var(--hos-ruby)]" : "text-[var(--hos-emerald)]"
        }`}
      >
        Folio {formatNu(bal)}
      </p>
      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
        Notes
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if ((stay.notes ?? "") !== noteDraft.trim()) onSaveNote(noteDraft);
          }}
          rows={2}
          placeholder="Desk note…"
          className="mt-1 w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-[11px] font-normal normal-case text-[var(--hos-ink)]"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {canCheckIn ? (
          <Button size="sm" onClick={onCheckIn}>
            Check-In
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={onStayHub}>
          StayHub
        </Button>
        <Button size="sm" variant="ghost" onClick={onShift}>
          Shift Room
        </Button>
      </div>
    </div>
  );
}

function StayRibbon({
  stay,
  startIdx,
  span,
  groupPax,
  today,
  highlight,
  dimmed,
  onOpen,
  onHover,
  onLeave,
}: {
  stay: Stay;
  startIdx: number;
  span: number;
  groupPax: number;
  today: string;
  highlight?: boolean;
  dimmed?: boolean;
  onOpen: () => void;
  onHover: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const reduce = useReducedMotion();
  const bal = folioBalance(stay);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ribbon:${stay.id}`,
    data: {
      kind: "ribbon",
      stayId: stay.id,
      label: stay.guestName,
    } satisfies DragPayload,
  });

  const arrivingToday =
    ["confirmed", "held"].includes(stay.status) && stay.checkIn === today;

  const groupColor = useFrontOfficeStore((s) =>
    stay.groupId ? s.groupMeta[stay.groupId]?.color : undefined,
  );

  /* Solid enterprise bars — group tint when linked; departed = muted slate */
  let tone =
    "border-[color-mix(in_srgb,var(--hos-emerald)_45%,transparent)] bg-[var(--hos-emerald)]";
  if (stay.status === "checked_out") {
    tone =
      "border-[color-mix(in_srgb,var(--hos-ink-3)_40%,transparent)] bg-[color-mix(in_srgb,var(--hos-ink-2)_72%,#64748b)] opacity-90";
  } else if (stay.vip) {
    tone =
      "border-[color-mix(in_srgb,var(--hos-brass)_50%,transparent)] bg-[var(--hos-brass)]";
  } else if (stay.status === "checked_in") {
    tone =
      "border-[color-mix(in_srgb,var(--hos-primary)_45%,transparent)] bg-[var(--hos-primary)]";
  } else if (stay.status === "held") {
    tone =
      "border-[color-mix(in_srgb,var(--hos-brass)_50%,transparent)] bg-[var(--hos-brass)]";
  } else if (arrivingToday) {
    tone =
      "border-[color-mix(in_srgb,var(--hos-emerald)_50%,transparent)] bg-[var(--hos-emerald)]";
  }

  const shortGroup = stay.groupName
    ? stay.groupName.split(/[-–—]/)[0]?.trim().slice(0, 18) ?? stay.groupName.slice(0, 18)
    : null;

  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onOpen}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onLeave}
      whileHover={
        reduce
          ? undefined
          : { y: -2, scale: 1.02, filter: "brightness(1.08)", zIndex: 6 }
      }
      whileTap={reduce ? undefined : { scale: 0.97, y: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      className={`absolute top-1 z-[1] flex h-8 cursor-grab items-center gap-1 overflow-hidden rounded-lg border px-2 text-left text-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)] active:cursor-grabbing before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-white/35 after:absolute after:inset-y-0 after:right-0 after:w-1 after:bg-black/20 ${tone} ${
        isDragging ? "opacity-50" : ""
      } ${highlight ? "ring-2 ring-white ring-offset-1 ring-offset-[var(--hos-primary)] z-[3]" : ""} ${
        dimmed ? "opacity-35" : ""
      }`}
      style={{
        left: LABEL_W + startIdx * CELL_W + 3,
        width: span * CELL_W - 6,
        textShadow: "0 1px 2px rgba(0,0,0,0.55)",
        ...(groupColor
          ? { backgroundColor: groupColor, borderColor: groupColor }
          : {}),
      }}
    >
      <span className="truncate text-[11px] font-semibold tracking-tight">
        {stay.guestName}
      </span>
      {stay.vip ? (
        <span className="shrink-0 rounded bg-black/25 px-1 text-[9px] font-bold">
          VIP
        </span>
      ) : null}
      {stay.notes ? (
        <span
          title={stay.notes}
          className="hidden max-w-[72px] truncate rounded bg-black/25 px-1 text-[9px] font-semibold sm:inline"
        >
          {stay.notes}
        </span>
      ) : null}
      {shortGroup ? (
        <span className="hidden max-w-[90px] truncate rounded bg-black/20 px-1 text-[9px] font-semibold lg:inline">
          {shortGroup}
          {groupPax > 0 ? ` ${groupPax}P` : ""}
        </span>
      ) : null}
      {bal > 0.5 ? (
        <span className="ml-auto shrink-0 text-[9px] font-semibold opacity-90">
          {formatNu(bal)}
        </span>
      ) : null}
    </motion.button>
  );
}

export function StayViewPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const stays = useFrontOfficeStore((s) => s.stays);
  const groupMeta = useFrontOfficeStore((s) => s.groupMeta);
  const horizonDays = useFrontOfficeStore((s) => s.horizonDays);
  const rackAnchorDate = useFrontOfficeStore((s) => s.rackAnchorDate);
  const setHorizonDays = useFrontOfficeStore((s) => s.setHorizonDays);
  const setRackAnchorDate = useFrontOfficeStore((s) => s.setRackAnchorDate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const assignRoom = useFrontOfficeStore((s) => s.assignRoom);
  const moveRoom = useFrontOfficeStore((s) => s.moveRoom);
  const extendStay = useFrontOfficeStore((s) => s.extendStay);
  const ensureStaySynced = useFrontOfficeStore((s) => s.ensureStaySynced);
  const blockRoom = useFrontOfficeStore((s) => s.blockRoom);
  const releaseRoomBlock = useFrontOfficeStore((s) => s.releaseRoomBlock);
  const roomBlocks = useFrontOfficeStore((s) => s.roomBlocks);
  const checkIn = useFrontOfficeStore((s) => s.checkIn);
  const setStayNotes = useFrontOfficeStore((s) => s.setStayNotes);
  const applyGroupMealPlan = useFrontOfficeStore((s) => s.applyGroupMealPlan);
  const checkInGroup = useFrontOfficeStore((s) => s.checkInGroup);
  const setRoomHkStatus = useFrontOfficeStore((s) => s.setRoomHkStatus);
  const moveModal = useFrontOfficeStore((s) => s.moveModal);
  const setMoveModal = useFrontOfficeStore((s) => s.setMoveModal);
  const agents = useCommercialStore((s) => s.agents);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const [, start] = useTransition();
  const canWriteStayview = deskCan("stayview", "write");
  const apiOffline = useFrontOfficeStore((s) => s.apiOffline);

  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [hoverStay, setHoverStay] = useState<{ stay: Stay; x: number; y: number } | null>(
    null,
  );
  const [queueOpen, setQueueOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<SmartAssignMode | null>(null);
  const [dirtyPinPrompt, setDirtyPinPrompt] = useState<{
    stayId: string;
    roomId: string;
    mode: "assign" | "move" | "upgrade";
    moveReason?: "maintenance" | "upgrade" | "guest_request" | "operations";
  } | null>(null);
  const [dirtyPin, setDirtyPin] = useState("");
  const [blockPrompt, setBlockPrompt] = useState<{
    roomId: string;
    roomNumber: string;
  } | null>(null);
  const [blockReason, setBlockReason] = useState("Maintenance");
  const [floorFilter, setFloorFilter] = useState<FloorFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [hkFilter, setHkFilter] = useState<HkFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string | "all">("all");
  const [attention, setAttention] = useState<AttentionFocus>("all");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [syncBusy, setSyncBusy] = useState(false);
  const [paint, setPaint] = useState<{
    roomId: string;
    typeCode: string;
    start: string;
    end: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const smartAutoAssign = useFrontOfficeStore((s) => s.smartAutoAssign);

  const isPhone = useIsPhone();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  useEffect(() => {
    if (isPhone && horizonDays !== 7) setHorizonDays(7);
  }, [isPhone, horizonDays]);

  const dates = useMemo(
    () => Array.from({ length: horizonDays }, (_, i) => addDays(rackAnchorDate, i)),
    [horizonDays, rackAnchorDate],
  );

  const today = ymd(new Date());
  const qNorm = query.trim().toLowerCase();

  const tourGroups = useMemo(
    () => listTourGroups(stays, groupMeta).filter((g) => g.members.length > 0),
    [stays, groupMeta],
  );
  const selectedTourGroup = tourGroups.find((g) => g.id === groupFilter);

  const unassigned = useMemo(
    () => unassignedNearTerm(stays, today, 2),
    [stays, today],
  );

  const attentionStats = useMemo(() => {
    const dirtyRooms = rooms.filter((r) => r.hkStatus === "dirty").length;
    const arrivalsToday = stays.filter(
      (s) => s.checkIn === today && ["confirmed", "held"].includes(s.status),
    );
    const due = stays.filter(
      (s) => s.status === "checked_in" && folioBalance(s) > 0.5,
    );
    const vip = stays.filter((s) => s.vip && s.status === "checked_in");
    return {
      needRooms: unassigned.length,
      dirty: dirtyRooms,
      arrivals: arrivalsToday.length,
      due: due.length,
      vip: vip.length,
      dueStays: due,
      vipStays: vip,
      arrivalStays: arrivalsToday,
    };
  }, [rooms, stays, today, unassigned.length]);

  const filteredRooms = useMemo(() => {
    const groupRoomIds =
      groupFilter === "all"
        ? null
        : new Set(
            stays
              .filter((s) => s.groupId === groupFilter && s.roomId)
              .map((s) => s.roomId!),
          );
    const needTypeCodes =
      attention === "need_rooms"
        ? new Set(unassigned.map((s) => s.typeCode))
        : null;
    const arrivalRoomIds =
      attention === "arrivals"
        ? new Set(
            attentionStats.arrivalStays
              .map((s) => s.roomId)
              .filter((id): id is string => Boolean(id)),
          )
        : null;
    const dueRoomIds =
      attention === "due"
        ? new Set(
            attentionStats.dueStays
              .map((s) => s.roomId)
              .filter((id): id is string => Boolean(id)),
          )
        : null;
    const vipRoomIds =
      attention === "vip"
        ? new Set(
            attentionStats.vipStays
              .map((s) => s.roomId)
              .filter((id): id is string => Boolean(id)),
          )
        : null;

    return rooms.filter((r) => {
      const roomStays = stays.filter((s) => s.roomId === r.id);
      if (qNorm && !roomMatchesQuery(r, qNorm, roomStays)) return false;
      if (floorFilter !== "all" && r.floor !== Number(floorFilter)) return false;
      if (typeFilter === "deluxe_king" && r.typeCode !== "deluxe_king") return false;
      if (typeFilter === "deluxe_twin" && r.typeCode !== "deluxe_twin") return false;
      if (typeFilter === "deluxe_queen" && r.typeCode !== "deluxe_queen") return false;
      if (typeFilter === "suite" && r.typeCode !== "suite") return false;
      if (hkFilter === "clean" && !(r.hkStatus === "clean" || r.hkStatus === "inspected"))
        return false;
      if (hkFilter === "dirty" && r.hkStatus !== "dirty") return false;
      if (hkFilter === "ooo" && r.hkStatus !== "ooo") return false;
      if (groupRoomIds && !groupRoomIds.has(r.id)) return false;

      if (attention === "dirty") return r.hkStatus === "dirty";
      if (attention === "need_rooms") {
        const occupiedToday = stays.some(
          (s) => s.roomId === r.id && stayOnDate(s, today),
        );
        return (
          !occupiedToday &&
          r.hkStatus !== "ooo" &&
          (needTypeCodes?.size ? needTypeCodes.has(r.typeCode) : true)
        );
      }
      if (attention === "arrivals") {
        if (arrivalRoomIds?.has(r.id)) return true;
        const occupiedToday = stays.some(
          (s) => s.roomId === r.id && stayOnDate(s, today),
        );
        return (
          !occupiedToday &&
          (r.hkStatus === "clean" || r.hkStatus === "inspected") &&
          attentionStats.arrivalStays.some((s) => !s.roomId && s.typeCode === r.typeCode)
        );
      }
      if (attention === "due") return Boolean(dueRoomIds?.has(r.id));
      if (attention === "vip") return Boolean(vipRoomIds?.has(r.id));
      return true;
    });
  }, [
    rooms,
    floorFilter,
    typeFilter,
    hkFilter,
    groupFilter,
    stays,
    qNorm,
    attention,
    unassigned,
    attentionStats,
    today,
  ]);

  const roomsByFloor = useMemo(() => {
    const floors = [...new Set(filteredRooms.map((r) => r.floor))].sort((a, b) => a - b);
    return floors.map((floor) => ({
      floor,
      rooms: filteredRooms.filter((r) => r.floor === floor),
    }));
  }, [filteredRooms]);

  const flatRows = useMemo(() => {
    const rows: { kind: "floor" | "room"; floor?: number; room?: Room }[] = [];
    for (const f of roomsByFloor) {
      rows.push({ kind: "floor", floor: f.floor });
      for (const r of f.rooms) rows.push({ kind: "room", room: r });
    }
    return rows;
  }, [roomsByFloor]);

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (flatRows[i]?.kind === "floor" ? 28 : ROW_H),
    overscan: 10,
  });

  const groupPaxMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stays) {
      if (!s.groupName || ["cancelled", "no_show"].includes(s.status)) continue;
      const pax =
        (s.adults && s.adults > 0
          ? s.adults
          : 1 + (s.companions?.length ?? 0)) + (s.children ?? 0);
      map.set(s.groupName, (map.get(s.groupName) ?? 0) + pax);
    }
    return map;
  }, [stays]);

  const dayStats = useMemo(() => {
    return dates.map((d) => {
      const sold = rooms.filter((r) =>
        stays.some((s) => s.roomId === r.id && stayOnDate(s, d)),
      ).length;
      const sellable = rooms.filter((r) => r.hkStatus !== "ooo").length;
      const pct = sellable ? Math.round((sold / sellable) * 100) : 0;
      const vacant = Math.max(0, sellable - sold);
      return { date: d, pct, vacant, sold, sellable };
    });
  }, [dates, rooms, stays]);

  const occTonight = rooms.filter((r) =>
    stays.some((s) => s.roomId === r.id && stayOnDate(s, today)),
  ).length;

  const viewedMonth = useMemo(
    () => parseYearMonth(rackAnchorDate),
    [rackAnchorDate],
  );
  const monthStats = useMemo(
    () =>
      computeMonthStayviewStats(
        rooms,
        stays,
        viewedMonth.year,
        viewedMonth.month,
      ),
    [rooms, stays, viewedMonth.year, viewedMonth.month],
  );

  const jumpToMonth = (year: number, month: number) => {
    setRackAnchorDate(firstOfMonth(year, month));
    if (horizonDays < 30) setHorizonDays(30);
    setCalOpen(false);
    setAttention("all");
  };

  const filtersActive =
    floorFilter !== "all" ||
    typeFilter !== "all" ||
    hkFilter !== "all" ||
    groupFilter !== "all" ||
    attention !== "all" ||
    Boolean(qNorm);

  const clearSmartFilters = () => {
    setFloorFilter("all");
    setTypeFilter("all");
    setHkFilter("all");
    setGroupFilter("all");
    setAttention("all");
    setQuery("");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (query) {
          setQuery("");
          return;
        }
        if (attention !== "all") {
          setAttention("all");
          return;
        }
        searchRef.current?.blur();
        return;
      }
      if (typing) return;
      if (e.key === "t" || e.key === "T") {
        setRackAnchorDate(today);
        return;
      }
      if (e.key === "u" || e.key === "U") {
        setQueueOpen(true);
        setAttention("need_rooms");
        return;
      }
      if ((e.key === "b" || e.key === "B") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openFastBook();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, attention, today, setRackAnchorDate, openFastBook]);

  const ribbonsForRoom = (room: Room) => {
    const roomStays = stays.filter(
      (s) =>
        s.roomId === room.id &&
        !["cancelled", "no_show"].includes(s.status) &&
        s.checkIn < addDays(rackAnchorDate, horizonDays) &&
        s.checkOut > rackAnchorDate,
    );
    return roomStays.map((stay) => {
      const start = stay.checkIn < rackAnchorDate ? rackAnchorDate : stay.checkIn;
      const end =
        stay.checkOut > addDays(rackAnchorDate, horizonDays)
          ? addDays(rackAnchorDate, horizonDays)
          : stay.checkOut;
      const startIdx = dates.indexOf(start);
      const endIdxExclusive = dates.indexOf(end);
      const span =
        (endIdxExclusive === -1 ? dates.length : endIdxExclusive) -
        (startIdx === -1 ? 0 : startIdx);
      return { stay, startIdx: Math.max(0, startIdx), span: Math.max(1, span) };
    });
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveDrag(e.active.data.current as DragPayload);
    setHoverStay(null);
  };

  const tryAssign = async (
    stayId: string,
    roomId: string,
    opts?: {
      allowUpgrade?: boolean;
      moveReason?: "maintenance" | "upgrade" | "guest_request" | "operations";
      dirtyOverridePin?: string;
    },
  ) => {
    if (!canWriteStayview) {
      toast.error("No StayView write permission");
      return { ok: false as const, error: "FORBIDDEN" };
    }
    const res = await assignRoom(stayId, roomId, undefined, opts);
    if (!res.ok && res.code === "DIRTY_PIN_REQUIRED") {
      setDirtyPin("");
      setDirtyPinPrompt({
        stayId,
        roomId,
        mode: opts?.moveReason ? "move" : opts?.allowUpgrade ? "upgrade" : "assign",
        moveReason: opts?.moveReason,
      });
      return res;
    }
    return res;
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const payload = e.active.data.current as DragPayload | undefined;
    const over = e.over?.data.current as
      | { roomId: string; date: string; typeCode: string }
      | undefined;
    if (!payload || !over) return;
    if (!canWriteStayview) {
      toast.error("No StayView write permission");
      return;
    }

    if (payload.kind === "unassigned") {
      start(() => {
        void (async () => {
          const res = await tryAssign(payload.stayId, over.roomId);
          if (!res.ok) {
            if (res.code !== "DIRTY_PIN_REQUIRED") toast.error(res.error);
            return;
          }
          toast.success("Room assigned", {
            description: "Stay dropped onto room",
          });
          setQueueOpen(false);
        })();
      });
      return;
    }

    if (payload.kind === "ribbon") {
      if (!canWriteStayview) {
        toast.error("No StayView write permission");
        return;
      }
      const stay = stays.find((s) => s.id === payload.stayId);
      if (!stay) return;
      if (stay.roomId === over.roomId) {
        if (over.date && over.date >= stay.checkOut) {
          start(() => {
            void (async () => {
              const res = await extendStay({
                stayId: stay.id,
                newCheckOut: addDays(over.date, 1),
              });
              if (!res.ok) toast.error(res.error);
              else toast.success(`Extended to ${addDays(over.date, 1)}`);
            })();
          });
          return;
        }
        if (over.date && over.date > stay.checkIn && over.date < stay.checkOut) {
          /* Drag inward on same room = shorten (checkout = day after drop). */
          const shorten = useFrontOfficeStore.getState().shortenStay;
          start(() => {
            void (async () => {
              const res = await shorten({
                stayId: stay.id,
                newCheckOut: addDays(over.date, 1),
              });
              if (!res.ok) toast.error(res.error);
              else toast.success(`Shortened to ${addDays(over.date, 1)}`);
            })();
          });
          return;
        }
        return;
      }
      setMoveModal({ stayId: stay.id, toRoomId: over.roomId });
    }
  };

  const unsyncedStays = useMemo(
    () =>
      stays.filter(
        (s) =>
          !["cancelled", "checked_out", "no_show"].includes(s.status) &&
          (!isApiUuid(s.apiBookingId) || s.syncPending),
      ),
    [stays],
  );

  const blockOnDate = (roomId: string, date: string): RoomBlock | undefined =>
    roomBlocks.find(
      (b) => b.roomId === roomId && b.fromDate <= date && date < b.toDate,
    );

  const finishPaint = () => {
    if (!paint) return;
    if (!canWriteStayview) {
      setPaint(null);
      toast.error("No StayView write permission");
      return;
    }
    const startDate = paint.start <= paint.end ? paint.start : paint.end;
    const endDate = paint.start <= paint.end ? paint.end : paint.start;
    const span = nightsBetween(startDate, addDays(endDate, 1));
    if (span < 2) {
      setPaint(null);
      return;
    }
    const clampedEnd =
      span > 7 ? addDays(startDate, 6) : endDate;
    openFastBook({
      checkIn: startDate,
      checkOut: addDays(clampedEnd, 1),
      typeCode: paint.typeCode as RoomTypeCode,
      roomId: paint.roomId,
      source: "direct",
      mealPlan: "MAP",
    });
    setPaint(null);
  };

  const occPct = Math.round((occTonight / Math.max(rooms.length, 1)) * 100);

  /* Phone uses the same rack calendar as desktop (7D horizon + month jump). */

  const attentionChips: {
    id: AttentionFocus;
    label: string;
    count: number;
    tone: "primary" | "emerald" | "brass" | "ruby" | "muted";
  }[] = [
    {
      id: "need_rooms",
      label: "Need rooms",
      count: attentionStats.needRooms,
      tone: "brass",
    },
    {
      id: "arrivals",
      label: "Arrivals",
      count: attentionStats.arrivals,
      tone: "primary",
    },
    {
      id: "dirty",
      label: "Dirty",
      count: attentionStats.dirty,
      tone: "ruby",
    },
    {
      id: "due",
      label: "Balances due",
      count: attentionStats.due,
      tone: "ruby",
    },
    {
      id: "vip",
      label: "VIP",
      count: attentionStats.vip,
      tone: "brass",
    },
  ];

  const rackLegend = [
    { id: "in", label: "In-house", swatch: "var(--hos-primary)" },
    { id: "arr", label: "Arrival", swatch: "var(--hos-emerald)" },
    { id: "vip", label: "VIP", swatch: "var(--hos-brass)" },
    { id: "held", label: "Held", swatch: "var(--hos-brass)" },
    { id: "out", label: "Departed", swatch: "var(--hos-ink-3)" },
    { id: "due", label: "Balance due", swatch: "var(--hos-ruby)" },
  ];

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        className="hos-rack-premium relative flex h-full min-h-0 flex-col gap-2 overflow-hidden"
        onMouseUp={finishPaint}
        onMouseLeave={() => {
          if (paint) finishPaint();
        }}
      >
        {/* Command chrome — LivePanel-grade frost; opaque rack below */}
        {/* z-30 above rack sticky date headers (z-4/5) so month jump isn’t buried */}
        <div className="hos-module-chrome relative z-30 flex shrink-0 flex-col gap-1.5 rounded-none border-x-0 border-t-0 px-2 py-2 md:rounded-2xl md:px-3">
          <div className="flex min-h-9 flex-wrap items-center gap-2">
            <div className="flex shrink-0 items-center gap-2">
              <h1 className="m-0 whitespace-nowrap text-sm font-medium tracking-normal text-[var(--hos-ink)]">
                StayView
              </h1>
              <button
                type="button"
                onClick={() => {
                  setAttention("all");
                  setHkFilter("all");
                  setRackAnchorDate(today);
                }}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-emerald)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--hos-emerald)] hover:border-[var(--hos-emerald)]"
                title="Jump to today · clear attention"
              >
                <span className="size-1.5 rounded-full bg-[var(--hos-emerald)]" />
                Occ{" "}
                <span className="font-mono tabular-nums tracking-tight">{occPct}%</span>
              </button>
            </div>

            <label className="hos-search-field relative min-w-0 flex-1">
              <Search className="hos-search-icon size-3.5" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Guest, room, PS-, group, agent…  /"
                className="hos-search-input !h-8 !min-h-8 w-full !rounded-full !text-[12px]"
                aria-label="Search StayView"
              />
              {query ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--hos-ink-3)] hover:text-[var(--hos-ink)]"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>

            <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1">
              <MorphTabs
                glowId="stayviewHorizon"
                value={String(horizonDays) as "7" | "14" | "30"}
                onChange={(d) => setHorizonDays(Number(d) as 7 | 14 | 30)}
                items={[
                  { id: "7", label: "7D" },
                  { id: "14", label: "14D" },
                  { id: "30", label: "30D" },
                ]}
                className="!flex-nowrap !gap-0.5 !p-0.5"
              />
              <div className="relative">
                <Button
                  size="sm"
                  variant={calOpen ? "secondary" : "ghost"}
                  className="hos-btn-tactile !h-8 !min-h-8 shrink-0 gap-1 !px-2 text-xs"
                  aria-expanded={calOpen}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setCalYear(viewedMonth.year);
                    setCalOpen((v) => !v);
                  }}
                  title="Jump to any month"
                >
                  <CalendarDays className="size-3.5" />
                  <span className="hidden font-semibold sm:inline">
                    {monthStats.label}
                  </span>
                </Button>
                <AnimatePresence>
                  {calOpen ? (
                    <motion.div
                      role="dialog"
                      aria-label="Jump to month"
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: 4 }}
                      className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[min(280px,92vw)] rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3 shadow-[0_20px_48px_-16px_rgba(15,23,42,0.55)]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!h-7 !min-h-7 !px-1.5"
                          aria-label="Previous year"
                          onClick={() => setCalYear((y) => y - 1)}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--hos-ink)]">
                          {calYear}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!h-7 !min-h-7 !px-1.5"
                          aria-label="Next year"
                          onClick={() => setCalYear((y) => y + 1)}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = i + 1;
                          const active =
                            viewedMonth.year === calYear &&
                            viewedMonth.month === m;
                          const label = monthLabel(calYear, m).split(" ")[0]!;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => jumpToMonth(calYear, m)}
                              className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition ${
                                active
                                  ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                                  : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)] hover:border-[var(--hos-primary)]"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                        Or pick month
                        <input
                          type="month"
                          className="hos-input mt-1 w-full !min-h-8 !rounded-xl !text-xs"
                          value={`${viewedMonth.year}-${String(viewedMonth.month).padStart(2, "0")}`}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!/^\d{4}-\d{2}$/.test(v)) return;
                            const [y, m] = v.split("-").map(Number);
                            if (!y || !m) return;
                            jumpToMonth(y, m);
                          }}
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 w-full !h-7 text-xs"
                        onClick={() => setCalOpen(false)}
                      >
                        Close
                      </Button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="hos-btn-tactile !h-8 !min-h-8 shrink-0 !px-2.5 text-xs"
                onClick={() => setRackAnchorDate(today)}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="!h-8 !min-h-8 !px-1.5 text-xs"
                aria-label="Previous period"
                onClick={() => setRackAnchorDate(addDays(rackAnchorDate, -horizonDays))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="!h-8 !min-h-8 !px-1.5 text-xs"
                aria-label="Next period"
                onClick={() => setRackAnchorDate(addDays(rackAnchorDate, horizonDays))}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                size="sm"
                variant={filtersOpen ? "secondary" : "ghost"}
                className="!h-8 !min-h-8 shrink-0 gap-1 text-xs"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <SlidersHorizontal className="size-3.5" />
                {filtersActive ? "·" : null}
              </Button>
              {unassigned.length > 0 && canWriteStayview ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="hos-btn-tactile !h-8 !min-h-8 shrink-0 text-xs font-semibold"
                  onClick={() => {
                    setAttention("need_rooms");
                    setAssignMode({ kind: "queue" });
                  }}
                >
                  <Sparkles className="size-3.5" />
                  Assign {unassigned.length}
                </Button>
              ) : null}
              <Button
                size="sm"
                magnetic
                className="hos-btn-ink hos-btn-spring !h-8 !min-h-8 shrink-0 !rounded-full text-xs font-semibold"
                disabled={!canWriteStayview}
                onClick={() => {
                  if (!canWriteStayview) {
                    toast.error("No StayView write permission");
                    return;
                  }
                  openFastBook();
                }}
              >
                Book
                <kbd className="hos-keycap ml-1 hidden border-white/25 bg-white/12 text-white lg:inline">
                  ⌘B
                </kbd>
              </Button>
            </div>
          </div>

          {/* Monthly inventory · occ · revenue for the rack month */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-primary)_6%,var(--hos-cell))] px-2.5 py-1.5 text-[11px]">
            <span className="font-semibold text-[var(--hos-ink)]">
              {monthStats.label}
            </span>
            <span className="font-mono tabular-nums text-[var(--hos-ink-2)]">
              <span className="text-[var(--hos-ink-3)]">Rooms</span>{" "}
              <strong className="text-[var(--hos-ink)]">{monthStats.totalRooms}</strong>
            </span>
            <span className="font-mono tabular-nums text-[var(--hos-ink-2)]">
              <span className="text-[var(--hos-ink-3)]">Occ</span>{" "}
              <strong
                className={
                  monthStats.occPct >= 90
                    ? "text-[var(--hos-ruby)]"
                    : monthStats.occPct >= 70
                      ? "text-[var(--hos-brass-ink)]"
                      : "text-[var(--hos-emerald)]"
                }
              >
                {monthStats.occPct}%
              </strong>
              <span className="ml-1 text-[10px] text-[var(--hos-ink-3)]">
                ({monthStats.roomNightsSold}/{monthStats.roomNightsAvailable} RN)
              </span>
            </span>
            <span className="font-mono tabular-nums text-[var(--hos-ink-2)]">
              <span className="text-[var(--hos-ink-3)]">Rev</span>{" "}
              <strong className="text-[var(--hos-primary)]">
                {formatNu(monthStats.projectedRevenue)}
              </strong>
            </span>
            <span className="font-mono tabular-nums text-[var(--hos-ink-3)]">
              {monthStats.bookings} booking
              {monthStats.bookings === 1 ? "" : "s"}
            </span>
          </div>

          {apiOffline ? (
            <div className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--hos-ruby)_40%,transparent)] bg-[color-mix(in_srgb,var(--hos-ruby)_10%,transparent)] px-3 py-2 text-[11px] text-[var(--hos-ruby)]">
              API offline — money / assign mutations are blocked until hydrate succeeds
            </div>
          ) : null}
          {unsyncedStays.length > 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-[var(--hos-brass-ink)]">
              <ShieldAlert className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {unsyncedStays.length} stay
                {unsyncedStays.length === 1 ? "" : "s"} not synced to API — money
                actions blocked until ACK
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="!h-7 !min-h-7 shrink-0 gap-1 !px-2 text-[10px]"
                disabled={syncBusy || !canWriteStayview}
                onClick={() => {
                  setSyncBusy(true);
                  start(() => {
                    void (async () => {
                      let ok = 0;
                      let fail = 0;
                      for (const s of unsyncedStays) {
                        const res = await ensureStaySynced(s.id);
                        if (res.ok) ok += 1;
                        else fail += 1;
                      }
                      setSyncBusy(false);
                      if (fail === 0) toast.success(`Synced ${ok} stay${ok === 1 ? "" : "s"}`);
                      else toast.error(`Synced ${ok}, failed ${fail}`);
                    })();
                  });
                }}
              >
                <RefreshCw className={`size-3 ${syncBusy ? "animate-spin" : ""}`} />
                Sync now
              </Button>
            </div>
          ) : null}

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[var(--hos-ink-3)]">
              Do next
            </span>
            <StatusLegend items={rackLegend} dense className="mr-1 hidden lg:flex" />
            {attentionChips.map((chip) => {
              if (chip.count === 0 && attention !== chip.id) return null;
              const active = attention === chip.id;
              return (
                <AttentionChip
                  key={chip.id}
                  label={chip.label}
                  count={chip.count}
                  active={active}
                  tone={chip.tone}
                  onClick={() => {
                    const next = active ? "all" : chip.id;
                    setAttention(next);
                    if (chip.id === "need_rooms" && next === "need_rooms") {
                      setQueueOpen(true);
                    }
                    if (chip.id === "dirty" && next === "dirty") {
                      setHkFilter("dirty");
                    }
                    if (next === "all") setHkFilter("all");
                    if (chip.id === "due" && next === "due" && attentionStats.dueStays[0]) {
                      openStay(attentionStats.dueStays[0]!.id);
                    }
                  }}
                />
              );
            })}
            {filtersActive ? (
              <button
                type="button"
                onClick={clearSmartFilters}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--hos-line)] px-2.5 py-1 text-[11px] font-medium text-[var(--hos-ink-2)] hover:text-[var(--hos-ink)]"
              >
                <X className="size-3" />
                Clear
              </button>
            ) : null}
            <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-[var(--hos-ink-3)] sm:inline">
              {filteredRooms.length}/{rooms.length} rooms
              {qNorm ? ` · “${query.trim()}”` : ""}
            </span>
          </div>

          {filtersOpen ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--hos-line)] pt-1.5">
              <select
                value={groupFilter}
                onChange={(e) =>
                  setGroupFilter(e.target.value === "all" ? "all" : e.target.value)
                }
                className="hos-input !min-h-8 !w-auto max-w-[160px] !rounded-full !px-2 !py-1 !text-xs"
                aria-label="Tour group filter"
              >
                <option value="all">All groups</option>
                {tourGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name.split(" ").slice(0, 3).join(" ")}
                  </option>
                ))}
              </select>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value as FloorFilter)}
                className="hos-input !min-h-8 !w-auto !rounded-full !px-2 !py-1 !text-xs"
                aria-label="Floor filter"
              >
                <option value="all">Floors</option>
                <option value="1">Floor 1</option>
                <option value="2">Floor 2</option>
                <option value="3">Floor 3</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="hos-input !min-h-8 !w-auto !rounded-full !px-2 !py-1 !text-xs"
                aria-label="Room type filter"
              >
                <option value="all">Types</option>
                <option value="deluxe_queen">Deluxe Queen</option>
                <option value="deluxe_king">Deluxe King</option>
                <option value="deluxe_twin">Deluxe Twin</option>
                <option value="suite">Pelbu Suite</option>
              </select>
              <select
                value={hkFilter}
                onChange={(e) => setHkFilter(e.target.value as HkFilter)}
                className="hos-input !min-h-8 !w-auto !rounded-full !px-2 !py-1 !text-xs"
                aria-label="HK status filter"
              >
                <option value="all">HK</option>
                <option value="clean">Clean</option>
                <option value="dirty">Dirty</option>
                <option value="ooo">OOO</option>
              </select>
              <Button
                size="sm"
                variant={queueOpen ? "secondary" : "ghost"}
                className="!h-8 !min-h-8 text-xs"
                onClick={() => setQueueOpen((v) => !v)}
              >
                Queue ({unassigned.length})
              </Button>
            </div>
          ) : null}
        </div>

        {selectedTourGroup ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: selectedTourGroup.color }}
            />
            <strong className="text-[12px] font-medium text-[var(--hos-ink)]">
              {selectedTourGroup.name}
            </strong>
            <span className="font-mono text-[11px] text-[var(--hos-ink-3)]">
              {selectedTourGroup.members.length} rooms · {formatNu(selectedTourGroup.masterBalance)} agency
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              {GROUP_MEALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!canWriteStayview}
                  onClick={() => {
                    if (!canWriteStayview) {
                      toast.error("No StayView write permission");
                      return;
                    }
                    void applyGroupMealPlan(selectedTourGroup.id, m).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else toast.success(`${m} on ${res.updated} rooms`);
                    });
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    selectedTourGroup.mealPlan === m
                      ? "bg-[var(--hos-primary)] text-white"
                      : "border border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                  }`}
                >
                  {m}
                </button>
              ))}
              <Button
                size="sm"
                variant="secondary"
                className="!h-7 !min-h-7 !rounded-full !px-2.5 text-[11px]"
                disabled={!canWriteStayview}
                onClick={() => {
                  if (!canWriteStayview) {
                    toast.error("No StayView write permission");
                    return;
                  }
                  void checkInGroup(selectedTourGroup.id).then((res) => {
                    if (!res.ok) toast.error(res.error);
                    else toast.success(`Checked in ${res.checkedIn}`);
                  });
                }}
              >
                Check in all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="!h-7 !min-h-7 !rounded-full !px-2.5 text-[11px]"
                onClick={() => navigate(`/groups?id=${selectedTourGroup.id}`)}
              >
                Groups
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="!h-7 !min-h-7 !rounded-full !px-2 text-[11px]"
                onClick={() => setGroupFilter("all")}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {paint ? (
          <div className="hos-glass-card shrink-0 px-3 py-1.5 text-[11px] font-semibold text-[var(--hos-primary)]">
            Paint-to-book ·{" "}
            <span className="font-mono tabular-nums">
              {paint.start.slice(5)} → {paint.end.slice(5)}
            </span>{" "}
            · release to open Fast Book
          </div>
        ) : null}

        {filteredRooms.length === 0 ? (
          <div className="hos-cell flex flex-1 flex-col items-center justify-center gap-3 rounded-xl p-8 text-center">
            <p className="m-0 text-sm font-medium text-[var(--hos-ink)]">
              Nothing matches this view
            </p>
            <p className="m-0 max-w-sm text-[12px] text-[var(--hos-ink-3)]">
              Clear search / attention chips, or jump to Fast Book for a walk-in.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={clearSmartFilters}>
                Clear filters
              </Button>
              <Button size="sm" className="hos-btn-ink" onClick={() => openFastBook()}>
                Fast Book
              </Button>
            </div>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className={`hos-cell hos-scrollbar-slim min-h-0 flex-1 overflow-auto rounded-xl ${
            filteredRooms.length === 0 ? "hidden" : "block"
          }`}
        >
          <div style={{ width: LABEL_W + dates.length * CELL_W, minWidth: "100%" }}>
            {/* Date headers */}
            <div className="sticky top-0 z-[4] flex border-b border-[var(--hos-line)] bg-[var(--hos-cell)]">
              <div
                className="sticky left-0 z-[5] border-r border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]"
                style={{ width: LABEL_W }}
              >
                Room
              </div>
              {dates.map((d) => {
                const isToday = d === today;
                const weekend = isWeekend(d);
                return (
                  <div
                    key={d}
                    className={[
                      "border-r border-[var(--hos-line)] px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150",
                      "hover:bg-[rgba(37,99,235,0.1)] hover:text-[var(--hos-primary)]",
                      weekend ? "bg-[rgba(15,23,42,0.05)] dark:bg-[rgba(255,255,255,0.04)]" : "",
                      isToday
                        ? "bg-[rgba(59,130,246,0.14)] text-[var(--hos-primary)]"
                        : "text-[var(--hos-ink-3)]",
                    ].join(" ")}
                    style={{ width: CELL_W }}
                  >
                    {d.slice(5)}
                    {weekend ? (
                      <div className="text-[8px] font-bold opacity-70">WE</div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Sticky daily occupancy / yield strip */}
            <div
              className="sticky z-[3] flex border-b border-[var(--hos-line)] bg-[var(--hos-cell)]"
              style={{ top: 36, height: OCC_ROW_H }}
            >
              <div
                className="sticky left-0 z-[5] flex items-center border-r border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 text-[9px] font-bold uppercase tracking-wide text-[var(--hos-ink-3)]"
                style={{ width: LABEL_W }}
              >
                Daily yield
              </div>
              {dayStats.map((stat) => {
                const isToday = stat.date === today;
                const weekend = isWeekend(stat.date);
                return (
                  <button
                    key={stat.date}
                    type="button"
                    title={`${stat.date} · ${stat.sold}/${stat.sellable} sold · jump rack here`}
                    onClick={() => setRackAnchorDate(stat.date)}
                    className={[
                      "flex flex-col items-center justify-center gap-0.5 border-r border-[var(--hos-line)] px-0.5 transition-colors",
                      "hover:bg-[rgba(37,99,235,0.1)]",
                      weekend ? "bg-[rgba(15,23,42,0.04)] dark:bg-[rgba(255,255,255,0.03)]" : "",
                      isToday
                        ? "bg-[rgba(59,130,246,0.12)] shadow-[inset_0_0_18px_-6px_rgba(59,130,246,0.5)]"
                        : "",
                    ].join(" ")}
                    style={{ width: CELL_W }}
                  >
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] tabular-nums tracking-tight ${occTone(stat.pct)}`}
                    >
                      {stat.pct >= 90 ? `${stat.pct}% SO` : `${stat.pct}%`}
                    </span>
                    <span className="font-mono text-[8px] font-semibold tabular-nums text-[var(--hos-ink-3)]">
                      {stat.vacant === 0 ? "Full" : `${stat.vacant} left`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const row = flatRows[vRow.index]!;
                if (row.kind === "floor") {
                  return (
                    <div
                      key={`floor-${row.floor}`}
                      className="absolute left-0 flex items-center bg-[rgba(37,99,235,0.05)] px-3 text-xs font-bold text-[var(--hos-ink-2)]"
                      style={{
                        top: vRow.start,
                        height: vRow.size,
                        width: LABEL_W + dates.length * CELL_W,
                      }}
                    >
                      Floor {row.floor}
                    </div>
                  );
                }

                const room = row.room!;
                const ribbons = ribbonsForRoom(room);

                return (
                  <div
                    key={room.id}
                    className="absolute left-0 flex"
                    style={{
                      top: vRow.start,
                      height: vRow.size,
                      width: LABEL_W + dates.length * CELL_W,
                    }}
                  >
                    <RoomLabelCell
                      room={room}
                      onAssignClick={() => {
                        if (!canWriteStayview) {
                          toast.error("No StayView write permission");
                          return;
                        }
                        if (room.hkStatus === "ooo") {
                          toast.error("Out of order — cannot assign", {
                            action: {
                              label: "Block more",
                              onClick: () => {
                                setBlockReason("Maintenance");
                                setBlockPrompt({
                                  roomId: room.id,
                                  roomNumber: room.number,
                                });
                              },
                            },
                          });
                          return;
                        }
                        if (room.hkStatus === "dirty") {
                          toast.error("Room is dirty", {
                            description: "Inspect, or assign with manager PIN.",
                            action: {
                              label: "Mark inspected",
                              onClick: () => {
                                const res = setRoomHkStatus(room.id, "inspected");
                                if (!res.ok) toast.error(res.error);
                                else toast.success(`Rm ${room.number} inspected`);
                              },
                            },
                          });
                          if (unassigned.length > 0) {
                            setAssignMode({ kind: "room", roomId: room.id, date: today });
                          }
                          return;
                        }
                        if (unassigned.length === 0) {
                          openFastBook({
                            checkIn: today,
                            checkOut: addDays(today, 1),
                            typeCode: room.typeCode as RoomTypeCode,
                            roomId: room.id,
                          });
                          return;
                        }
                        setAssignMode({ kind: "room", roomId: room.id, date: today });
                      }}
                    />
                    <div className="relative flex">
                      {dates.map((d) => {
                        const block = blockOnDate(room.id, d);
                        return (
                        <EmptyCell
                          key={d}
                          roomId={room.id}
                          date={d}
                          typeCode={room.typeCode}
                          isTodayCol={d === today}
                          weekend={isWeekend(d)}
                          blocked={Boolean(block) || room.hkStatus === "ooo"}
                          blockLabel={
                            block
                              ? `${block.blockKind.toUpperCase()} · ${block.reason}`
                              : room.hkStatus === "ooo"
                                ? "OOO"
                                : undefined
                          }
                          painting={Boolean(
                            paint &&
                              paint.roomId === room.id &&
                              d >=
                                (paint.start <= paint.end ? paint.start : paint.end) &&
                              d <=
                                (paint.start <= paint.end ? paint.end : paint.start),
                          )}
                          onPaintStart={() => {
                            if (block) {
                              toast.message(
                                `Blocked · ${block.blockKind.toUpperCase()}`,
                                {
                                  description: block.reason,
                                  action: canWriteStayview
                                    ? {
                                        label: "Release",
                                        onClick: () => {
                                          void releaseRoomBlock(block.id).then(
                                            (res) => {
                                              if (!res.ok) toast.error(res.error);
                                              else
                                                toast.success(
                                                  `Rm ${room.number} unblocked`,
                                                );
                                            },
                                          );
                                        },
                                      }
                                    : undefined,
                                },
                              );
                              return;
                            }
                            if (!canWriteStayview) {
                              toast.error("No StayView write permission");
                              return;
                            }
                            if (room.hkStatus === "ooo") {
                              toast.error("Out of order — cannot book");
                              return;
                            }
                            setPaint({
                              roomId: room.id,
                              typeCode: room.typeCode,
                              start: d,
                              end: d,
                            });
                          }}
                          onPaintEnter={() => {
                            setPaint((p) =>
                              p && p.roomId === room.id ? { ...p, end: d } : p,
                            );
                          }}
                        />
                        );
                      })}
                      {ribbons.map(({ stay, startIdx, span }) => {
                        const hit = qNorm ? stayMatchesQuery(stay, qNorm) : false;
                        return (
                        <StayRibbon
                          key={stay.id}
                          stay={stay}
                          startIdx={startIdx}
                          span={span}
                          groupPax={
                            stay.groupName ? (groupPaxMap.get(stay.groupName) ?? 0) : 0
                          }
                          today={today}
                          highlight={hit}
                          dimmed={Boolean(qNorm) && !hit}
                          onOpen={() => openStay(stay.id)}
                          onHover={(e) =>
                            setHoverStay({ stay, x: e.clientX, y: e.clientY })
                          }
                          onLeave={() => setHoverStay(null)}
                        />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Collapsible unassigned queue shelf */}
        <AnimatePresence>
          {queueOpen ? (
            <motion.aside
              initial={reduce ? false : { x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? undefined : { x: 28, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="fixed bottom-24 right-4 top-20 z-[45] flex w-[min(340px,92vw)] flex-col"
            >
              <GlassElevated className="hos-glass-card flex h-full flex-col overflow-hidden p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <strong className="text-sm text-[var(--hos-ink)]">
                    Unassigned queue
                  </strong>
                  <Button size="sm" variant="ghost" onClick={() => setQueueOpen(false)}>
                    Close
                  </Button>
                </div>
                <p className="m-0 mb-2 text-[11px] text-[var(--hos-ink-3)]">
                  ⚡ Smart assign, drag onto a room row, or tap a room label.
                </p>
                {unassigned.length > 0 ? (
                  <Button
                    size="sm"
                    className="hos-btn-ink mb-2 w-full !rounded-full"
                    onClick={() => {
                      void smartAutoAssign(unassigned.map((s) => s.id)).then((res) => {
                        if (res.assigned === 0 && res.conflicts.length) {
                          toast.error("Smart assign blocked", {
                            description: res.conflicts.slice(0, 2).join(" · "),
                          });
                          return;
                        }
                        toast.success(`⚡ Assigned ${res.assigned}`, {
                          description:
                            res.conflicts.length > 0
                              ? `${res.conflicts.length} still need a room`
                              : "VIP · group cluster · gap fill",
                        });
                        setQueueOpen(false);
                      });
                    }}
                  >
                    ⚡ Smart-assign all ({unassigned.length})
                  </Button>
                ) : null}
                <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-0.5">
                  {unassigned.length === 0 ? (
                    <p className="m-0 text-xs text-[var(--hos-ink-3)]">
                      All near-term bookings have rooms.
                    </p>
                  ) : (
                    unassigned.map((s) => (
                      <UnassignedChip
                        key={s.id}
                        stay={s}
                        onOpen={() => openStay(s.id)}
                        onSmartAssign={() =>
                          setAssignMode({ kind: "stay", stayId: s.id })
                        }
                      />
                    ))
                  )}
                </div>
              </GlassElevated>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {hoverStay && !activeDrag ? (
          <StayHoverDossier
            stay={hoverStay.stay}
            x={hoverStay.x}
            y={hoverStay.y}
            today={today}
            rateCardLabel={(() => {
              const agency = hoverStay.stay.agencyName;
              if (!agency) return "PUBLIC";
              const ag = agents.find(
                (a) =>
                  agency.includes(a.name.split(" ")[0] ?? "") ||
                  a.name.includes(agency.split(" ")[0] ?? ""),
              );
              return rateCardById(rateCards, ag?.rateCardId)?.code ?? "AGENT";
            })()}
            onSaveNote={(notes) => {
              void setStayNotes(hoverStay.stay.id, notes).then((res) => {
                if (!res.ok) toast.error(res.error);
                else toast.success("Note saved");
              });
            }}
            onCheckIn={() => {
              if (!canWriteStayview) {
                toast.error("No StayView write permission");
                return;
              }
              const stayId = hoverStay.stay.id;
              const roomNumber = hoverStay.stay.roomNumber;
              setHoverStay(null);
              void (async () => {
                const res = await checkIn(stayId);
                if (!res.ok) toast.error(res.error);
                else toast.success(`Checked in · Rm ${roomNumber}`);
              })();
            }}
            onStayHub={() => {
              openStay(hoverStay.stay.id);
              setHoverStay(null);
            }}
            onShift={() => {
              openStay(hoverStay.stay.id);
              toast.message("Open StayHub · Room & Rate for shift");
              setHoverStay(null);
            }}
          />
        ) : null}
      </AnimatePresence>

      <DragOverlay>
        {activeDrag ? (
          <div className="hos-glass rounded-lg px-3 py-2 text-sm font-semibold text-[var(--hos-primary)] shadow-[var(--hos-primary-glow)]">
            {activeDrag.label}
          </div>
        ) : null}
      </DragOverlay>

      <SmartAssignSheet
        open={Boolean(assignMode)}
        mode={assignMode}
        queue={unassigned}
        onClose={() => setAssignMode(null)}
      />

      <AnimatePresence>
        {moveModal ? (
          <motion.div
            className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(9,13,22,0.45)] p-4"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="hos-glass w-[min(400px,100%)] rounded-2xl p-5"
              initial={reduce ? false : { y: 12, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
            >
              <h3 className="m-0 text-base font-bold text-[var(--hos-ink)]">
                Room move reason
              </h3>
              <p className="mt-1 text-xs text-[var(--hos-ink-3)]">
                Required for audit trail — server records reason with inventory move.
              </p>
              <div className="mt-4 grid gap-2">
                {(
                  [
                    ["guest_request", "Guest request / noise"],
                    ["upgrade", "Complimentary upgrade"],
                    ["maintenance", "Maintenance"],
                    ["operations", "Operations"],
                  ] as const
                ).map(([id, label]) => (
                  <motion.button
                    key={id}
                    type="button"
                    whileTap={reduce ? undefined : { scale: 0.97 }}
                    className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--hos-ink)] hover:border-[var(--hos-primary)]"
                    onClick={() => {
                      void moveRoom({
                        stayId: moveModal.stayId,
                        toRoomId: moveModal.toRoomId,
                        reason: id,
                      }).then((res) => {
                        if (!res.ok) {
                          if (res.code === "DIRTY_PIN_REQUIRED") {
                            setDirtyPin("");
                            setDirtyPinPrompt({
                              stayId: moveModal.stayId,
                              roomId: moveModal.toRoomId,
                              mode: "move",
                              moveReason: id,
                            });
                            return;
                          }
                          toast.error(res.error);
                          return;
                        }
                        toast.success(`Moved · ${label}`);
                      });
                    }}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
              <Button
                className="mt-3"
                variant="ghost"
                size="sm"
                onClick={() => setMoveModal(null)}
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dirtyPinPrompt ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(9,13,22,0.5)] p-4"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="hos-glass w-[min(360px,100%)] rounded-2xl p-5"
              initial={reduce ? false : { y: 10, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
            >
              <h3 className="m-0 text-base font-bold text-[var(--hos-ink)]">
                Dirty room · manager PIN
              </h3>
              <p className="mt-1 text-xs text-[var(--hos-ink-3)]">
                Override housekeeping status to assign / move into a dirty room.
              </p>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={dirtyPin}
                onChange={(e) => setDirtyPin(e.target.value)}
                placeholder="4–8 digit PIN"
                className="hos-input mt-3 w-full !rounded-xl"
                data-testid="stayview-dirty-pin"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="hos-btn-ink"
                  onClick={() => {
                    const prompt = dirtyPinPrompt;
                    start(() => {
                      void (async () => {
                        const res =
                          prompt.mode === "move" && prompt.moveReason
                            ? await moveRoom({
                                stayId: prompt.stayId,
                                toRoomId: prompt.roomId,
                                reason: prompt.moveReason,
                                dirtyOverridePin: dirtyPin,
                              })
                            : await tryAssign(prompt.stayId, prompt.roomId, {
                                allowUpgrade: prompt.mode === "upgrade",
                                moveReason: prompt.moveReason,
                                dirtyOverridePin: dirtyPin,
                              });
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success(
                          prompt.mode === "move"
                            ? "Moved with dirty override"
                            : "Assigned with dirty override",
                        );
                        setDirtyPinPrompt(null);
                        setDirtyPin("");
                        setQueueOpen(false);
                      })();
                    });
                  }}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDirtyPinPrompt(null);
                    setDirtyPin("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {blockPrompt ? (
          <motion.div
            className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(9,13,22,0.45)] p-4"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="hos-glass w-[min(400px,100%)] rounded-2xl p-5"
              initial={reduce ? false : { y: 12, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              role="dialog"
              aria-modal
              aria-label="Block room reason"
            >
              <h3 className="m-0 text-base font-bold text-[var(--hos-ink)]">
                Block Rm {blockPrompt.roomNumber}
              </h3>
              <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                Reason is required for OOO / maintenance blocks.
              </p>
              <input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                data-testid="stayview-block-reason"
                className="mt-3 w-full rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 text-[13px] text-[var(--hos-ink)]"
                placeholder="Maintenance"
                autoFocus
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBlockPrompt(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="hos-btn-ink"
                  onClick={() => {
                    const reason = blockReason.trim();
                    if (!reason) {
                      toast.error("Enter a block reason");
                      return;
                    }
                    const roomId = blockPrompt.roomId;
                    const roomNumber = blockPrompt.roomNumber;
                    setBlockPrompt(null);
                    void blockRoom({
                      roomId,
                      fromDate: today,
                      toDate: addDays(today, 1),
                      reason,
                    }).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else toast.success(`Rm ${roomNumber} blocked`);
                    });
                  }}
                >
                  Block
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DndContext>
  );
}
