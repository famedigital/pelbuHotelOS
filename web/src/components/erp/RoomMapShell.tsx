"use client";

import { RoomBuilding3D } from "@/components/erp/RoomBuilding3D";
import { RoomDossierSheet } from "@/components/erp/RoomDossierSheet";
import { RoomFloorPlan } from "@/components/erp/RoomFloorPlan";
import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

export type { RoomMapUnit } from "@/components/erp/room-map-shared";

type ViewMode = "building" | "plan";

export function RoomMapShell({ units }: { units: RoomMapUnit[] }) {
  const defaultMode = useMemo<ViewMode>(() => {
    const hasCoords = units.some((u) => u.pos_x != null && u.pos_y != null);
    return hasCoords ? "building" : "plan";
  }, [units]);

  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          <Button
            type="button"
            size="sm"
            variant={mode === "building" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setMode("building")}
          >
            Building
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "plan" ? "default" : "ghost"}
            className="h-8"
            onClick={() => setMode("plan")}
          >
            Plan
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "building"
            ? "Isometric massing — orbit and click. Rearrange in Plan."
            : "Top-down plan — drag rooms to place, then save."}
        </p>
      </div>

      {mode === "building" ? (
        <RoomBuilding3D units={units} onOpenRoom={setSelectedId} />
      ) : (
        <RoomFloorPlan units={units} onOpenRoom={setSelectedId} />
      )}

      <RoomDossierSheet
        unitId={selectedId}
        units={units}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
