"use client";

import {
  saveRoomUnitSettings,
} from "@/app/actions/erp-settings";
import type { PropertyWizardState } from "@/app/actions/erp-properties";
import type { RackUnit } from "@/components/erp/RoomRackGrid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState, useEffect, useState } from "react";

const initialState: PropertyWizardState = { ok: false };

export function CalendarRoomUnitEditDialog({
  unit,
  propertyId,
  open,
  onOpenChange,
  peerUnits = [],
}: {
  unit: RackUnit | null;
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerUnits?: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    saveRoomUnitSettings,
    initialState,
  );
  const [label, setLabel] = useState("");
  const [floorLabel, setFloorLabel] = useState("");
  const [viewLabel, setViewLabel] = useState("");
  const [hasBalcony, setHasBalcony] = useState(false);
  const [connectingId, setConnectingId] = useState("");
  const wasPending = React.useRef(false);

  useEffect(() => {
    if (!unit || !open) return;
    setLabel(unit.label);
    setFloorLabel(unit.floor_label ?? "");
    setViewLabel(unit.view_label ?? "");
    setHasBalcony(unit.has_balcony);
    setConnectingId(unit.connecting_room_unit_id ?? "");
  }, [unit, open]);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok && open) {
      router.refresh();
      onOpenChange(false);
    }
    wasPending.current = pending;
  }, [pending, state.ok, open, onOpenChange, router]);

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-w-md">
        <DialogHeader>
          <DialogTitle>Edit room</DialogTitle>
          <DialogDescription>
            {unit.room_type_name} · updates the calendar rack immediately.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="property_id" value={propertyId} />
          <input type="hidden" name="room_unit_id" value={unit.id} />
          <input type="hidden" name="room_type_id" value={unit.room_type_id} />
          <input type="hidden" name="sort_order" value={String(unit.sort_order)} />

          <div className="space-y-1.5">
            <Label htmlFor="rack-room-label">Room label</Label>
            <Input
              id="rack-room-label"
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rack-room-floor">Floor</Label>
              <Input
                id="rack-room-floor"
                name="floor_label"
                value={floorLabel}
                onChange={(e) => setFloorLabel(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rack-room-view">View</Label>
              <Input
                id="rack-room-view"
                name="view_label"
                value={viewLabel}
                onChange={(e) => setViewLabel(e.target.value)}
                placeholder="Valley"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={hasBalcony}
              onCheckedChange={(v) => setHasBalcony(v === true)}
            />
            <input
              type="hidden"
              name="has_balcony"
              value={hasBalcony ? "on" : ""}
            />
            Has balcony
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="rack-connecting">Connecting room</Label>
            <select
              id="rack-connecting"
              name="connecting_room_unit_id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={connectingId}
              onChange={(e) => setConnectingId(e.target.value)}
            >
              <option value="">None</option>
              {peerUnits
                .filter((p) => p.id !== unit.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>

          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
