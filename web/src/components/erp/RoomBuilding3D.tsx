"use client";

import { Button } from "@/components/ui/button";
import {
  FACADE_EDGE,
  HK_SOLID,
  floorKey,
  listFloors,
  unitPlanPosition,
  type RoomMapUnit,
} from "@/components/erp/room-map-shared";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  units: RoomMapUnit[];
  onOpenRoom: (unitId: string) => void;
};

const FLOOR_HEIGHT = 56;
const SLAB_W = 320;
const SLAB_D = 200;
const ROOM_W = 36;
const ROOM_H = 28;
const ROOM_D = 32;

const DEFAULT_YAW = -32;
const DEFAULT_PITCH = 58;

function roomWorld(
  unit: RoomMapUnit,
  index: number,
  floorKeysSorted: string[],
): { x: number; y: number; z: number } {
  const { x: px, y: _py } = unitPlanPosition(unit, index);
  // Corridor along X from west (low) to east (high); depth slight from facade
  const along = ((px - 50) / 50) * (SLAB_W * 0.42);
  let depth = 0;
  switch (unit.facade_side) {
    case "west":
      depth = -SLAB_D * 0.28;
      break;
    case "east":
      depth = SLAB_D * 0.28;
      break;
    case "north":
      depth = -SLAB_D * 0.12;
      break;
    case "south":
      depth = SLAB_D * 0.12;
      break;
    case "courtyard":
      depth = 0;
      break;
    default:
      depth = ((unit.pos_y ?? 50) - 50) / 50 * (SLAB_D * 0.2);
  }
  const fk = floorKey(unit);
  const fi = floorKeysSorted.indexOf(fk);
  const tier = fi >= 0 ? fi : 0;
  const y = tier * FLOOR_HEIGHT;
  return { x: along, y, z: depth };
}

/**
 * CSS isometric building massing — click opens dossier; drag canvas to orbit.
 * Positions still edited only in Plan mode.
 */
export function RoomBuilding3D({ units, onOpenRoom }: Props) {
  const floors = useMemo(() => listFloors(units), [units]);
  const floorKeysSorted = useMemo(
    () => floors.filter((f) => f !== "All"),
    [floors],
  );

  const [floor, setFloor] = useState<string>("All");
  const [yaw, setYaw] = useState(DEFAULT_YAW);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [reduceMotion, setReduceMotion] = useState(false);

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

  const visible = useMemo(() => {
    const list =
      floor === "All" ? units : units.filter((u) => floorKey(u) === floor);
    return list.map((unit, i) => {
      const world = roomWorld(unit, i, floorKeysSorted);
      return { unit, ...world, index: i };
    });
  }, [units, floor, floorKeysSorted]);

  const onScenePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-room-block]")) return;
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

  const onScenePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const o = orbitRef.current;
      if (!o || o.pointerId !== e.pointerId) return;
      const dx = e.clientX - o.sx;
      const dy = e.clientY - o.sy;
      if (!o.moved && dx * dx + dy * dy > 16) o.moved = true;
      if (!o.moved) return;
      setYaw(o.yaw0 + dx * 0.35);
      setPitch(Math.max(28, Math.min(78, o.pitch0 - dy * 0.28)));
    },
    [],
  );

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

  // sort for painter's order roughly by depth under default view
  const sortedBlocks = useMemo(() => {
    const angle = (yaw * Math.PI) / 180;
    return [...visible].sort((a, b) => {
      const da = a.x * Math.sin(angle) + a.z * Math.cos(angle) + a.y * 0.01;
      const db = b.x * Math.sin(angle) + b.z * Math.cos(angle) + b.y * 0.01;
      return da - db;
    });
  }, [visible, yaw]);

  const maxTier = Math.max(0, floorKeysSorted.length - 1);

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
          <span className="size-2.5 rounded-sm bg-amber-500" /> Dirty
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-rose-600" /> OOO
        </span>
        <span>
          Edge colour = facade. Drag empty space to orbit · click room · switch
          to Plan to rearrange.
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
        <span className="pointer-events-none absolute bottom-2 left-3 z-10 text-[10px] text-muted-foreground">
          W
        </span>
        <span className="pointer-events-none absolute right-3 bottom-2 z-10 text-[10px] text-muted-foreground">
          E
        </span>

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
              transition: reduceMotion ? undefined : undefined,
            }}
          >
            {/* Floor slabs */}
            {floorKeysSorted.map((fk, ti) => {
              const isolate = floor !== "All" && floor !== fk;
              return (
                <div
                  key={fk}
                  aria-hidden
                  className={cn(
                    "absolute rounded-sm border border-dashed border-foreground/15 bg-muted/30",
                    isolate && "opacity-25",
                  )}
                  style={{
                    width: SLAB_W,
                    height: SLAB_D,
                    left: "50%",
                    top: "50%",
                    marginLeft: -SLAB_W / 2,
                    marginTop: -SLAB_D / 2,
                    transform: `translateY(${-ti * FLOOR_HEIGHT}px) rotateX(90deg) translateZ(0)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <span className="absolute top-1 left-2 text-[9px] font-medium text-muted-foreground">
                    F{fk}
                  </span>
                </div>
              );
            })}

            {sortedBlocks.map(({ unit, x, y, z }) => {
              const fill =
                HK_SOLID[unit.hk_status] ?? "var(--muted-foreground)";
              const edge =
                FACADE_EDGE[unit.facade_side ?? ""] ?? "border-border";
              return (
                <div
                  key={unit.id}
                  data-room-block
                  role="button"
                  tabIndex={0}
                  aria-label={`Room ${unit.label}${unit.view_label ? `, ${unit.view_label}` : ""}`}
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
                    // allow orbit starting on a room
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
                  {/* Side extrusion faces */}
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
    </div>
  );
}
