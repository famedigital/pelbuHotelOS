"use client";

import { BuildingSpaceSheet } from "@/components/erp/building/BuildingSpaceSheet";
import {
  HK_SOLID,
  floorKey,
  unitPlanPosition,
  type RoomMapUnit,
} from "@/components/erp/room-map-shared";
import { Button } from "@/components/ui/button";
import {
  amenityFootprint3d,
  corridorRibbonSize,
  defaultCameraPose,
  floorSlabSize,
  planToWorld3d,
  roomFootprint3d,
} from "@/lib/building/geometry";
import type {
  BuildingLayoutParams,
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import { DEFAULT_BUILDING_PARAMS } from "@/lib/building/types";
import { cn } from "@/lib/utils";
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

type Props = {
  units: RoomMapUnit[];
  onOpenRoom: (unitId: string) => void;
  layout?: PropertyBuildingLayout | null;
  spaces?: Array<BuildingSpace & { id: string }>;
  /** Highlight selected units (public multi-pick). */
  selectedUnitIds?: string[];
  /**
   * Public booking tour: green free / rose sold, no guest names.
   * Desk default uses housekeeper status colours.
   */
  mode?: "desk" | "public";
  legendHint?: string | null;
};

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

const FACADE_HEX: Record<string, string> = {
  north: "#38bdf8",
  south: "#fbbf24",
  east: "#34d399",
  west: "#a78bfa",
  courtyard: "#fb7185",
  internal: "#94a3b8",
};

type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
};

/**
 * WebGL SketchUp-style hotel massing — free orbit / pan / zoom.
 * Plan remains canonical; this view extrudes percent coords.
 */
export function BuildingScene3D({
  units,
  onOpenRoom,
  layout = null,
  spaces = [],
  selectedUnitIds = [],
  mode = "desk",
  legendHint = null,
}: Props) {
  const params = layout?.params ?? DEFAULT_BUILDING_PARAMS;
  const corridorAxis = layout?.corridor_axis ?? "ew";

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
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<
    (BuildingSpace & { id: string }) | null
  >(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  const pose = useMemo(
    () => defaultCameraPose(Math.max(1, floorKeysSorted.length), params),
    [floorKeysSorted.length, params],
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const placeRooms = useMemo(() => {
    return units.map((unit, i) => {
      const { x: px, y: py } = unitPlanPosition(unit, i);
      const tier = Math.max(0, floorKeysSorted.indexOf(floorKey(unit)));
      const world = planToWorld3d(px, py, tier, params);
      const size = roomFootprint3d(params);
      return { unit, world, size, tier, fk: floorKey(unit) };
    });
  }, [units, floorKeysSorted, params]);

  const placeSpaces = useMemo(() => {
    return spaces.map((space) => {
      const tier = Math.max(0, floorKeysSorted.indexOf(space.floor_key));
      const world = planToWorld3d(space.pos_x, space.pos_y, tier, params);
      const size = amenityFootprint3d(space, params);
      return { space, world, size, tier, fk: space.floor_key };
    });
  }, [spaces, floorKeysSorted, params]);

  const selectedSet = useMemo(
    () => new Set(selectedUnitIds),
    [selectedUnitIds],
  );

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
          onClick={() => resetRef.current?.()}
        >
          Reset view
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {mode === "public" ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-emerald-500" /> Available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-rose-500" /> Sold / blocked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-amber-400" /> Selected
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-emerald-500" /> Clean
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-indigo-600" /> Occupied
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-teal-700" /> Amenities
            </span>
          </>
        )}
        <span>
          Drag to orbit · right-drag pan · scroll zoom · click room
          {mode === "public" ? " to select" : ""}
        </span>
        {legendHint ? (
          <span className="font-medium text-foreground">{legendHint}</span>
        ) : null}
        {hoveredLabel ? (
          <span className="font-medium text-foreground">{hoveredLabel}</span>
        ) : null}
      </div>

      <div className="relative h-[min(70vh,560px)] w-full overflow-hidden rounded-xl border bg-gradient-to-b from-sky-100/40 via-card to-muted/50 dark:from-sky-950/30">
        <p className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {floor === "All" ? "Whole building" : `Floor ${floor}`} · 3D
        </p>

        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading 3D view…
            </div>
          }
        >
          <Canvas
            className="!touch-none"
            dpr={[1, 1.75]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            camera={{
              position: pose.position,
              fov: 42,
              near: 1,
              far: 5000,
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
            }}
          >
            <SceneContents
              floorKeysSorted={floorKeysSorted}
              floorFilter={floor}
              corridorAxis={corridorAxis}
              params={params}
              placeRooms={placeRooms}
              placeSpaces={placeSpaces}
              layout={layout}
              pose={pose}
              reduceMotion={reduceMotion}
              resetRef={resetRef}
              onOpenRoom={onOpenRoom}
              onOpenSpace={setSelectedSpace}
              setHoveredLabel={setHoveredLabel}
              mode={mode}
              selectedSet={selectedSet}
            />
          </Canvas>
        </Suspense>
      </div>

      <BuildingSpaceSheet
        space={selectedSpace}
        onClose={() => setSelectedSpace(null)}
      />
    </div>
  );
}

