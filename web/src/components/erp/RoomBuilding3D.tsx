"use client";

import { BuildingSpaceSheet } from "@/components/erp/building/BuildingSpaceSheet";
import { Button } from "@/components/ui/button";
import {
  amenityFootprint3d,
  planToWorld3d,
} from "@/lib/building/geometry";
import type {
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import { DEFAULT_BUILDING_PARAMS } from "@/lib/building/types";
import {
  FACADE_EDGE,
  HK_SOLID,
  floorKey,
  unitPlanPosition,
  type RoomMapUnit,
} from "@/components/erp/room-map-shared";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  units: RoomMapUnit[];
  onOpenRoom: (unitId: string) => void;
  layout?: PropertyBuildingLayout | null;
  spaces?: Array<BuildingSpace & { id: string }>;
};

const DEFAULT_YAW = -32;
const DEFAULT_PITCH = 58;

const SPACE_COLOR: Record<string, string> = {
  lobby: "#0f766e",
  restaurant: "#9a3412",
  cafe: "#b45309",
  bar: "#5b21b6",
  reception: "#0369a1",
  spa: "#0e7490",
  gym: "#334155",
  meeting: "#3730a3",
  stair: "#52525b",
  lift: "#71717a",
  service: "#57534e",
  attic: "#44403c",
  other: "#64748b",
};

/**
 * CSS isometric building massing — extrudes 2D plan coords.
 * Floors come from layout profile so public floors show without rooms.
 */
