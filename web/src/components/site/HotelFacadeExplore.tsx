"use client";

import { Button } from "@/components/ui/button";
import { splitOlakhaFloorWings } from "@/lib/building/olakha-wings";
import type {
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useMemo, useState } from "react";
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

type Props = {
  units: RoomMapUnit[];
  layout: PropertyBuildingLayout;
  spaces: Array<BuildingSpace & { id: string }>;
  selectedUnitIds?: string[];
  legendHint?: string | null;
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
  onSelectRoom,
  onSelectSpace,
  onSelectFloorWing,
}: Props) {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {["All", ...FLOOR_ORDER].map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={floor === key ? "default" : "outline"}
            className="h-11 min-w-11"
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
            {floorTabLabel(key, layout)}
          </Button>
        ))}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={wing === "front" ? "default" : "outline"}
            className="h-11"
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
            className="h-11"
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

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {legendHint ??
          "Drag to orbit · tap a floor on the building · Ground is lobby, bistro, spa and steam · First is restaurant and meeting."}
        {guestOnFloor.length > 0 ? (
          <span className="ml-1 font-medium text-foreground">
            Floor {floor} {wing}: {guestOnFloor.map((u) => u.label).join(", ")}
          </span>
        ) : null}
      </p>

      {pickerFloor ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-secondary/40 p-3">
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
      ) : null}

      <div className="relative h-[min(70vh,560px)] w-full overflow-hidden rounded-xl border bg-gradient-to-b from-sky-100/50 via-card to-muted/40">
        <Canvas
          className="!touch-none"
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [220, 140, 260], fov: 38, near: 1, far: 4000 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <Suspense fallback={null}>
            <FacadeScene
              floor={floor}
              wing={wing}
              onBandClick={onBandClick}
              selectedCount={selectedUnitIds.length}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}

function FacadeScene({
  floor,
  wing,
  onBandClick,
  selectedCount,
}: {
  floor: string;
  wing: "front" | "back";
  onBandClick: (key: FloorKey) => void;
  selectedCount: number;
}) {
  const texture = useTexture(FACADE_TEXTURE_SRC);
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  const showBack =
    wing === "back" && isFloorKey(floor) && !PUBLIC_FLOOR.has(floor);

  return (
    <>
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
              opacity={highlight ? 0.22 : 0.07}
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

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={180}
        maxDistance={720}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.08}
        minAzimuthAngle={-Math.PI * 0.92}
        maxAzimuthAngle={Math.PI * 0.92}
        target={[0, H * 0.42, 0]}
      />
    </>
  );
}
