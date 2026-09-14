"use client";

import { Button } from "@/components/ui/button";
import { splitOlakhaFloorWings } from "@/lib/building/olakha-wings";
import type {
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

export const FACADE_TEXTURE_SRC = "/brand/pelbu-olakha-facade.png";

const FLOOR_ORDER = ["G", "1", "2", "3", "4", "5"] as const;
type FloorKey = (typeof FLOOR_ORDER)[number];

/** UV v from bottom of the cropped facade (ground) to below the roof. */
const FLOOR_UV: Record<FloorKey, { v0: number; v1: number }> = {
  G: { v0: 0.02, v1: 0.18 },
  "1": { v0: 0.18, v1: 0.33 },
  "2": { v0: 0.33, v1: 0.47 },
  "3": { v0: 0.47, v1: 0.61 },
  "4": { v0: 0.61, v1: 0.75 },
  "5": { v0: 0.75, v1: 0.9 },
};

const W = 280;
const H = 220;
const D = 110;

const PUBLIC_FLOOR = new Set(["G", "1"]);

function floorTabLabel(key: string, layout: PropertyBuildingLayout | null) {
  if (key === "All") return "All floors";
  return layout?.floors.find((f) => f.key === key)?.label ?? `Floor ${key}`;
}

function isFloorKey(value: string): value is FloorKey {
  return (FLOOR_ORDER as readonly string[]).includes(value);
}

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

type Props = {
  units: RoomMapUnit[];
  layout: PropertyBuildingLayout;
  spaces: Array<BuildingSpace & { id: string }>;
  selectedUnitIds?: string[];
  legendHint?: string | null;
  /** `hero` fills the parent and overlays compact floor chips. */
  variant?: "page" | "hero";
  onSelectRoom?: (unit: RoomMapUnit) => void;
  onSelectSpace?: (space: BuildingSpace & { id: string }) => void;
  onSelectFloorWing?: (floorKey: string, wing: "front" | "back") => void;
};

export function HotelFacadeExplore({
  units,
  layout,
  spaces,
  selectedUnitIds = [],
  legendHint = null,
  variant = "page",
  onSelectRoom,
  onSelectSpace,
  onSelectFloorWing,
}: Props) {
  const isHero = variant === "hero";
  const narrow = useNarrowViewport();
  const [floor, setFloor] = useState<string>("All");
  const [wing, setWing] = useState<"front" | "back">("front");
  const [pickerFloor, setPickerFloor] = useState<FloorKey | null>(null);

  const programSpaces = useMemo(() => {
    if (!pickerFloor) return [];
    return spaces
      .filter((s) => s.floor_key === pickerFloor)
      .filter((s) => s.kind !== "stair" && s.kind !== "lift");
  }, [pickerFloor, spaces]);

  const guestOnFloor = useMemo(() => {
    if (!isFloorKey(floor) || PUBLIC_FLOOR.has(floor)) return [];
    const split = splitOlakhaFloorWings(units, floor);
    return wing === "front" ? split.front : split.back;
  }, [floor, units, wing]);

  const applyGuestFloor = useCallback(
    (key: FloorKey, nextWing: "front" | "back") => {
      setFloor(key);
      setWing(nextWing);
      setPickerFloor(null);
      const split = splitOlakhaFloorWings(units, key);
      const group = nextWing === "front" ? split.front : split.back;
      onSelectFloorWing?.(key, nextWing);
      if (!onSelectFloorWing) {
        const first = group[0];
        if (first && onSelectRoom) onSelectRoom(first);
      }
    },
    [onSelectFloorWing, onSelectRoom, units],
  );

  const onBandClick = useCallback(
    (key: FloorKey) => {
      setFloor(key);
      if (PUBLIC_FLOOR.has(key)) {
        setPickerFloor(key);
        return;
      }
      applyGuestFloor(key, wing);
    },
    [applyGuestFloor, wing],
  );

  const floorBar = (
    <div className="flex flex-wrap items-center gap-2">
      {["All", ...FLOOR_ORDER].map((key) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant={floor === key ? "default" : "outline"}
          className={isHero ? "h-11 min-w-11 bg-background/90" : "h-11 min-w-11"}
          onClick={() => {
            if (key === "All") {
              setFloor("All");
              setPickerFloor(null);
              onSelectFloorWing?.("All", "front");
              return;
            }
            onBandClick(key as FloorKey);
          }}
        >
          {isHero
            ? key === "All"
              ? "All"
              : key === "G"
                ? "G"
                : key === "1"
                  ? "1st"
                  : key
            : floorTabLabel(key, layout)}
        </Button>
      ))}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={wing === "front" ? "default" : "outline"}
          className={isHero ? "h-11 bg-background/90" : "h-11"}
          onClick={() => {
            setWing("front");
            if (isFloorKey(floor) && !PUBLIC_FLOOR.has(floor)) {
              applyGuestFloor(floor, "front");
            }
          }}
        >
          Front
        </Button>
        <Button
          type="button"
          size="sm"
          variant={wing === "back" ? "default" : "outline"}
          className={isHero ? "h-11 bg-background/90" : "h-11"}
          onClick={() => {
            setWing("back");
            if (isFloorKey(floor) && !PUBLIC_FLOOR.has(floor)) {
              applyGuestFloor(floor, "back");
            }
          }}
        >
          Back
        </Button>
      </div>
    </div>
  );

  const picker = pickerFloor ? (
    <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-background/90 p-3 shadow-sm">
      <p className="w-full text-xs font-medium text-muted-foreground">
        {pickerFloor === "G" ? "Ground floor" : "First floor"}
      </p>
      {programSpaces.map((space) => (
        <Button
          key={space.id}
          type="button"
          size="sm"
          variant="outline"
          className="h-11"
          onClick={() => onSelectSpace?.(space)}
        >
          {space.label}
        </Button>
      ))}
    </div>
  ) : null;

  const canvas = (
    <Canvas
      className="h-full w-full touch-none"
      style={{ touchAction: "none", display: "block" }}
      dpr={isHero ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: !narrow, alpha: true, powerPreference: "high-performance" }}
      camera={{
        position: isHero
          ? narrow
            ? [35, 58, 155]
            : [90, 70, 175]
          : [220, 140, 260],
        fov: isHero ? (narrow ? 48 : 40) : 38,
        near: 1,
        far: 4000,
      }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Suspense fallback={null}>
        <FacadeScene
          floor={floor}
          wing={wing}
          onBandClick={onBandClick}
          selectedCount={selectedUnitIds.length}
          hero={isHero}
          narrow={narrow}
        />
      </Suspense>
    </Canvas>
  );

  if (isHero) {
    return (
      <div className="relative h-full w-full">
        <div className="absolute inset-0 bg-gradient-to-b from-mist-1 via-[#eef4ea] to-[#d9d2c4]" />
        <div className="absolute inset-0 touch-none overscroll-none">
          {canvas}
        </div>
        {picker ? (
          <div className="pointer-events-none absolute inset-x-0 top-[max(4.75rem,calc(env(safe-area-inset-top,0px)+3.75rem))] z-10 flex justify-center px-4 md:top-24">
            <div className="pointer-events-auto w-full max-w-lg">{picker}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {floorBar}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {legendHint ??
          "Drag to orbit · tap a floor on the building · Ground is lobby, bistro, spa and steam · First is restaurant and meeting."}
        {guestOnFloor.length > 0 ? (
          <span className="ml-1 font-medium text-foreground">
            Floor {floor} {wing}: {guestOnFloor.map((u) => u.label).join(", ")}
          </span>
        ) : null}
      </p>
      {picker}
      <div className="relative h-[min(70dvh,560px)] min-h-[280px] w-full overflow-hidden rounded-xl border bg-gradient-to-b from-mist-1/80 via-card to-muted/40">
        {canvas}
      </div>
    </div>
  );
}

function FacadeScene({
  floor,
  wing,
  onBandClick,
  selectedCount,
  hero = false,
  narrow = false,
}: {
  floor: string;
  wing: "front" | "back";
  onBandClick: (key: FloorKey) => void;
  selectedCount: number;
  hero?: boolean;
  narrow?: boolean;
}) {
  const texture = useTexture(FACADE_TEXTURE_SRC);
  const { camera } = useThree();
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  const [autoRotate, setAutoRotate] = useState(hero);

  useEffect(() => {
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAutoRotate(false);
    }
  }, [hero]);

  useEffect(() => {
    if (!hero) return;
    const persp = camera as THREE.PerspectiveCamera;
    if (narrow) {
      persp.position.set(35, 58, 155);
      persp.fov = 48;
    } else {
      persp.position.set(90, 70, 175);
      persp.fov = 40;
    }
    persp.updateProjectionMatrix();
  }, [camera, hero, narrow]);

  const showBack =
    wing === "back" && isFloorKey(floor) && !PUBLIC_FLOOR.has(floor);

  return (
    <>
      <group position={[0, hero && narrow ? 22 : 0, 0]}>
      <ambientLight intensity={0.9} />
      <directionalLight intensity={1.05} position={[120, 220, 160]} />
      <hemisphereLight args={["#e0f2fe", "#78716c", 0.4]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[W * 2.2, D * 2.4]} />
        <meshStandardMaterial color="#d6d3d1" roughness={1} />
      </mesh>

      <mesh position={[8, H / 2 - 8, -D / 2 + 6]}>
        <boxGeometry args={[W * 0.72, H * 0.88, D * 0.92]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.92} />
      </mesh>
      <mesh position={[-W * 0.38, H / 2 - 4, -12]}>
        <boxGeometry args={[28, H * 0.78, 36]} />
        <meshStandardMaterial color="#1c1917" roughness={0.45} metalness={0.12} />
      </mesh>
      <mesh position={[4, H - 6, -18]} rotation={[0.04, 0, 0]}>
        <boxGeometry args={[W * 0.82, 10, D * 0.7]} />
        <meshStandardMaterial color="#3f2e2a" roughness={0.7} />
      </mesh>

      <mesh position={[0, H / 2, D / 2 - 2]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.12}
          roughness={0.55}
          metalness={0.04}
          side={THREE.FrontSide}
        />
      </mesh>

      {FLOOR_ORDER.map((key) => {
        const band = FLOOR_UV[key];
        const y0 = band.v0 * H - H / 2;
        const y1 = band.v1 * H - H / 2;
        const mid = (y0 + y1) / 2;
        const ht = Math.max(8, y1 - y0);
        const highlight = floor === key;
        return (
          <mesh
            key={key}
            position={[0, H / 2 + mid, D / 2 + 1.5]}
            onClick={(e) => {
              e.stopPropagation();
              onBandClick(key);
            }}
            onPointerOver={() => {
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <planeGeometry args={[W * 0.92, ht]} />
            <meshBasicMaterial
              color={highlight ? "#f59e0b" : "#0ea5e9"}
              transparent
              opacity={highlight ? 0.2 : hero ? 0 : 0.07}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {showBack ? (
        <mesh position={[0, H / 2, -D / 2 - 1]}>
          <planeGeometry args={[W * 0.7, H * 0.82]} />
          <meshStandardMaterial color="#e7e5e4" roughness={0.9} />
        </mesh>
      ) : null}

      {floor !== "All" ? (
        <Html
          position={[0, H + 18, 0]}
          center
          distanceFactor={280}
          style={{ pointerEvents: "none" }}
        >
          <span className="rounded bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm">
            {floor === "G"
              ? "Ground"
              : floor === "1"
                ? "First"
                : `Floor ${floor}`}
            {selectedCount ? ` · ${selectedCount} rooms` : ""}
          </span>
        </Html>
      ) : null}

      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        enableRotate
        enableZoom
        autoRotate={hero && autoRotate}
        autoRotateSpeed={0.45}
        minDistance={hero ? (narrow ? 95 : 120) : 180}
        maxDistance={hero ? 480 : 720}
        minPolarAngle={0.28}
        maxPolarAngle={Math.PI / 2 - 0.06}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        {...(hero
          ? {}
          : {
              minAzimuthAngle: -Math.PI * 0.92,
              maxAzimuthAngle: Math.PI * 0.92,
            })}
        target={[0, H * (hero ? (narrow ? 0.5 : 0.36) : 0.42), 0]}
        onStart={() => {
          if (hero) setAutoRotate(false);
        }}
      />
    </>
  );
}
