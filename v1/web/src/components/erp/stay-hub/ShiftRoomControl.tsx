"use client";

import {
  listInHouseShiftRooms,
  previewInHouseRoomUpgrade,
  shiftInHouseRoom,
  type ShiftRoomListState,
  type ShiftUpgradePreview,
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
import {
  upgradeNeedsManagerPin,
  type ShiftBillChoice,
} from "@/lib/folio/room-shift";
import { formatGuestBtn } from "@/lib/pricing";
import { toast } from "sonner";
import { useEffect, useState } from "react";

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
  const [preview, setPreview] = useState<Extract<ShiftUpgradePreview, { ok: true }> | null>(
    null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [choice, setChoice] = useState<ShiftBillChoice>("complimentary");
  const [topUp, setTopUp] = useState("");
  const [reason, setReason] = useState("");
  const [managerPin, setManagerPin] = useState("");

  async function openPicker() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setUnitId("");
    setPreview(null);
    setChoice("complimentary");
    setTopUp("");
    setReason("");
    setManagerPin("");
    const result = await listInHouseShiftRooms(assignmentId);
    setLoading(false);
    if (!result.ok) {
      setList(null);
      setError(result.error);
      return;
    }
    setList(result);
  }

  useEffect(() => {
    if (!open || !unitId) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    void previewInHouseRoomUpgrade(assignmentId, unitId).then((result) => {
      if (cancelled) return;
      setPreviewLoading(false);
      if (!result.ok) {
        setPreview(null);
        setPreviewError(result.error);
        return;
      }
      setPreview(result);
      setChoice("complimentary");
      setTopUp(String(result.balanceChangeBtn));
    });
    return () => {
      cancelled = true;
    };
  }, [open, unitId, assignmentId]);

  const selected = list?.rooms.find((room) => room.id === unitId) ?? null;
  const topUpAmount = Number(topUp);
  const topUpOk = Number.isFinite(topUpAmount);
  const needsPin =
    preview != null &&
    preview.chargeable &&
    upgradeNeedsManagerPin({
      choice,
      suggestedBalanceBtn: preview.balanceChangeBtn,
      topUpBalanceBtn: choice === "top_up" && topUpOk ? topUpAmount : 0,
    });
  const freeCount = list?.rooms.filter((room) => room.free).length ?? 0;
  const canMove =
    Boolean(selected?.free) &&
    !previewLoading &&
    preview != null &&
    (choice === "complimentary" || (preview.chargeable && topUpOk)) &&
    (!needsPin || (reason.trim().length >= 3 && managerPin.trim().length > 0));

  async function move() {
    if (!unitId || !canMove) return;
    setSaving(true);
    const result = await shiftInHouseRoom(assignmentId, unitId, {
      choice,
      topUpBalanceBtn: choice === "top_up" ? topUpAmount : 0,
      reason: reason.trim() || undefined,
      managerPin: managerPin.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    onMoved(result.assignmentId);
  }

  const moveLabel =
    choice === "top_up" && topUpOk && topUpAmount > 0.5
      ? "Move and add to bill"
      : choice === "top_up" && topUpOk && topUpAmount < -0.5
        ? "Move and credit bill"
        : "Move guest";

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
        <DialogContent layer="nested" className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shift room</DialogTitle>
            <DialogDescription>
              {list
                ? list.mode === "split"
                  ? `Nights already charged stay on ${list.fromLabel}. From ${list.shiftDate} the guest is in the new room. Meals stay as booked.`
                  : `The whole stay moves, including today's room charge. Meals stay as booked.`
                : "Pick a free room for the rest of this stay."}
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking free rooms…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : list ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium" htmlFor="shift-room">
                Free rooms
                {list.fromView
                  ? ` · now ${list.fromLabel} (${list.fromView})`
                  : ` · now ${list.fromLabel}`}
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
                  No room is free through checkout. A room that checked out this morning shows once that stay has ended.
                </p>
              ) : null}
              {selected?.reason === "Needs clean" ? (
                <p className="text-xs text-muted-foreground">
                  {selected.label} still needs a clean before the guest goes in. {list.fromLabel} goes to housekeeping as dirty.
                </p>
              ) : selected ? (
                <p className="text-xs text-muted-foreground">
                  {list.fromLabel} goes to housekeeping as dirty. View rooms are listed first.
                </p>
              ) : null}

              {previewLoading ? (
                <p className="text-sm text-muted-foreground">Pricing the new room…</p>
              ) : previewError ? (
                <p className="text-sm text-destructive">{previewError}</p>
              ) : preview ? (
                <div className="space-y-2 rounded-md border border-border/70 p-3">
                  <p className="text-sm">
                    Quoted {formatGuestBtn(preview.quotedGuestNightly)} / night
                    {" · "}
                    New room {formatGuestBtn(preview.newGuestNightly)} / night
                    {" · "}
                    {preview.nights} night{preview.nights === 1 ? "" : "s"} left
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {preview.samePrice
                      ? "Same price as the quote. The bill does not change."
                      : preview.nightlyGapBtn > 0
                        ? `Upgrade gap ${formatGuestBtn(preview.nightlyGapBtn)} / night · ${formatGuestBtn(preview.balanceChangeBtn)} for the nights left.`
                        : `New room is ${formatGuestBtn(Math.abs(preview.nightlyGapBtn))} less / night.`}
                    {!preview.tariffKnown
                      ? " No tariff on this rate plan — the quoted rate stays."
                      : ""}
                    {!preview.chargeable ? " This room is non-chargeable." : ""}
                  </p>
                  <div className="grid gap-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="shift-bill"
                        className="mt-1"
                        checked={choice === "complimentary"}
                        onChange={() => setChoice("complimentary")}
                      />
                      <span>
                        Complimentary
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Guest keeps the quoted rate. Nothing extra on the bill.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="shift-bill"
                        className="mt-1"
                        checked={choice === "top_up"}
                        disabled={!preview.chargeable || !preview.tariffKnown}
                        onChange={() => setChoice("top_up")}
                      />
                      <span>
                        Add to the bill
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Tops up the balance by the gap on the quoted rate, for the nights still left. You can change the figure.
                        </span>
                      </span>
                    </label>
                  </div>
                  {choice === "top_up" ? (
                    <label className="block text-xs font-medium" htmlFor="shift-topup">
                      Balance change (Nu)
                      <input
                        id="shift-topup"
                        type="number"
                        step="1"
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={topUp}
                        onChange={(event) => setTopUp(event.target.value)}
                      />
                      <span className="mt-1 block font-normal text-muted-foreground">
                        Suggested {formatGuestBtn(preview.balanceChangeBtn)}. A lower figure, or a complimentary upgrade, needs a manager PIN. Later room nights stay at the quoted rate so this is not charged twice.
                      </span>
                    </label>
                  ) : null}
                  {needsPin ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-xs font-medium" htmlFor="shift-reason">
                        Reason
                        <input
                          id="shift-reason"
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="View upgrade, guest request"
                        />
                      </label>
                      <label className="block text-xs font-medium" htmlFor="shift-pin">
                        Manager PIN
                        <input
                          id="shift-pin"
                          type="password"
                          autoComplete="off"
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
                          value={managerPin}
                          onChange={(event) => setManagerPin(event.target.value)}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
              disabled={saving || !canMove}
            >
              {saving ? "Moving…" : moveLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
