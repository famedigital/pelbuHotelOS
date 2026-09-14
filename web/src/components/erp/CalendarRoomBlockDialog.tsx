"use client";

import {
  createCalendarRoomBlock,
  type CalendarBookState,
} from "@/app/actions/erp-calendar";
import type { RackUnit } from "@/components/erp/RoomRackGrid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

const initial: CalendarBookState = { ok: false };
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CalendarRoomBlockDialog({
  unit,
  open,
  onOpenChange,
  start,
}: {
  unit: RackUnit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createCalendarRoomBlock,
    initial,
  );
  const [kind, setKind] = useState("ooo");
  const [fromDate, setFromDate] = useState(start);
  const [toDate, setToDate] = useState(addDays(start, 1));
  const [reason, setReason] = useState("");
  useActionToast(state, { successMessage: state.message ?? "Room blocked" });

  useEffect(() => {
    if (!unit) return;
    setKind("ooo");
    setFromDate(start);
    setToDate(addDays(start, 1));
    setReason("");
  }, [start, unit]);

  useEffect(() => {
    if (state.ok && open) {
      onOpenChange(false);
      router.refresh();
    }
  }, [onOpenChange, open, router, state.ok]);

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block room {unit.label}</DialogTitle>
          <DialogDescription>
            {unit.room_type_name} · blocks prevent reservations and assignments
            for the selected nights.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="room_unit_id" value={unit.id} />
          <div className="space-y-1.5">
            <Label htmlFor="block_kind">Block type</Label>
            <select
              id="block_kind"
              name="block_kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className={selectClass}
            >
              <option value="ooo">Out of order — maintenance</option>
              <option value="oos">Out of service — temporary</option>
              <option value="hold">Operational hold</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block_from_date">From</Label>
              <Input
                id="block_from_date"
                name="from_date"
                type="date"
                value={fromDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setFromDate(next);
                  if (toDate <= next) setToDate(addDays(next, 1));
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block_to_date">To</Label>
              <Input
                id="block_to_date"
                name="to_date"
                type="date"
                min={addDays(fromDate, 1)}
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block_reason">Reason</Label>
            <Input
              id="block_reason"
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Plumbing repair, owner hold…"
              required
            />
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
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="citrus" disabled={pending}>
              {pending ? "Blocking…" : "Create block"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
