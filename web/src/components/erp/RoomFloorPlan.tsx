"use client";

import { saveRoomMapPosition } from "@/app/actions/erp-room-map";
import { Button } from "@/components/ui/button";
import {
  FACADE_RING,
  HK_FILL,
  floorKey,
  listFloors,
  unitPlanPosition,
  type RoomMapUnit,
} from "@/components/erp/room-map-shared";
import { cn } from "@/lib/utils";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type { RoomMapUnit } from "@/components/erp/room-map-shared";

type Props = {
  units: RoomMapUnit[];
  onOpenRoom: (unitId: string) => void;
};

/**
 * Digital building map — POS table canvas pattern.
 * Floor tabs · drag rooms · click opens dossier (parent owns sheet).
 */
export function RoomFloorPlan({ units, onOpenRoom }: Props) {
  const floors = useMemo(() => listFloors(units), [units]);

  const [floor, setFloor] = useState<string>("All");
  const [optimistic, setOptimistic] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const floorUnits = useMemo(
    () =>
      floor === "All" ? units : units.filter((u) => floorKey(u) === floor),
    [units, floor],
  );

  const positioned = useMemo(() => {
    return floorUnits.map((unit, i) => {
      const opt = optimistic[unit.id];
      if (opt) return { ...unit, x: opt.x, y: opt.y };
      const { x, y } = unitPlanPosition(unit, i);
      return { ...unit, x, y };
    });
  }, [floorUnits, optimistic]);

  useEffect(() => {
    setOptimistic((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next: Record<string, { x: number; y: number }> = {};
      for (const unit of floorUnits) {
        const opt = prev[unit.id];
        if (!opt) continue;
        const confirmed =
          unit.pos_x != null &&
          unit.pos_y != null &&
          Math.abs(unit.pos_x - opt.x) < 0.5 &&
          Math.abs(unit.pos_y - opt.y) < 0.5;
        if (confirmed) changed = true;
        else next[unit.id] = opt;
      }
      return changed ? next : prev;
    });
  }, [floorUnits]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const livePosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const draggedNodeRef = useRef<HTMLDivElement | null>(null);
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const flushDragTransform = useCallback(() => {
    rafRef.current = null;
    const node = draggedNodeRef.current;
    const pos = livePosRef.current;
    if (!node || !pos) return;
    node.style.left = `${pos.x}%`;
    node.style.top = `${pos.y}%`;
  }, []);

  const beginDrag = useCallback(
    (e: React.PointerEvent, unitId: string, node: HTMLDivElement) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      const row = positioned.find((t) => t.id === unitId);
      if (!row) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      downRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
      draggedNodeRef.current = node;
      livePosRef.current = { id: unitId, x: row.x, y: row.y };
      setDragId(unitId);
      node.style.willChange = "left, top";
    },
    [positioned],
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!livePosRef.current || !canvasRef.current) return;
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
        id: livePosRef.current.id,
        x: Math.max(0, Math.min(96, x)),
        y: Math.max(0, Math.min(94, y)),
      };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushDragTransform);
      }
    },
    [flushDragTransform],
  );

  const endDrag = useCallback(
    (unitId: string) => {
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
        onOpenRoom(unitId);
        return;
      }
      if (pos) {
        setOptimistic((prev) => ({
          ...prev,
          [unitId]: { x: pos.x, y: pos.y },
        }));
        const fd = new FormData();
        fd.set("unit_id", unitId);
        fd.set("pos_x", String(Math.round(pos.x * 100) / 100));
        fd.set("pos_y", String(Math.round(pos.y * 100) / 100));
        startTransition(() => {
          void saveRoomMapPosition(fd);
        });
      }
      downRef.current = null;
      movedRef.current = false;
      draggedNodeRef.current = null;
      livePosRef.current = null;
      setDragId(null);
    },
    [onOpenRoom],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {floors.map((f) => {
          const count =
            f === "All"
              ? units.length
              : units.filter((u) => floorKey(u) === f).length;
          return (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={floor === f ? "default" : "outline"}
              className="h-8"
              onClick={() => setFloor(f)}
            >
              {f === "All" ? "All floors" : `Floor ${f}`}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500" /> Clean
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-indigo-600" /> Occupied
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-500" /> Dirty
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-rose-600" /> OOO
        </span>
        <span>
          Ring color = facade (W/E/S/N). Drag to lay out · click for dossier.
        </span>
      </div>

      <div
        ref={canvasRef}
        className="relative h-[min(70vh,560px)] w-full overflow-hidden rounded-xl border bg-gradient-to-br from-muted/40 via-card to-muted/30"
        onPointerMove={moveDrag}
        onPointerUp={() => {
          if (dragId) endDrag(dragId);
        }}
        onPointerCancel={() => {
          if (dragId) endDrag(dragId);
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[12%] rounded-lg border border-dashed border-foreground/10"
        />
        <p className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {floor === "All" ? "Building overview" : `Floor ${floor} plan`}
        </p>
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-muted-foreground">
          W
        </span>
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
          E
        </span>

        {positioned.map((unit) => {
          const fill = HK_FILL[unit.hk_status] ?? "bg-muted text-foreground";
          const ring = FACADE_RING[unit.facade_side ?? ""] ?? "ring-border";
          return (
            <div
              key={unit.id}
              role="button"
              tabIndex={0}
              aria-label={`Room ${unit.label}`}
              className={cn(
                "absolute flex min-w-[3.25rem] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center rounded-lg px-2 py-1.5 text-center shadow-sm ring-2 select-none active:cursor-grabbing",
                fill,
                ring,
                dragId === unit.id && "z-20 scale-105 shadow-md",
                unit.is_comp && "opacity-80",
              )}
              style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
              onPointerDown={(e) =>
                beginDrag(e, unit.id, e.currentTarget as HTMLDivElement)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenRoom(unit.id);
                }
              }}
            >
              <span className="text-sm leading-none font-semibold tracking-tight">
                {unit.label}
              </span>
              <span className="mt-0.5 max-w-[4.5rem] truncate text-[9px] opacity-90">
                {unit.room_type_code || unit.room_type_name}
              </span>
              {unit.occupied_tonight && unit.guest_name ? (
                <span className="mt-0.5 max-w-[5rem] truncate text-[9px] opacity-90">
                  {unit.guest_name}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
