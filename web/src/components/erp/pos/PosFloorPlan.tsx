"use client";

import {
  saveTablePosition,
  updateTableStatus,
  type PosActionState,
} from "@/app/actions/erp-pos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActionToast } from "@/hooks/use-action-toast";
import type { DiningTable, OpenPosTicket } from "@/lib/pos";
import {
  TABLE_STATUS_LABELS,
  TABLE_STATUS_VALUES,
  type TableStatus,
} from "@/lib/pos-tables";
import { cn } from "@/lib/utils";
import {
  EllipsisVerticalIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import {
  startTransition,
  useCallback,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const initial: PosActionState = { ok: false };

/** Floor positions are percent of the canvas; snap so tables sit on the dots. */
const GRID_PCT = 5;

function snapPct(n: number, max: number): number {
  const snapped = Math.round(n / GRID_PCT) * GRID_PCT;
  return Math.max(0, Math.min(max, snapped));
}

/** `null` = Shared (no outlet) · string = property outlet code. */
export type FloorKey = string | null;

/**
 * Visual floor plan — one outlet floor at a time (Restaurant, Cafe, Bar…).
 * Staff create/edit tables per floor; drag to reposition on the canvas.
 */
export function PosFloorPlan({
  floor,
  onFloorChange,
  outlets,
  tables,
  openTickets,
  selectedTableId,
  onSelectTable,
  onAddTable,
  onEditTable,
  onOpenTicket,
  onAddItems,
}: {
  floor: FloorKey;
  onFloorChange: (floor: FloorKey) => void;
  outlets: { value: string; label: string }[];
  tables: DiningTable[];
  openTickets: OpenPosTicket[];
  selectedTableId: string;
  onSelectTable: (tableId: string, covers: number) => void;
  onAddTable: () => void;
  onEditTable: (table: DiningTable) => void;
  onOpenTicket: (orderId: string) => void;
  onAddItems?: (orderId: string) => void;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateTableStatus,
    initial,
  );
  useActionToast(statusState, { successMessage: "Table updated" });

  const floorTabs = useMemo(() => {
    const tabs = outlets.map((o) => ({
      key: o.value as FloorKey,
      label: o.label,
      count: tables.filter((t) => t.outlet === o.value).length,
      free: tables.filter((t) => t.outlet === o.value && t.status === "free")
        .length,
    }));
    tabs.push({
      key: null,
      label: "Shared",
      count: tables.filter((t) => t.outlet == null).length,
      free: tables.filter((t) => t.outlet == null && t.status === "free")
        .length,
    });
    return tabs;
  }, [outlets, tables]);

  useEffect(() => {
    if (floor === null) return;
    if (outlets.some((o) => o.value === floor)) return;
    onFloorChange(outlets[0]?.value ?? null);
  }, [floor, outlets, onFloorChange]);

  const outletTables = useMemo(
    () =>
      floor === null
        ? tables.filter((t) => t.outlet == null)
        : tables.filter((t) => t.outlet === floor),
    [tables, floor],
  );

  const floorLabel =
    floor === null
      ? "Shared"
      : (outlets.find((o) => o.value === floor)?.label ?? floor);

  const ticketByTable = useMemo(() => {
    const map = new Map<string, OpenPosTicket>();
    for (const ticket of openTickets) {
      if (ticket.table_id && !map.has(ticket.table_id)) {
        map.set(ticket.table_id, ticket);
      }
    }
    return map;
  }, [openTickets]);

  const counts = useMemo(() => {
    const seatsTotal = outletTables.reduce((s, t) => s + t.seats, 0);
    return {
      total: outletTables.length,
      occupied: outletTables.filter((t) => t.status === "occupied").length,
      free: outletTables.filter((t) => t.status === "free").length,
      seatsTotal,
    };
  }, [outletTables]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Optimistic positions keyed by table id. When a drag ends we record the
  // dropped spot here so the chip stays put through the re-render that happens
  // before the server action revalidates props (otherwise it snaps back to the
  // old position for a beat, then jumps). Cleared per-table once incoming props
  // match the optimistic value (server confirmed).
  const [optimistic, setOptimistic] = useState<
    Record<string, { x: number; y: number }>
  >({});

  /**
   * Spread out tables that have no recorded position. We hash the table name
   * so the default position is deterministic per table (no jitter on every
   * reload) instead of stacking everything at 0,0.
   */
  const positioned = useMemo(() => {
    return outletTables.map((table, i) => {
      const opt = optimistic[table.id];
      if (opt) {
        return { ...table, x: opt.x, y: opt.y };
      }
      if (table.pos_x != null && table.pos_y != null) {
        return { ...table, x: table.pos_x, y: table.pos_y };
      }
      const col = i % 5;
      const row = Math.floor(i / 5);
      return {
        ...table,
        x: 12 + col * 19 + ((row % 2) * 6),
        y: 18 + row * 24,
      };
    });
  }, [outletTables, optimistic]);

  // Drop optimistic overrides that the server has now confirmed, so a later
  // real reposition from elsewhere isn't masked by a stale local value.
  useEffect(() => {
    setOptimistic((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next: Record<string, { x: number; y: number }> = {};
      for (const table of outletTables) {
        const opt = prev[table.id];
        if (!opt) continue;
        const confirmed =
          table.pos_x != null &&
          table.pos_y != null &&
          Math.abs(table.pos_x - opt.x) < 0.5 &&
          Math.abs(table.pos_y - opt.y) < 0.5;
        if (confirmed) {
          changed = true;
        } else {
          next[table.id] = opt;
        }
      }
      return changed ? next : prev;
    });
  }, [outletTables]);

  // Live position is held in a ref. During the drag we write a compositor
  // translate3d (pixels) — never React state and never left/top — so the chip
  // tracks the finger without reconciling the rest of the floor.
  const livePosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const draggedNodeRef = useRef<HTMLDivElement | null>(null);
  const downRef = useRef<{
    x: number;
    y: number;
    startLeft: number;
    startTop: number;
    rectW: number;
    rectH: number;
  } | null>(null);
  const movedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingPxRef = useRef<{ dx: number; dy: number } | null>(null);

  const flushDragTransform = useCallback(() => {
    rafRef.current = null;
    const node = draggedNodeRef.current;
    const px = pendingPxRef.current;
    if (!node || !px) return;
    node.style.transform = `translate3d(${px.dx}px, ${px.dy}px, 0)`;
  }, []);

  const beginDrag = useCallback(
    (e: React.PointerEvent, tableId: string, node: HTMLDivElement) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-drag-handle]")) return;
      if (!canvasRef.current) return;
      const row = positioned.find((t) => t.id === tableId);
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const rect = canvasRef.current.getBoundingClientRect();
      downRef.current = {
        x: e.clientX,
        y: e.clientY,
        startLeft: row.x,
        startTop: row.y,
        rectW: rect.width,
        rectH: rect.height,
      };
      movedRef.current = false;
      draggedNodeRef.current = node;
      livePosRef.current = { id: tableId, x: row.x, y: row.y };
      setDragId(tableId);
      node.style.willChange = "transform";
    },
    [positioned],
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent) => {
      const origin = downRef.current;
      const id = livePosRef.current?.id;
      if (!origin || !id) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (!movedRef.current && dx * dx + dy * dy > 16) movedRef.current = true;
      if (!movedRef.current) return;
      livePosRef.current = {
        id,
        x: Math.max(0, Math.min(95, origin.startLeft + (dx / origin.rectW) * 100)),
        y: Math.max(0, Math.min(90, origin.startTop + (dy / origin.rectH) * 100)),
      };
      pendingPxRef.current = { dx, dy };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushDragTransform);
      }
    },
    [flushDragTransform],
  );

  const endDrag = useCallback((tableId: string) => {
    const node = draggedNodeRef.current;
    const pos = livePosRef.current;
    const pressStarted = downRef.current != null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (node) {
      node.style.willChange = "auto";
      node.style.transform = "";
    }

    if (!pressStarted) {
      downRef.current = null;
      movedRef.current = false;
      draggedNodeRef.current = null;
      livePosRef.current = null;
      pendingPxRef.current = null;
      setDragId(null);
      return;
    }

    if (!movedRef.current) {
      downRef.current = null;
      movedRef.current = false;
      draggedNodeRef.current = null;
      livePosRef.current = null;
      pendingPxRef.current = null;
      setDragId(null);
      return;
    }

    if (pos) {
      const x = snapPct(pos.x, 95);
      const y = snapPct(pos.y, 90);
      setOptimistic((prev) => ({ ...prev, [tableId]: { x, y } }));
      const fd = new FormData();
      fd.set("table_id", tableId);
      fd.set("pos_x", String(x));
      fd.set("pos_y", String(y));
      startTransition(() => {
        void saveTablePosition(fd);
      });
    }
    downRef.current = null;
    movedRef.current = false;
    draggedNodeRef.current = null;
    livePosRef.current = null;
    pendingPxRef.current = null;
    setDragId(null);
  }, []);

  // pointerup may land on window if capture is lost; persist via endDrag.
  useEffect(() => {
    if (!dragId) return;
    const id = dragId;
    function onUp() {
      endDrag(id);
    }
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId, endDrag]);

  function setStatus(tableId: string, next: TableStatus) {
    const fd = new FormData();
    fd.set("table_id", tableId);
    fd.set("status", next);
    startTransition(() => statusAction(fd));
  }

  return (
    <div className="space-y-3">
      <nav aria-label="Floors" className="flex flex-wrap items-center gap-1.5">
        {floorTabs.map((tab) => {
          const active = tab.key === floor;
          return (
            <button
              key={tab.key ?? "__shared__"}
              type="button"
              onClick={() => onFloorChange(tab.key)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                active
                  ? "border-accent/40 bg-accent text-accent-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular-nums text-[11px]",
                  active ? "opacity-90" : "text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
              {tab.free > 0 && !active ? (
                <span className="text-[10px] text-emerald-700">
                  · {tab.free} free
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {floorLabel} floor
          </p>
          <p className="text-sm text-muted-foreground">
            {counts.total === 0
              ? `No tables on ${floorLabel} yet — add one for this floor.`
              : `${counts.total} tables · ${counts.seatsTotal} seats · ${counts.occupied} occupied · ${counts.free} free · grip to move · tap to seat`}
          </p>
        </div>
        <Button
          type="button"
          variant="citrus"
          size="sm"
          className="h-10"
          onClick={onAddTable}
        >
          <PlusIcon className="size-4" />
          Add table
        </Button>
      </div>

      {counts.total === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Set up {floorLabel} tables
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create tables for this floor only. Cafe and restaurant keep separate
            layouts — switch floor tab, add tables, drag seats, edit anytime.
          </p>
          <Button
            type="button"
            variant="citrus"
            className="mt-6 h-11"
            onClick={onAddTable}
          >
            <PlusIcon className="size-4" />
            Add {floorLabel} table
          </Button>
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="relative aspect-[16/10] w-full touch-none overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_1px_1px,_hsl(var(--border))_1px,_transparent_0)] [background-size:22px_22px]"
        >
          {positioned.map((table) => {
            return (
              <TableChip
                key={table.id}
                table={table}
                x={table.x}
                y={table.y}
                dragging={dragId === table.id}
                ticket={ticketByTable.get(table.id) ?? null}
                selected={selectedTableId === table.id}
                busy={statusPending}
                onEdit={() => onEditTable(table)}
                onStatus={(next) => setStatus(table.id, next)}
                onOpenTicket={onOpenTicket}
                onAddItems={onAddItems}
                onSelect={() => onSelectTable(table.id, table.seats)}
                onPointerDown={(e, node) => beginDrag(e, table.id, node)}
                onPointerMove={moveDrag}
                onPointerUp={() => endDrag(table.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<TableStatus, string> = {
  free: "border-border bg-card hover:border-accent/50",
  occupied: "border-accent/40 bg-accent/10",
  ordered: "border-sky-500/40 bg-sky-500/10",
  billed: "border-amber-500/40 bg-amber-500/10",
  reserved: "border-gold/40 bg-gold/10",
  dirty: "border-destructive/30 bg-destructive/5",
};

function TableChip({
  table,
  x,
  y,
  dragging,
  ticket,
  selected,
  busy,
  onEdit,
  onStatus,
  onOpenTicket,
  onAddItems,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  table: DiningTable;
  x: number;
  y: number;
  dragging: boolean;
  ticket: OpenPosTicket | null;
  selected: boolean;
  busy: boolean;
  onEdit: () => void;
  onStatus: (next: TableStatus) => void;
  onOpenTicket: (orderId: string) => void;
  onAddItems?: (orderId: string) => void;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent, node: HTMLDivElement) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={rootRef}
      className={`absolute flex w-[14%] min-w-[88px] max-w-[140px] flex-col rounded-xl border shadow-sm ${
        STATUS_STYLES[table.status]
      } ${selected ? "ring-[3px] ring-ring/40" : ""} ${
        dragging ? "z-20 shadow-lg" : "cursor-pointer"
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${table.name}, seats ${table.seats}, ${TABLE_STATUS_LABELS[table.status]}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div
        className="flex items-center justify-between gap-1 rounded-t-xl px-2 py-1"
        data-no-drag
      >
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            data-drag-handle
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            aria-label={`Move ${table.name}`}
            title="Drag to move"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (rootRef.current) onPointerDown(e, rootRef.current);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => {
              e.stopPropagation();
              onPointerUp();
            }}
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
          <span className="truncate text-xs font-semibold text-foreground">
            {table.name}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
              aria-label={`Actions for ${table.name}`}
              disabled={busy}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              <EllipsisVerticalIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="erp z-[100]"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuLabel>{table.name}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon className="size-4" />
              Edit table
            </DropdownMenuItem>
            {ticket && onAddItems ? (
              <DropdownMenuItem onSelect={() => onAddItems(ticket.id)}>
                Add items
              </DropdownMenuItem>
            ) : null}
            {ticket ? (
              <DropdownMenuItem onSelect={() => onOpenTicket(ticket.id)}>
                Settle ticket
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
              Set status
            </DropdownMenuLabel>
            {TABLE_STATUS_VALUES.filter((s) => s !== table.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onStatus(s)}>
                {TABLE_STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col items-start gap-1 rounded-b-xl px-2 pb-2 pt-0.5 text-left">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <UsersIcon className="size-3" />
          {table.seats}
        </span>
        <Badge
          variant={
            table.status === "occupied"
              ? "default"
              : table.status === "reserved"
                ? "gold"
                : "secondary"
          }
          className="text-[9px]"
        >
          {TABLE_STATUS_LABELS[table.status]}
        </Badge>
        {ticket ? (
          <span className="text-[10px] tabular-nums text-foreground">
            {ticket.total_btn.toLocaleString("en-BT", {
              maximumFractionDigits: 2,
            })}{" "}
            Nu
          </span>
        ) : null}
      </div>
    </div>
  );
}