type PlacedRoom = {
  unit: RoomMapUnit;
  world: { x: number; y: number; z: number };
  size: { w: number; d: number; h: number };
  tier: number;
  fk: string;
};

type PlacedSpace = {
  space: BuildingSpace & { id: string };
  world: { x: number; y: number; z: number };
  size: { w: number; d: number; h: number };
  tier: number;
  fk: string;
};

function SceneContents({
  floorKeysSorted,
  floorFilter,
  corridorAxis,
  params,
  placeRooms,
  placeSpaces,
  layout,
  pose,
  reduceMotion,
  resetRef,
  onOpenRoom,
  onOpenSpace,
  setHoveredLabel,
  mode,
  selectedSet,
}: {
  floorKeysSorted: string[];
  floorFilter: string;
  corridorAxis: "ew" | "ns";
  params: BuildingLayoutParams;
  placeRooms: PlacedRoom[];
  placeSpaces: PlacedSpace[];
  layout: PropertyBuildingLayout | null;
  pose: CameraPose;
  reduceMotion: boolean;
  resetRef: MutableRefObject<(() => void) | null>;
  onOpenRoom: (id: string) => void;
  onOpenSpace: (s: BuildingSpace & { id: string }) => void;
  setHoveredLabel: (label: string | null) => void;
  mode: "desk" | "public";
  selectedSet: Set<string>;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();
  const slab = floorSlabSize(params);
  const corridor = corridorRibbonSize(corridorAxis, params);
  const showLabels = floorFilter !== "All";

  const applyPose = useCallback(() => {
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    const c = controlsRef.current;
    if (c) {
      c.target.set(...pose.target);
      c.update();
    }
  }, [camera, pose]);

  useEffect(() => {
    applyPose();
    resetRef.current = applyPose;
    return () => {
      resetRef.current = null;
    };
  }, [applyPose, resetRef]);

  return (
    <>
      <ambientLight intensity={0.72} />
      <directionalLight intensity={1.05} position={[180, 320, 120]} />
      <directionalLight intensity={0.35} position={[-120, 80, -90]} />
      <hemisphereLight args={["#e0f2fe", "#78716c", 0.45]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[params.slabW * 2.4, params.slabD * 2.4]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper
        args={[
          Math.max(params.slabW, params.slabD) * 2.2,
          20,
          "#a8a29e",
          "#e7e5e4",
        ]}
        position={[0, -1.5, 0]}
      />

      {floorKeysSorted.map((fk, ti) => {
        const active = floorFilter === "All" || floorFilter === fk;
        const baseY = ti * params.floorHeight;
        const opacity = active ? 1 : 0.12;
        const label =
          layout?.floors.find((f) => f.key === fk)?.label ?? `F${fk}`;
        return (
          <group key={fk} visible={floorFilter === "All" || active}>
            <mesh position={[0, baseY + slab.thickness / 2, 0]}>
              <boxGeometry args={[slab.w, slab.thickness, slab.d]} />
              <meshStandardMaterial
                color="#e7e5e4"
                transparent
                opacity={opacity * 0.92}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[0, baseY + slab.thickness + 0.8, 0]}>
              <boxGeometry args={[corridor.w, 1.6, corridor.d]} />
              <meshStandardMaterial
                color="#f59e0b"
                transparent
                opacity={opacity * 0.35}
                roughness={0.7}
              />
            </mesh>
            {showLabels || floorFilter === "All" ? (
              <Html
                position={[-slab.w / 2 + 18, baseY + 14, -slab.d / 2 + 12]}
                center
                distanceFactor={280}
                style={{ pointerEvents: "none" }}
              >
                <span
                  className={cn(
                    "rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm",
                    !active && "opacity-40",
                  )}
                >
                  {label}
                </span>
              </Html>
            ) : null}
          </group>
        );
      })}

      {placeSpaces.map(({ space, world, size, fk }) => {
        if (floorFilter !== "All" && fk !== floorFilter) return null;
        const fill = SPACE_COLOR[space.kind] ?? SPACE_COLOR.other;
        return (
          <MassBox
            key={space.id}
            position={[world.x, world.y + size.h / 2 + 1, world.z]}
            size={size}
            color={fill}
            edgeColor="#ffffff"
            onClick={() => onOpenSpace(space)}
            onHover={(on) => setHoveredLabel(on ? space.label : null)}
            label={showLabels ? space.label : null}
          />
        );
      })}

      {placeRooms.map(({ unit, world, size, fk }) => {
        if (floorFilter !== "All" && fk !== floorFilter) return null;
        const fill = HK_SOLID[unit.hk_status] ?? "#64748b";
        const edgeHex = FACADE_HEX[unit.facade_side ?? ""] ?? "#cbd5e1";
        const subtitle =
          unit.occupied_tonight && unit.guest_name
            ? unit.guest_name
            : unit.room_type_code || unit.room_type_name;
        return (
          <MassBox
            key={unit.id}
            position={[world.x, world.y + size.h / 2 + 1, world.z]}
            size={size}
            color={fill}
            opacity={unit.is_comp ? 0.82 : 1}
            edgeColor={edgeHex}
            onClick={() => onOpenRoom(unit.id)}
            onHover={(on) =>
              setHoveredLabel(
                on
                  ? `Room ${unit.label}${subtitle ? ` · ${subtitle}` : ""}`
                  : null,
              )
            }
            label={showLabels ? unit.label : null}
          />
        );
      })}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        enablePan
        enableZoom
        enableRotate
        minDistance={80}
        maxDistance={1400}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI / 2 - 0.04}
        target={pose.target}
      />
    </>
  );
}

function MassBox({
  position,
  size,
  color,
  opacity = 1,
  edgeColor,
  onClick,
  onHover,
  label,
}: {
  position: [number, number, number];
  size: { w: number; d: number; h: number };
  color: string;
  opacity?: number;
  edgeColor: string;
  onClick: () => void;
  onHover: (on: boolean) => void;
  label: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const edgesGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.w, size.h, size.d)),
    [size.w, size.h, size.d],
  );

  useEffect(() => {
    return () => {
      edgesGeo.dispose();
      document.body.style.cursor = "auto";
    };
  }, [edgesGeo]);

  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.55}
          metalness={0.08}
          emissive={hovered ? "#ffffff" : "#000000"}
          emissiveIntensity={hovered ? 0.12 : 0}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial
          color={edgeColor}
          transparent
          opacity={hovered ? 0.95 : 0.45}
        />
      </lineSegments>
      {label ? (
        <Html
          center
          position={[0, size.h * 0.15, 0]}
          distanceFactor={220}
          style={{ pointerEvents: "none" }}
        >
          <span className="rounded bg-black/55 px-1 py-0.5 text-[10px] font-semibold text-white shadow">
            {label}
          </span>
        </Html>
      ) : null}
    </group>
  );
}
