"use client";

import {
  listInHouseShiftRooms,
  shiftInHouseRoom,
  type ShiftRoomListState,
} from "@/app/actions/erp-room-shift";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";

function roomOptionLabel(room: {
  label: string;
  floorLabel: string | null;
  viewLabel: string | null;
  typeName: string;
  hkStatus: string;
  sameCategory: boolean;
  reason: string | null;
}): string {
  const view = room.viewLabel ?? "No view";
  const floor = room.floorLabel ? ` · ${room.floorLabel}` : "";
  const category = room.sameCategory ? "" : " · different category";
  const note = room.reason ? ` · ${room.reason}` : ` · ${room.hkStatus}`;
  return `${room.label}${floor} · ${view} · ${room.typeName}${category}${note}`;
}

export function ShiftRoomControl({
  assignmentId,
  onMoved,
}: {
  assignmentId: string;
  onMoved: (assignmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<Extract<ShiftRoomListState, { ok: true }> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [unitId, setUnitId] = useState("");

  async function openPicker() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setUnitId("");
    const result = await listInHouseShiftRooms(assignmentId);
    setLoading(false);
    if (!result.ok) {
      setList(null);
      setError(result.error);
      return;
    }
    setList(result);
  }

  const selected = list?.rooms.find((room) => room.id === unitId) ?? null;

  async function move() {
    if (!unitId || !selected?.free) return;
    setSaving(true);
    const result = await shiftInHouseRoom(assignmentId, unitId);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    onMoved(result.assignmentId);
  }

  const freeCount = list?.rooms.filter((room) => room.free).length ?? 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-7 px-2 text-[11px]"
        onClick={() => void openPicker()}
      >
        Shift room
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent layer="nested" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shift room</DialogTitle>
            <DialogDescription>
              {list
                ? list.mode === "split"
                  ? `Nights already charged stay on ${list.fromLabel}. From ${list.shiftDate} the guest is in the room you pick, through ${list.checkOut}.`
                  : `This guest has not stayed a previous night here. The whole stay moves, including today's room charge.`
                : "Pick a free room for the rest of this stay."}
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking free rooms…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : list ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium" htmlFor="shift-room">
                Free rooms
                {list.fromView ? ` · now ${list.fromLabel} (${list.fromView})` : ` · now ${list.fromLabel}`}
              </label>
              <select
                id="shift-room"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
              >
                <option value="">Select a room…</option>
                {list.rooms.map((room) => (
                  <option key={room.id} value={room.id} disabled={!room.free}>
                    {roomOptionLabel(room)}
                  </option>
                ))}
              </select>
              {freeCount === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No room is free through checkout. A room that checked out this morning should appear once that stay has ended.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  View rooms are listed first. The nightly rate stays as it is
                  {selected && !selected.sameCategory
                    ? ", unless this stay has no agreed rate — then remaining nights follow the new category. Check the bill."
                    : "."}{" "}
                  {selected?.reason === "Needs clean"
                    ? `${selected.label} still needs a clean before the guest goes in.`
                    : `${list.fromLabel} goes to housekeeping as dirty.`}
                </p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void move()}
              disabled={saving || !selected?.free}
            >
              {saving ? "Moving…" : "Move guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
