"use client";

import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import type {
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const BuildingScene3D = dynamic(
  () =>
    import("@/components/erp/building/BuildingScene3D").then(
      (m) => m.BuildingScene3D,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(60vh,480px)] items-center justify-center rounded-xl border border-border bg-secondary/30 text-sm text-muted-foreground">
        Loading building…
      </div>
    ),
  },
);

type Props = {
  units: RoomMapUnit[];
  layout: PropertyBuildingLayout;
  spaces: Array<BuildingSpace & { id: string }>;
  typeHrefByCode: Record<string, string>;
};

/**
 * Marketing massing — type colours only, no ops status.
 */
export function PublicBuildingExplore({
  units,
  layout,
  spaces,
  typeHrefByCode,
}: Props) {
  const router = useRouter();

  const onOpenRoom = useCallback(
    (unitId: string) => {
      const unit = units.find((u) => u.id === unitId);
      if (!unit) return;
      const code = unit.room_type_code;
      const href = typeHrefByCode[code] ?? (code ? `/rooms/${code.toLowerCase()}` : "/rooms");
      router.push(href);
    },
    [router, typeHrefByCode, units],
  );

  return (
    <BuildingScene3D
      units={units}
      layout={layout}
      spaces={spaces}
      mode="public"
      onOpenRoom={onOpenRoom}
      typeHrefByCode={typeHrefByCode}
      legendHint="How the house sits — orbit and click a room type to open details."
    />
  );
}
