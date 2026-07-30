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

  // Live position is held in a ref + applied directly to the dragged node via
  // transform; we never call setState during the drag. That keeps each pointer
  // move to a single DOM write on the compositor thread (no React reconciliation
  // for the whole floor plan on every frame), which is what makes the drag feel
  // instant instead of janky.
  const livePosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const draggedNodeRef = useRef<HTMLDivElement | null>(null);
  // Track the pointer-down origin + whether it actually moved past the drag
  // threshold. A pointer down→up without movement is a *click* (select the
  // table); movement past ~4px is a *drag* (reposition). Without this the
  // pointer capture in beginDrag swallows the inner button's onClick.
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  // rAF handle for the next compositor-frame flush of the dragged transform.
  const rafRef = useRef<number | null>(null);

  const flushDragTransform = useCallback(() => {
    rafRef.current = null;
    const node = draggedNodeRef.current;
    const pos = livePosRef.current;
    if (!node || !pos) return;
    // Direct DOM write on the dragged node only. Bypassing React state here
    // means no reconciliation of the floor plan on every pointermove — only
    // this single node repaints, on the compositor frame.
    node.style.left = `${pos.x}%`;
    node.style.top = `${pos.y}%`;
  }, []);

  const beginDrag = useCallback(
    (e: React.PointerEvent, tableId: string, node: HTMLDivElement) => {
      // Ignore interactions that start from the kebab menu or a button inside
      // the card (those have their own behaviour and must not start a drag).
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-drag]")) return;
      const row = positioned.find((t) => t.id === tableId);
      if (!row) return;
      // Capture so we get the pointermove/up even if the cursor leaves the
      // card, but do NOT preventDefault — that's what killed the click.
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      downRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
      draggedNodeRef.current = node;
      livePosRef.current = { id: tableId, x: row.x, y: row.y };
      setDragId(tableId);
      // Promote the dragged node to its own compositor layer so transforms
      // don't trigger paint of the surrounding canvas.
      node.style.willChange = "left, top";
    },
    [positioned],
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent) => {
      const id = livePosRef.current?.id;
      if (!id || !canvasRef.current) return;
      // Mark as moved once the pointer travels past a small threshold so a
      // tiny jitter on click doesn't get mistaken for a drag.
      if (downRef.current && !movedRef.current) {
        const dx = e.clientX - downRef.current.x;
        const dy = e.clientY - downRef.current.y;
        if (dx * dx + dy * dy > 16) movedRef.current = true;
      }
      if (!movedRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      livePosRef.current = {
        id,
        x: Math.max(0, Math.min(96, x)),
        y: Math.max(0, Math.min(94, y)),
      };
      // Coalesce to one DOM write per animation frame.
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushDragTransform);
      }
    },
    [flushDragTransform],
  );

  const endDrag = useCallback(
    (tableId: string, covers: number) => {
      // Click (no movement) → select the table.
      const node = draggedNodeRef.current;
      const pos = livePosRef.current;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (node) node.style.willChange = "auto";

      if (!movedRef.current) {
        downRef.current = null;
        movedRef.current = false;
        draggedNodeRef.current = null;
        livePosRef.current = null;
        setDragId(null);
        onSelectTable(tableId, covers);
        return;
      }
      // Drag → persist the new position.
      if (pos) {
        // Hold the dropped spot locally so the chip doesn't snap back during
        // the re-render before the server action revalidates.
        setOptimistic((prev) => ({ ...prev, [tableId]: { x: pos.x, y: pos.y } }));
        const fd = new FormData();
        fd.set("table_id", tableId);
        fd.set("pos_x", String(Math.round(pos.x * 100) / 100));
        fd.set("pos_y", String(Math.round(pos.y * 100) / 100));
        startTransition(() => {
          void saveTablePosition(fd);
        });
      }
      downRef.current = null;
      movedRef.current = false;
      draggedNodeRef.current = null;
      livePosRef.current = null;
      setDragId(null);
    },
    [onSelectTable],
  );

  // Safety: drop the drag state if the user tabs away mid-drag. We cancel
  // (no select, no persist) because the pointer-up likely happened off-canvas.
  useEffect(() => {
    if (!dragId) return;
    function onUp() {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const node = draggedNodeRef.current;
      if (node) node.style.willChange = "auto";
      downRef.current = null;
      movedRef.current = false;
      draggedNodeRef.current = null;
      livePosRef.current = null;
      setDragId(null);
    }
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId]);

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
        >
          {positioned.map((table) => {
            return (
              <TableChip
                key={table.id}
                table={table}
                x={table.x}
                y={table.y}
                dragging={dragId === table.id}
                showOutlet={outlet === null}
                ticket={ticketByTable.get(table.id) ?? null}
                selected={selectedTableId === table.id}
                busy={statusPending}
                onEdit={() => onEditTable(table)}
                onStatus={(next) => setStatus(table.id, next)}
                onOpenTicket={onOpenTicket}
                onPointerDown={(e, node) => beginDrag(e, table.id, node)}
                onPointerMove={moveDrag}
                onPointerUp={() => endDrag(table.id, table.seats)}
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
  onEdit,
  onStatus,
  onOpenTicket,
  onPointerDown,
  onPointerMove,
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
  onEdit: () => void;
  onStatus: (next: TableStatus) => void;
  onOpenTicket: (orderId: string) => void;
  onPointerDown: (e: React.PointerEvent, node: HTMLDivElement) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  // Only the dragged chip's transform is mutated imperatively during a drag,
  // so a normal ref is fine here — we read it on pointer down before capture.
  const rootRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={rootRef}
      className={`absolute flex w-[14%] min-w-[88px] max-w-[140px] flex-col rounded-xl border shadow-sm ${
        STATUS_STYLES[table.status]
      } ${selected ? "ring-[3px] ring-ring/40" : ""} ${
        dragging ? "z-20 cursor-grabbing shadow-lg" : "cursor-grab"
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onPointerDown={(e) => {
        if (rootRef.current) onPointerDown(e, rootRef.current);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${table.name}, seats ${table.seats}, ${TABLE_STATUS_LABELS[table.status]}`}
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
