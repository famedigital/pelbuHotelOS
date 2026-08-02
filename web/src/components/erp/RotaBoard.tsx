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
import { freeStaffFilter, type ShiftInterval } from "@/lib/rota/overlap";
import { formatShiftOutlet, SHIFT_OUTLETS } from "@/lib/shift-outlets";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

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

const OUTLETS = SHIFT_OUTLETS;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const initialState = { ok: false } as const;

function hhmm(value: string): string {
  return value.slice(0, 5);
}

type CellTarget = {
  staff: RotaStaff | null;
  date: string;
  shift: RotaShift | null;
  defaultStarts?: string;
  defaultEnds?: string;
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
  const [mobileDay, setMobileDay] = useState(days[0] ?? "");

  useEffect(() => {
    if (days.length && !days.includes(mobileDay)) {
      setMobileDay(days[0]);
    }
  }, [days, mobileDay]);

  const intervals: ShiftInterval[] = useMemo(
    () =>
      shifts.map((shift) => ({
        id: shift.id,
        staffId: shift.staff_id,
        shiftDate: shift.shift_date,
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
        status: shift.status,
      })),
    [shifts],
  );

  const byCell = new Map<string, RotaShift[]>();
  for (const shift of shifts) {
    const key = `${shift.staff_id}:${shift.shift_date}`;
    const list = byCell.get(key) ?? [];
    list.push(shift);
    byCell.set(key, list);
  }

  const dayShifts = shifts
    .filter((s) => s.shift_date === mobileDay)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <div className="space-y-4">
      {/* Mobile: day chips + per-day list */}
      <div className="md:hidden space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((date, index) => (
            <button
              key={date}
              type="button"
              onClick={() => setMobileDay(date)}
              className={`h-11 min-w-14 shrink-0 rounded-lg border px-3 text-center text-xs ${
                mobileDay === date
                  ? "border-accent bg-accent/15 font-semibold"
                  : "bg-background text-muted-foreground"
              }`}
            >
              <div>{DAY_LABELS[index]}</div>
              <div>{date.slice(5)}</div>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {dayShifts.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No shifts on this day.
            </p>
          ) : (
            dayShifts.map((shift) => {
              const member = staff.find((s) => s.id === shift.staff_id);
              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() =>
                    setTarget({
                      staff: member ?? null,
                      date: shift.shift_date,
                      shift,
                    })
                  }
                  className={`flex min-h-14 w-full flex-col rounded-lg border px-3 py-3 text-left text-sm ${
                    shift.status === "published"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <span className="font-medium">
                    {member?.full_name ?? "Staff"} · {hhmm(shift.starts_at)}–
                    {hhmm(shift.ends_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shift.outlet ? formatShiftOutlet(shift.outlet) : "No outlet"} ·{" "}
                    {shift.status}
                  </span>
                </button>
              );
            })
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() =>
              setTarget({
                staff: null,
                date: mobileDay,
                shift: null,
              })
            }
          >
            + Add shift for {mobileDay}
          </Button>
        </div>
      </div>

      {/* Desktop week grid */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
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
                              className={`rounded-md border px-2 py-1 text-left text-xs min-h-11 ${
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
                                  {formatShiftOutlet(shift.outlet)}
                                </span>
                              ) : null}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setTarget({ staff: member, date, shift: null })
                            }
                            className="min-h-11 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
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
      </div>

      {target ? (
        <ShiftDialog
          target={target}
          staff={staff}
          intervals={intervals}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </div>
  );
}

function ShiftDialog({
  target,
  staff,
  intervals,
  onClose,
}: {
  target: CellTarget;
  staff: RotaStaff[];
  intervals: ShiftInterval[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saveState, save] = useActionState(saveRotaShift, initialState);
  const [deleteState, remove] = useActionState(deleteRotaShift, initialState);
  const shift = target.shift;
  const [startsAt, setStartsAt] = useState(
    shift ? hhmm(shift.starts_at) : target.defaultStarts ?? "09:00",
  );
  const [endsAt, setEndsAt] = useState(
    shift ? hhmm(shift.ends_at) : target.defaultEnds ?? "17:00",
  );
  const [staffId, setStaffId] = useState(
    target.staff?.id ?? shift?.staff_id ?? "",
  );

  const freeOptions = useMemo(
    () =>
      freeStaffFilter(
        staff,
        {
          shiftDate: target.date,
          startsAt,
          endsAt,
        },
        intervals,
        {
          ignoreId: shift?.id,
          includeStaffId: shift?.staff_id ?? target.staff?.id,
        },
      ),
    [staff, target.date, startsAt, endsAt, intervals, shift?.id, shift?.staff_id, target.staff?.id],
  );

  useEffect(() => {
    if (saveState.ok || deleteState.ok) {
      router.refresh();
      onClose();
    }
  }, [saveState.ok, deleteState.ok, router, onClose]);

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="erp max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {shift ? "Edit shift" : "Add shift"}
            {target.staff ? ` — ${target.staff.full_name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form action={save} className="space-y-3">
          {shift ? <input type="hidden" name="id" value={shift.id} /> : null}
          <input type="hidden" name="shift_date" value={target.date} />

          <div className="space-y-1">
            <Label htmlFor="staff_id">Staff</Label>
            <select
              id="staff_id"
              name="staff_id"
              required
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Select free staff…
              </option>
              {freeOptions.map((member) => (
                <option key={member.id} value={member.id} disabled={member.busy}>
                  {member.full_name}
                  {member.busy ? " (busy)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Busy staff for this time window are disabled.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="starts_at">Start</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="time"
                required
                className="h-11"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ends_at">End</Label>
              <Input
                id="ends_at"
                name="ends_at"
                type="time"
                required
                className="h-11"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="outlet">Outlet / section</Label>
            <select
              id="outlet"
              name="outlet"
              defaultValue={shift?.outlet ?? ""}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— none —</option>
              {OUTLETS.map((outlet) => (
                <option key={outlet} value={outlet}>
                  {formatShiftOutlet(outlet)}
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
                className="h-11"
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" className="h-11">
              {shift ? "Save changes" : "Add shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
