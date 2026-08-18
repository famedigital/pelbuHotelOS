"use client";

import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import type {
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import { amenityKindToFilter } from "@/lib/gallery-showcase";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const HotelFacadeExplore = dynamic(
  () =>
    import("@/components/site/HotelFacadeExplore").then(
      (m) => m.HotelFacadeExplore,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[min(60vh,480px)] w-full items-center justify-center bg-gradient-to-b from-sky-100/80 via-[#f4efe6] to-[#e4dccf] text-sm text-muted-foreground">
        Loading Pelbu Suites…
      </div>
    ),
  },
);

const AMENITY_HREF: Record<string, string> = {
  restaurant: "/restaurant",
  cafe: "/cafe",
  bar: "/bar",
  lobby: "/contact",
  reception: "/contact",
  spa: "/spa",
  steam: "/spa",
  meeting: "/meeting",
};

type Props = {
  units: RoomMapUnit[];
  layout: PropertyBuildingLayout;
  spaces: Array<BuildingSpace & { id: string }>;
  typeHrefByCode: Record<string, string>;
  selectedUnitIds?: string[];
  legendHint?: string;
  variant?: "page" | "hero";
  onSelectRoom?: (unit: RoomMapUnit) => void;
  onSelectSpace?: (space: BuildingSpace & { id: string }) => void;
  onSelectFloorWing?: (floorKey: string, wing: "front" | "back") => void;
};

/**
 * Public 3D — architectural facade of Pelbu Suites Olakha.
 */
export function PublicBuildingExplore({
  units,
  layout,
  spaces,
  typeHrefByCode,
  selectedUnitIds,
  legendHint,
  variant = "page",
  onSelectRoom,
  onSelectSpace,
  onSelectFloorWing,
}: Props) {
  const router = useRouter();

  const handleRoom = useCallback(
    (unit: RoomMapUnit) => {
      if (onSelectRoom) {
        onSelectRoom(unit);
        return;
      }
      const code = unit.room_type_code;
      const href =
        typeHrefByCode[code] ??
        (code ? `/rooms/${code.toLowerCase()}` : "/rooms");
      router.push(href);
    },
    [onSelectRoom, router, typeHrefByCode],
  );

  const handleSpace = useCallback(
    (space: BuildingSpace & { id: string }) => {
      if (onSelectSpace) {
        onSelectSpace(space);
        return;
      }
      const kind = amenityKindToFilter(space.kind);
      const href = kind ? AMENITY_HREF[kind] : null;
      if (href) router.push(href);
    },
    [onSelectSpace, router],
  );

  return (
    <HotelFacadeExplore
      units={units}
      layout={layout}
      spaces={spaces}
      selectedUnitIds={selectedUnitIds}
      variant={variant}
      onSelectRoom={handleRoom}
      onSelectSpace={handleSpace}
      onSelectFloorWing={onSelectFloorWing}
      legendHint={
        legendHint ??
        "Orbit the house — tap Ground for lobby, bistro, spa and steam; First for restaurant and meeting; floors 2–5 for guest rooms."
      }
    />
  );
}
