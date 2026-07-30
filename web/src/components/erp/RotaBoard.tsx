"use client";

import { deleteRotaShift, saveRotaShift } from "@/app/actions/erp-rota";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

export type RotaStaff = {
  id: string;
  full_name: string;
  role_label: string;
  department: string | null;
};

export type RotaShift = {
  id: string;
  staff_id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  outlet: string | null;
  status: string;
  notes: string | null;
};

const OUTLETS = [
  "front_desk",
  "cafe",
  "pastry",
  "restaurant",
  "bar",
  "spa",
  "housekeeping",
  "maintenance",
  "security",
  "admin",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const initialState = { ok: false } as const;

function hhmm(value: string): string {
  return value.slice(0, 5);
}

type CellTarget = {
  staff: RotaStaff;
  date: string;
  shift: RotaShift | null;
};

export function RotaBoard({
  staff,
  shifts,
  days,
}: {
  staff: RotaStaff[];
  shifts: RotaShift[];
  days: string[];
}) {
  const [target, setTarget] = useState<CellTarget | null>(null);

  const byCell = new Map<string, RotaShift[]>();
  for (const shift of shifts) {
    const key = `${shift.staff_id}:${shift.shift_date}`;
    const list = byCell.get(key) ?? [];
    list.push(shift);
    byCell.set(key, list);
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 p-3 text-left font-semibold">
              Staff
            </th>
            {days.map((date, index) => (
              <th key={date} className="p-2 text-center font-semibold">
                <div>{DAY_LABELS[index]}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {date.slice(5)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-6 text-center text-muted-foreground">
                No active staff to schedule.
              </td>
            </tr>
          ) : (
            staff.map((member) => (
              <tr key={member.id} className="border-t">
                <td className="sticky left-0 z-10 bg-background p-3 align-top">
                  <p className="font-medium">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.department || member.role_label}
                  </p>
                </td>
                {days.map((date) => {
                  const cellShifts = byCell.get(`${member.id}:${date}`) ?? [];
                  return (
                    <td key={date} className="p-1 align-top">
                      <div className="flex min-h-16 flex-col gap-1">
                        {cellShifts.map((shift) => (
                          <button
                            key={shift.id}
                            type="button"
                            onClick={() =>
                              setTarget({ staff: member, date, shift })
                            }
                            className={`rounded-md border px-2 py-1 text-left text-xs ${
                              shift.status === "published"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                : "border-amber-300 bg-amber-50 text-amber-900"
                            }`}
                          >
                            <span className="font-medium">
                              {hhmm(shift.starts_at)}–{hhmm(shift.ends_at)}
                            </span>
                            {shift.outlet ? (
                              <span className="block text-[10px] opacity-80">
                                {shift.outlet}
                              </span>
                            ) : null}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setTarget({ staff: member, date, shift: null })
                          }
                          className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          + add
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {target ? (
        <ShiftDialog target={target} onClose={() => setTarget(null)} />
      ) : null}
    </div>
  );
}

function ShiftDialog({
  target,
  onClose,
}: {
  target: CellTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saveState, save] = useActionState(saveRotaShift, initialState);
  const [deleteState, remove] = useActionState(deleteRotaShift, initialState);
  const shift = target.shift;

  useEffect(() => {
    if (saveState.ok || deleteState.ok) {
      router.refresh();
      onClose();
    }
  }, [saveState.ok, deleteState.ok, router, onClose]);

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {shift ? "Edit shift" : "Add shift"} — {target.staff.full_name}
          </DialogTitle>
        </DialogHeader>
        <form action={save} className="space-y-3">
          {shift ? <input type="hidden" name="id" value={shift.id} /> : null}
          <input type="hidden" name="staff_id" value={target.staff.id} />
          <input type="hidden" name="shift_date" value={target.date} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="starts_at">Start</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="time"
                required
                defaultValue={shift ? hhmm(shift.starts_at) : "09:00"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ends_at">End</Label>
              <Input
                id="ends_at"
                name="ends_at"
                type="time"
                required
                defaultValue={shift ? hhmm(shift.ends_at) : "17:00"}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="outlet">Outlet / section</Label>
            <select
              id="outlet"
              name="outlet"
              defaultValue={shift?.outlet ?? ""}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— none —</option>
              {OUTLETS.map((outlet) => (
                <option key={outlet} value={outlet}>
                  {outlet.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={shift?.notes ?? ""}
            />
          </div>

          {saveState.error ? (
            <p className="text-sm text-destructive">{saveState.error}</p>
          ) : null}
          {deleteState.error ? (
            <p className="text-sm text-destructive">{deleteState.error}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {shift ? (
              <Button
                type="submit"
                variant="destructive"
                formAction={remove}
                name="id"
                value={shift.id}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit">{shift ? "Save changes" : "Add shift"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
