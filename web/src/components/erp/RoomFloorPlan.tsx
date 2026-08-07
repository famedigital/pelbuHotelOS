"use client";

import { saveRoomMapPosition } from "@/app/actions/erp-room-map";
import { BuildingSpaceSheet } from "@/components/erp/building/BuildingSpaceSheet";
import {
  floorStructure,
  snapToWing,
  structureBandStyle,
} from "@/lib/building/geometry";
import type {
  BuildingSpace,
  CorridorAxis,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import { DEFAULT_BUILDING_PARAMS } from "@/lib/building/types";
import { Button } from "@/components/ui/button";
import {
  HK_FILL,
  STAY_RING,
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
  layout?: PropertyBuildingLayout | null;
  spaces?: Array<BuildingSpace & { id: string }>;
  snapToCorridor?: boolean;
};

const SPACE_FILL: Record<string, string> = {
  lobby: "bg-teal-700/80 text-white",
  restaurant: "bg-orange-800/75 text-white",
  cafe: "bg-amber-700/75 text-white",
  bar: "bg-violet-800/75 text-white",
  reception: "bg-sky-800/75 text-white",
  spa: "bg-cyan-800/70 text-white",
  gym: "bg-slate-700/75 text-white",
  meeting: "bg-indigo-800/70 text-white",
  stair: "bg-zinc-600/80 text-white",
  lift: "bg-zinc-500/80 text-white",
  service: "bg-stone-600/75 text-white",
  attic: "bg-stone-700/70 text-white",
  other: "bg-muted text-foreground",
};

/**
 * Digital building map — corridor structure + amenity blocks + drag rooms.
 * Floor tabs · drag rooms · click opens dossier (parent owns sheet).
 */
export function RoomFloorPlan({
  units,
  onOpenRoom,
  layout = null,
  spaces = [],
  snapToCorridor = true,
}: Props) {
  const layoutFloors = layout?.floors ?? [];
  const floors = useMemo(() => {
    if (layoutFloors.length) {
      return ["All", ...layoutFloors.map((f) => f.key)];
    }
    return listFloors(units);
  }, [layoutFloors, units]);

  const defaultFloor =
    layoutFloors.find((f) => f.kind === "guest")?.key ??
    floors.find((f) => f !== "All") ??
    "All";

  const [floor, setFloor] = useState<string>(defaultFloor);
  const [optimistic, setOptimistic] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [selectedSpace, setSelectedSpace] = useState<
    (BuildingSpace & { id: string }) | null
  >(null);

  const axis: CorridorAxis = layout?.corridor_axis ?? "ew";
  const params = layout?.params ?? DEFAULT_BUILDING_PARAMS;
  const structure = useMemo(
    () => floorStructure(axis, params),
    [axis, params],
  );

  const floorUnits = useMemo(
    () =>
      floor === "All" ? units : units.filter((u) => floorKey(u) === floor),
    [units, floor],
  );

  const floorSpaces = useMemo(
    () =>
      floor === "All"
        ? spaces
        : spaces.filter((s) => s.floor_key === floor),
    [spaces, floor],
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
  const livePosRef = useRef<{
    id: string;
    x: number;
    y: number;
    facade?: string;
  } | null>(null);
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
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;
      x = Math.max(0, Math.min(96, x));
      y = Math.max(0, Math.min(94, y));
      if (snapToCorridor && layout) {
        const snapped = snapToWing(x, y, structure);
        x = snapped.pos_x;
        y = snapped.pos_y;
        livePosRef.current = {
          id: livePosRef.current.id,
          x,
          y,
          facade: snapped.facade_side,
        };
      } else {
        livePosRef.current = {
          id: livePosRef.current.id,
          x,
          y,
        };
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushDragTransform);
      }
    },
    [flushDragTransform, layout, snapToCorridor, structure],
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
        if (pos.facade) fd.set("facade_side", pos.facade);
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

  const showStructure = Boolean(layout) && floor !== "All";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {floors.map((f) => {
          const count =
            f === "All"
              ? units.length
              : units.filter((u) => floorKey(u) === f).length;
          const meta = layoutFloors.find((lf) => lf.key === f);
          return (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={floor === f ? "default" : "outline"}
              className="h-8"
              onClick={() => setFloor(f)}
            >
              {f === "All"
                ? "All floors"
                : meta?.label ?? `Floor ${f}`}
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
          <span className="size-2.5 rounded-sm bg-amber-500" /> Dirty
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-sky-500" /> Inspect
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-rose-600" /> OOO
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm ring-2 ring-blue-500 bg-emerald-500" />{" "}
          Arriving
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm ring-2 ring-indigo-600 bg-emerald-500" />{" "}
          In-house
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm ring-2 ring-amber-500 bg-emerald-500" />{" "}
          Departing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-3 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white">
            #
          </span>{" "}
          Pax
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-rose-700" /> Maint
        </span>
        {showStructure ? (
          <span>
            Front / back wings · corridor · drag snaps · click for dossier
          </span>
        ) : (
          <span>
            Drag to lay out · click for dossier. Run Building setup for corridor
            structure.
          </span>
        )}
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
        {showStructure ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-sm border border-dashed border-sky-500/30 bg-sky-500/5"
              style={structureBandStyle(structure, "front")}
            >
              <span className="absolute top-1 left-2 text-[9px] font-medium text-sky-800/80 dark:text-sky-200/80">
                Front
              </span>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-sm border border-dashed border-amber-600/35 bg-amber-500/10"
              style={structureBandStyle(structure, "corridor")}
            >
              <span className="absolute top-1 left-2 text-[9px] font-medium text-amber-900/80 dark:text-amber-100/80">
                Corridor
              </span>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-sm border border-dashed border-violet-500/30 bg-violet-500/5"
              style={structureBandStyle(structure, "back")}
            >
              <span className="absolute top-1 left-2 text-[9px] font-medium text-violet-900/80 dark:text-violet-100/80">
                Back
              </span>
            </div>
          </>
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[12%] rounded-lg border border-dashed border-foreground/10"
          />
        )}

        <p className="pointer-events-none absolute top-2 left-1/2 z-[5] -translate-x-1/2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {floor === "All"
            ? "Building overview"
            : `${layoutFloors.find((f) => f.key === floor)?.label ?? `Floor ${floor}`} plan`}
        </p>
        <span className="pointer-events-none absolute top-1/2 left-2 z-[5] -translate-y-1/2 text-[10px] text-muted-foreground">
          W
        </span>
        <span className="pointer-events-none absolute top-1/2 right-2 z-[5] -translate-y-1/2 text-[10px] text-muted-foreground">
          E
        </span>

        {floorSpaces.map((space) => (
          <button
            key={space.id}
            type="button"
            data-no-drag
            className={cn(
              "absolute z-[6] -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/20 px-1.5 py-1 text-center shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
              SPACE_FILL[space.kind] ?? SPACE_FILL.other,
            )}
            style={{
              left: `${space.pos_x}%`,
              top: `${space.pos_y}%`,
              width: `${Math.max(8, space.width_pct * 0.85)}%`,
              minHeight: `${Math.max(6, space.depth_pct * 0.55)}%`,
            }}
            onClick={() => setSelectedSpace(space)}
          >
            <span className="block text-[9px] leading-tight font-semibold">
              {space.label}
            </span>
          </button>
        ))}

        {positioned.map((unit) => {
          const fill = HK_FILL[unit.hk_status] ?? "bg-muted text-foreground";
          const stay = unit.stay_state ?? "vacant";
          const ring =
            stay !== "vacant"
              ? (STAY_RING[stay] ?? "ring-border")
              : "ring-border/40";
          const pax =
            unit.person_count != null && unit.person_count > 0
              ? unit.person_count
              : null;
          return (
            <div
              key={unit.id}
              role="button"
              tabIndex={0}
              aria-label={`Room ${unit.label}, ${unit.hk_status}, ${stay}${pax != null ? `, ${pax} guests` : ""}`}
              className={cn(
                "absolute z-10 flex min-w-[3.25rem] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center rounded-lg px-2 py-1.5 text-center shadow-sm ring-2 select-none active:cursor-grabbing",
                fill,
                ring,
                stay !== "vacant" && "ring-[3px]",
                dragId === unit.id && "z-20 scale-105 shadow-md",
                unit.is_comp && "opacity-80",
                unit.has_open_maintenance && "outline outline-2 outline-offset-1 outline-rose-700",
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
              <span className="flex items-center gap-1 text-sm leading-none font-semibold tracking-tight">
                {unit.label}
                {pax != null ? (
                  <span className="inline-flex min-w-[1rem] items-center justify-center rounded-full bg-black/30 px-1 text-[9px] tabular-nums">
                    {pax}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 max-w-[4.5rem] truncate text-[9px] opacity-90">
                {unit.room_type_code || unit.room_type_name}
              </span>
              {unit.occupied_tonight && unit.guest_name ? (
                <span className="mt-0.5 max-w-[5rem] truncate text-[9px] opacity-90">
                  {unit.guest_name}
                </span>
              ) : stay === "vacant" ? (
                <span className="mt-0.5 text-[9px] opacity-80">Empty</span>
              ) : null}
              {unit.has_open_maintenance ? (
                <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide">
                  Maint
                </span>
              ) : null}
              {unit.photos_missing != null && unit.photos_missing > 0 ? (
                <span className="mt-0.5 text-[8px] opacity-85">
                  {unit.photos_missing} photo gaps
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <BuildingSpaceSheet
        space={selectedSpace}
        onClose={() => setSelectedSpace(null)}
      />
    </div>
  );
}
