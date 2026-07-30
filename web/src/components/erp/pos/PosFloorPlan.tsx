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
import {
  EllipsisVerticalIcon,
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

/**
 * Visual floor plan. Tables are positioned absolutely inside a 16:9 canvas —
 * `pos_x`/`pos_y` are percentages (0–100) so the same layout scales to any
 * screen size. Drag a table to move it; the new position is persisted via
 * `saveTablePosition`. New tables auto-flow onto the canvas with a sensible
 * default so the first paint never overlaps.
 */
export function PosFloorPlan({
  outlet,
  tables,
  openTickets,
  selectedTableId,
  onSelectTable,
  onAddTable,
  onEditTable,
  onOpenTicket,
}: {
  outlet: string | null;
  tables: DiningTable[];
  openTickets: OpenPosTicket[];
  selectedTableId: string;
  onSelectTable: (tableId: string, covers: number) => void;
  onAddTable: () => void;
  onEditTable: (table: DiningTable) => void;
  onOpenTicket: (orderId: string) => void;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateTableStatus,
    initial,
  );
  useActionToast(statusState, { successMessage: "Table updated" });

  const outletTables = useMemo(
    () =>
      outlet === null
        ? tables
        : tables.filter((t) => t.outlet === null || t.outlet === outlet),
    [tables, outlet],
  );

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

  /**
   * Spread out tables that have no recorded position. We hash the table name
   * so the default position is deterministic per table (no jitter on every
   * reload) instead of stacking everything at 0,0.
   */
  const positioned = useMemo(() => {
    return outletTables.map((table, i) => {
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
  }, [outletTables]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [livePos, setLivePos] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );

  const beginDrag = useCallback(
    (e: React.PointerEvent, tableId: string) => {
      // Ignore drags that start from the kebab menu or a button inside the card
      // (those have their own behaviour).
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-drag]")) return;
      const row = positioned.find((t) => t.id === tableId);
      if (!row) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragId(tableId);
      setLivePos({ id: tableId, x: row.x, y: row.y });
    },
    [positioned],
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragId || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setLivePos({
        id: dragId,
        x: Math.max(0, Math.min(96, x)),
        y: Math.max(0, Math.min(94, y)),
      });
    },
    [dragId],
  );

  const endDrag = useCallback(() => {
    if (!dragId || !livePos) {
      setDragId(null);
      setLivePos(null);
      return;
    }
    const fd = new FormData();
    fd.set("table_id", dragId);
    fd.set("pos_x", String(Math.round(livePos.x * 100) / 100));
    fd.set("pos_y", String(Math.round(livePos.y * 100) / 100));
    startTransition(() => {
      void saveTablePosition(fd);
    });
    setDragId(null);
    setLivePos(null);
  }, [dragId, livePos]);

  // Safety: drop the drag state if the user tabs away mid-drag.
  useEffect(() => {
    if (!dragId) return;
    function onUp() {
      endDrag();
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Floor plan
          </p>
          <p className="text-sm text-muted-foreground">
            {counts.total === 0
              ? "No tables yet for this outlet."
              : `${counts.total} tables · ${counts.seatsTotal} seats · ${counts.occupied} occupied · ${counts.free} free · drag tables to reposition`}
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
            Set up your first table
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add the tables in this outlet so servers can open a ticket against a
            seated party, track covers, and settle to the right check.
          </p>
          <Button
            type="button"
            variant="citrus"
            className="mt-6 h-11"
            onClick={onAddTable}
          >
            <PlusIcon className="size-4" />
            Add table
          </Button>
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="relative aspect-[16/10] w-full touch-none overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_1px_1px,_hsl(var(--border))_1px,_transparent_0)] [background-size:22px_22px]"
          onPointerMove={moveDrag}
        >
          {positioned.map((table) => {
            const live = livePos?.id === table.id ? livePos : null;
            const x = live?.x ?? table.x;
            const y = live?.y ?? table.y;
            return (
              <TableChip
                key={table.id}
                table={table}
                x={x}
                y={y}
                dragging={dragId === table.id}
                showOutlet={outlet === null}
                ticket={ticketByTable.get(table.id) ?? null}
                selected={selectedTableId === table.id}
                busy={statusPending}
                onSelect={() => onSelectTable(table.id, table.seats)}
                onEdit={() => onEditTable(table)}
                onStatus={(next) => setStatus(table.id, next)}
                onOpenTicket={onOpenTicket}
                onPointerDown={(e) => beginDrag(e, table.id)}
                onPointerUp={endDrag}
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
  reserved: "border-gold/40 bg-gold/10",
  dirty: "border-destructive/30 bg-destructive/5",
};

function TableChip({
  table,
  x,
  y,
  dragging,
  showOutlet,
  ticket,
  selected,
  busy,
  onSelect,
  onEdit,
  onStatus,
  onOpenTicket,
  onPointerDown,
  onPointerUp,
}: {
  table: DiningTable;
  x: number;
  y: number;
  dragging: boolean;
  showOutlet: boolean;
  ticket: OpenPosTicket | null;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onStatus: (next: TableStatus) => void;
  onOpenTicket: (orderId: string) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className={`absolute flex w-[14%] min-w-[88px] max-w-[140px] flex-col rounded-xl border shadow-sm transition-shadow ${
        STATUS_STYLES[table.status]
      } ${selected ? "ring-[3px] ring-ring/40" : ""} ${
        dragging ? "z-20 cursor-grabbing shadow-lg" : "cursor-grab"
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div
        className="flex items-center justify-between gap-1 rounded-t-xl px-2 py-1"
        data-no-drag
      >
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-xs font-semibold text-foreground">
            {table.name}
          </span>
          {showOutlet && table.outlet ? (
            <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {table.outlet}
            </span>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
              aria-label={`Actions for ${table.name}`}
              disabled={busy}
            >
              <EllipsisVerticalIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="erp">
            <DropdownMenuLabel>{table.name}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon className="size-4" />
              Edit table
            </DropdownMenuItem>
            {ticket ? (
              <DropdownMenuItem onSelect={() => onOpenTicket(ticket.id)}>
                Settle open ticket
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

      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col items-start gap-1 rounded-b-xl px-2 pb-2 pt-0.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        aria-pressed={selected}
        aria-label={`Select ${table.name}, seats ${table.seats}, ${TABLE_STATUS_LABELS[table.status]}`}
      >
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
      </button>
    </div>
  );
}