export function RoomBuilding3D({
  units,
  onOpenRoom,
  layout = null,
  spaces = [],
}: Props) {
  const params = layout?.params ?? DEFAULT_BUILDING_PARAMS;
  const SLAB_W = params.slabW;
  const SLAB_D = params.slabD;
  const FLOOR_HEIGHT = params.floorHeight;

  const floorKeysSorted = useMemo(() => {
    if (layout?.floors?.length) {
      return layout.floors.map((f) => f.key);
    }
    const set = new Set<string>();
    for (const u of units) set.add(floorKey(u));
    return [...set].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [layout, units]);

  const floorTabs = useMemo(
    () => ["All", ...floorKeysSorted],
    [floorKeysSorted],
  );

  const [floor, setFloor] = useState<string>("All");
  const [yaw, setYaw] = useState(DEFAULT_YAW);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<
    (BuildingSpace & { id: string }) | null
  >(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const orbitRef = useRef<{
    pointerId: number;
    sx: number;
    sy: number;
    yaw0: number;
    pitch0: number;
    moved: boolean;
  } | null>(null);
  const clickCandidateRef = useRef<string | null>(null);

  const visibleRooms = useMemo(() => {
    const list =
      floor === "All" ? units : units.filter((u) => floorKey(u) === floor);
    return list.map((unit, i) => {
      const { x: px, y: py } = unitPlanPosition(unit, i);
      const tier = Math.max(0, floorKeysSorted.indexOf(floorKey(unit)));
      const world = planToWorld3d(px, py, tier, params);
      return { unit, ...world, index: i };
    });
  }, [units, floor, floorKeysSorted, params]);

  const visibleSpaces = useMemo(() => {
    const list =
      floor === "All"
        ? spaces
        : spaces.filter((s) => s.floor_key === floor);
    return list.map((space) => {
      const tier = Math.max(0, floorKeysSorted.indexOf(space.floor_key));
      const world = planToWorld3d(space.pos_x, space.pos_y, tier, params);
      const foot = amenityFootprint3d(space, params);
      return { space, ...world, ...foot };
    });
  }, [spaces, floor, floorKeysSorted, params]);

  const onScenePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-room-block]")) return;
      if ((e.target as HTMLElement).closest("[data-space-block]")) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      orbitRef.current = {
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        yaw0: yaw,
        pitch0: pitch,
        moved: false,
      };
      clickCandidateRef.current = null;
    },
    [yaw, pitch],
  );

  const onScenePointerMove = useCallback((e: React.PointerEvent) => {
    const o = orbitRef.current;
    if (!o || o.pointerId !== e.pointerId) return;
    const dx = e.clientX - o.sx;
    const dy = e.clientY - o.sy;
    if (!o.moved && dx * dx + dy * dy > 16) o.moved = true;
    if (!o.moved) return;
    setYaw(o.yaw0 + dx * 0.35);
    setPitch(Math.max(28, Math.min(78, o.pitch0 - dy * 0.28)));
  }, []);

  const onScenePointerUp = useCallback(() => {
    orbitRef.current = null;
  }, []);

  const beginRoomPress = useCallback(
    (e: React.PointerEvent, unitId: string) => {
      e.stopPropagation();
      clickCandidateRef.current = unitId;
      orbitRef.current = {
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        yaw0: yaw,
        pitch0: pitch,
        moved: false,
      };
    },
    [yaw, pitch],
  );

  const endRoomPress = useCallback(
    (e: React.PointerEvent, unitId: string) => {
      const o = orbitRef.current;
      const wasOrbit = o?.moved;
      orbitRef.current = null;
      if (wasOrbit) {
        clickCandidateRef.current = null;
        return;
      }
      if (clickCandidateRef.current === unitId) {
        clickCandidateRef.current = null;
        onOpenRoom(unitId);
      }
    },
    [onOpenRoom],
  );

  const sortedRooms = useMemo(() => {
    const angle = (yaw * Math.PI) / 180;
    return [...visibleRooms].sort((a, b) => {
      const da = a.x * Math.sin(angle) + a.z * Math.cos(angle) + a.y * 0.01;
      const db = b.x * Math.sin(angle) + b.z * Math.cos(angle) + b.y * 0.01;
      return da - db;
    });
  }, [visibleRooms, yaw]);

  const maxTier = Math.max(0, floorKeysSorted.length - 1);
  const corridorAxis = layout?.corridor_axis ?? "ew";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {floorTabs.map((f) => {
          const count =
            f === "All"
              ? units.length
              : units.filter((u) => floorKey(u) === f).length;
          const label =
            f === "All"
              ? "All floors"
              : layout?.floors.find((lf) => lf.key === f)?.label ??
                `Floor ${f}`;
          return (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={floor === f ? "default" : "outline"}
              className="h-8"
              onClick={() => setFloor(f)}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-muted-foreground"
          onClick={() => {
            setYaw(DEFAULT_YAW);
            setPitch(DEFAULT_PITCH);
          }}
        >
          Reset view
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500" /> Clean
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-indigo-600" /> Occupied
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-teal-700" /> Amenities
        </span>
        <span>
          Drag empty space to orbit · click room or amenity · rearrange in Plan
        </span>
      </div>

      <div
        className="relative h-[min(70vh,560px)] w-full touch-none overflow-hidden rounded-xl border bg-gradient-to-br from-muted/50 via-card to-muted/40"
        style={{ perspective: reduceMotion ? undefined : "1200px" }}
        onPointerDown={onScenePointerDown}
        onPointerMove={onScenePointerMove}
        onPointerUp={onScenePointerUp}
        onPointerCancel={onScenePointerUp}
      >
        <p className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {floor === "All" ? "Building massing" : `Floor ${floor}`}
        </p>

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative"
            style={{
              width: SLAB_W + 80,
              height: FLOOR_HEIGHT * (maxTier + 1) + SLAB_D * 0.5 + 80,
              transformStyle: "preserve-3d",
              transform: reduceMotion
                ? `rotateX(${DEFAULT_PITCH}deg) rotateZ(${DEFAULT_YAW}deg)`
                : `rotateX(${pitch}deg) rotateZ(${yaw}deg)`,
            }}
          >
            {floorKeysSorted.map((fk, ti) => {
              const isolate = floor !== "All" && floor !== fk;
              const midY = -ti * FLOOR_HEIGHT;
              return (
                <div key={fk}>
                  {/* Floor slab */}
                  <div
                    aria-hidden
                    className={cn(
                      "absolute rounded-sm border border-dashed border-foreground/15 bg-muted/35",
                      isolate && "opacity-25",
                    )}
                    style={{
                      width: SLAB_W,
                      height: SLAB_D,
                      left: "50%",
                      top: "50%",
                      marginLeft: -SLAB_W / 2,
                      marginTop: -SLAB_D / 2,
                      transform: `translateY(${midY}px) rotateX(90deg) translateZ(0)`,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <span className="absolute top-1 left-2 text-[9px] font-medium text-muted-foreground">
                      {layout?.floors.find((f) => f.key === fk)?.label ??
                        `F${fk}`}
                    </span>
                  </div>
                  {/* Corridor ribbon */}
                  <div
                    aria-hidden
                    className={cn(
                      "absolute rounded-sm bg-amber-500/25",
                      isolate && "opacity-20",
                    )}
                    style={
                      corridorAxis === "ew"
                        ? {
                            width: SLAB_W * 0.88,
                            height: SLAB_D * 0.12,
                            left: "50%",
                            top: "50%",
                            marginLeft: -(SLAB_W * 0.88) / 2,
                            marginTop: -(SLAB_D * 0.12) / 2,
                            transform: `translateY(${midY + 1}px) rotateX(90deg) translateZ(1px)`,
                          }
                        : {
                            width: SLAB_W * 0.12,
                            height: SLAB_D * 0.88,
                            left: "50%",
                            top: "50%",
                            marginLeft: -(SLAB_W * 0.12) / 2,
                            marginTop: -(SLAB_D * 0.88) / 2,
                            transform: `translateY(${midY + 1}px) rotateX(90deg) translateZ(1px)`,
                          }
                    }
                  />
                </div>
              );
            })}

            {visibleSpaces.map(({ space, x, y, z, w, d, h }) => {
              const fill = SPACE_COLOR[space.kind] ?? SPACE_COLOR.other;
              return (
                <div
                  key={space.id}
                  data-space-block
                  role="button"
                  tabIndex={0}
                  aria-label={space.label}
                  className="absolute cursor-pointer border border-white/25 select-none outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{
                    width: w,
                    height: h,
                    left: "50%",
                    top: "50%",
                    marginLeft: -w / 2,
                    marginTop: -h / 2,
                    transform: `translate3d(${x}px, ${-y - h / 2}px, ${z}px)`,
                    transformStyle: "preserve-3d",
                    backgroundColor: fill,
                    boxShadow: "0 3px 0 rgba(0,0,0,0.2)",
                    color: "#fff",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSpace(space);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedSpace(space);
                    }
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      height: d * 0.45,
                      transformOrigin: "bottom",
                      transform: "rotateX(-90deg)",
                      backgroundColor: fill,
                      filter: "brightness(0.7)",
                    }}
                  />
                  <div className="relative z-[1] flex h-full items-center justify-center px-0.5 text-center">
                    <span className="text-[9px] leading-tight font-semibold">
                      {space.label}
                    </span>
                  </div>
                </div>
              );
            })}

            {sortedRooms.map(({ unit, x, y, z }) => {
              const fill =
                HK_SOLID[unit.hk_status] ?? "var(--muted-foreground)";
              const edge =
                FACADE_EDGE[unit.facade_side ?? ""] ?? "border-border";
              const ROOM_W = 36;
              const ROOM_H = 28;
              const ROOM_D = 32;
              return (
                <div
                  key={unit.id}
                  data-room-block
                  role="button"
                  tabIndex={0}
                  aria-label={`Room ${unit.label}`}
                  className={cn(
                    "absolute cursor-pointer border-2 select-none outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    edge,
                    unit.is_comp && "opacity-80",
                  )}
                  style={{
                    width: ROOM_W,
                    height: ROOM_H,
                    left: "50%",
                    top: "50%",
                    marginLeft: -ROOM_W / 2,
                    marginTop: -ROOM_H / 2,
                    transform: `translate3d(${x}px, ${-y - ROOM_H / 2}px, ${z}px)`,
                    transformStyle: "preserve-3d",
                    backgroundColor: fill,
                    boxShadow: "0 4px 0 rgba(0,0,0,0.18)",
                    color: "#fff",
                  }}
                  onPointerDown={(e) => beginRoomPress(e, unit.id)}
                  onPointerUp={(e) => endRoomPress(e, unit.id)}
                  onPointerCancel={() => {
                    orbitRef.current = null;
                    clickCandidateRef.current = null;
                  }}
                  onPointerMove={(e) => {
                    const o = orbitRef.current;
                    if (!o || o.pointerId !== e.pointerId) return;
                    const dx = e.clientX - o.sx;
                    const dy = e.clientY - o.sy;
                    if (!o.moved && dx * dx + dy * dy > 16) o.moved = true;
                    if (!o.moved) return;
                    setYaw(o.yaw0 + dx * 0.35);
                    setPitch(
                      Math.max(28, Math.min(78, o.pitch0 - dy * 0.28)),
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenRoom(unit.id);
                    }
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      height: ROOM_D,
                      transformOrigin: "bottom",
                      transform: `rotateX(-90deg)`,
                      backgroundColor: fill,
                      filter: "brightness(0.75)",
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-y-0 right-0"
                    style={{
                      width: ROOM_D,
                      transformOrigin: "right",
                      transform: `rotateY(90deg)`,
                      backgroundColor: fill,
                      filter: "brightness(0.85)",
                    }}
                  />
                  <div className="relative z-[1] flex h-full flex-col items-center justify-center px-0.5 text-center">
                    <span className="text-[11px] leading-none font-semibold tracking-tight">
                      {unit.label}
                    </span>
                    <span className="mt-0.5 max-w-full truncate text-[8px] opacity-90">
                      {unit.room_type_code || unit.room_type_name}
                    </span>
                    {unit.occupied_tonight && unit.guest_name ? (
                      <span className="max-w-full truncate text-[7px] opacity-85">
                        {unit.guest_name}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BuildingSpaceSheet
        space={selectedSpace}
        onClose={() => setSelectedSpace(null)}
      />
    </div>
  );
}
