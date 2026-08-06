"use client";

import {
  createCalendarGroupReservation,
  createCalendarReservation,
  type CalendarBookState,
} from "@/app/actions/erp-calendar";
import { AgentPicker, type BookableAgent } from "@/components/erp/AgentPicker";
import { StaffPicker, type BookableStaff } from "@/components/erp/StaffPicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CalendarAgent = BookableAgent;

export type CalendarSelectedUnit = {
  id: string;
  label: string;
  room_type_name: string;
  room_type_code: string;
};

export type CalendarSelection = {
  checkIn: string;
  checkOut: string;
  units: CalendarSelectedUnit[];
};

const initial: CalendarBookState = { ok: false };

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export type CalendarMealPlan = {
  code: string;
  name: string;
};

type ReservationDraft = {
  groupName: string;
  contactName: string;
  contactPhone: string;
  phoneLater: boolean;
  contactEmail: string;
  adults: string;
  children: string;
  extraBeds: string;
  guideNumber: string;
  guestOrigin: string;
  source: string;
  agentId: string;
  soldByStaffId: string;
  paymentMode: string;
  mealPlanCode: string;
  notes: string;
  mixAcknowledged: boolean;
};

function draftForSelection(
  selection: CalendarSelection,
  defaultMealPlanCode: string,
  defaultSoldByStaffId = "",
): ReservationDraft {
  return {
    groupName: `Group · ${selection.units.length} rooms · ${selection.checkIn}`,
    contactName: "",
    contactPhone: "",
    phoneLater: false,
    contactEmail: "",
    adults: String(Math.max(1, selection.units.length)),
    children: "0",
    extraBeds: "0",
    guideNumber: "",
    guestOrigin: "international",
    source: "reservation",
    agentId: "",
    soldByStaffId: defaultSoldByStaffId,
    paymentMode: "cash",
    mealPlanCode: defaultMealPlanCode,
    notes: "",
    mixAcknowledged: false,
  };
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CalendarReservationDialog({
  open,
  onOpenChange,
  selection,
  agents,
  staff = [],
  defaultSoldByStaffId = "",
  mealPlans,
  defaultMealPlanCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: CalendarSelection | null;
  agents: CalendarAgent[];
  staff?: BookableStaff[];
  defaultSoldByStaffId?: string;
  mealPlans: CalendarMealPlan[];
  defaultMealPlanCode: string;
}) {
  const router = useRouter();
  const stayHub = useStayHubOptional();
  const isGroup = (selection?.units.length ?? 0) > 1;
  const action = isGroup
    ? createCalendarGroupReservation
    : createCalendarReservation;
  const [state, formAction, pending] = useActionState(action, initial);
  const [nightCount, setNightCount] = useState(1);
  const [checkOut, setCheckOut] = useState("");
  const [draft, setDraft] = useState<ReservationDraft | null>(null);
  useActionToast(state, {
    successMessage: state.message ?? "Reservation saved",
  });

  useEffect(() => {
    if (state.ok && open) {
      onOpenChange(false);
      if (state.bookingId && stayHub) {
        stayHub.openStayHub({
          bookingId: state.bookingId,
          step: isGroup ? "reserve" : "check_in",
          agents,
          staff,
        });
      }
      router.refresh();
    }
  }, [
    state.ok,
    state.bookingId,
    open,
    onOpenChange,
    router,
    stayHub,
    agents,
    staff,
    isGroup,
  ]);

  // A new drag selection starts a fresh draft; a rejected submit keeps whatever
  // the user already typed so they never re-enter the whole form.
  useEffect(() => {
    if (!selection) return;
    const nextNights = Math.max(
      1,
      nightsBetween(selection.checkIn, selection.checkOut),
    );
    setNightCount(nextNights);
    setCheckOut(addDays(selection.checkIn, nextNights));
    setDraft(
      draftForSelection(selection, defaultMealPlanCode, defaultSoldByStaffId),
    );
  }, [selection, defaultMealPlanCode, defaultSoldByStaffId]);

  const categoryMix = useMemo(
    () => {
      const counts = new Map<
        string,
        { code: string; name: string; count: number }
      >();
      for (const unit of selection?.units ?? []) {
        const key = unit.room_type_code || unit.room_type_name;
        const current = counts.get(key);
        counts.set(key, {
          code: unit.room_type_code,
          name: unit.room_type_name,
          count: (current?.count ?? 0) + 1,
        });
      }
      return [...counts.values()];
    },
    [selection],
  );
  const mixedCategories = categoryMix.length > 1;

  if (!selection || !draft) return null;

  const unitIds = selection.units.map((u) => u.id).join(",");
  const updateDraft = <K extends keyof ReservationDraft>(
    key: K,
    value: ReservationDraft[K],
  ) => setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isGroup ? "Group reservation" : "New reservation"}
          </DialogTitle>
          <DialogDescription>
            {selection.checkIn} → {checkOut || selection.checkOut} · {nightCount} night
            {nightCount === 1 ? "" : "s"} · {selection.units.length} room
            {selection.units.length === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Selected rooms by category
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {categoryMix.map((category) => (
              <Badge
                key={category.code || category.name}
                variant={mixedCategories ? "maroon" : "secondary"}
              >
                {category.count}× {category.name}
                {category.code ? ` (${category.code})` : ""}
              </Badge>
            ))}
          </div>
          {mixedCategories ? (
            <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              Mixed room categories selected. Rates may differ—review before saving.
            </p>
          ) : null}
          <ul className="mt-1 space-y-0.5">
            {selection.units.map((u) => (
              <li key={u.id} className="text-foreground">
                <span className="font-medium">{u.label}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {u.room_type_name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="check_in" value={selection.checkIn} />
          <input type="hidden" name="check_out" value={checkOut} />
          <input type="hidden" name="room_unit_ids" value={unitIds} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="calendar_check_in">Check-in</Label>
              <Input
                id="calendar_check_in"
                type="date"
                value={selection.checkIn}
                readOnly
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calendar_nights">No. of nights</Label>
              <Input
                id="calendar_nights"
                type="number"
                min={1}
                max={60}
                value={nightCount}
                inputMode="numeric"
                onChange={(event) => {
                  const next = Math.min(
                    60,
                    Math.max(1, Math.floor(Number(event.target.value) || 1)),
                  );
                  setNightCount(next);
                  setCheckOut(addDays(selection.checkIn, next));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calendar_check_out">Check-out</Label>
              <Input
                id="calendar_check_out"
                type="date"
                value={checkOut}
                readOnly
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Extending the stay is checked against room availability when saved.
          </p>

          {isGroup ? (
            <div className="space-y-1.5">
              <Label htmlFor="group_name">Group name</Label>
              <Input
                id="group_name"
                name="group_name"
                required
                value={draft.groupName}
                onChange={(event) =>
                  updateDraft("groupName", event.target.value)
                }
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact_name">Guest / lead name</Label>
              <Input
                id="contact_name"
                name="contact_name"
                required
                value={draft.contactName}
                onChange={(event) =>
                  updateDraft("contactName", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                required={!draft.phoneLater}
                disabled={draft.phoneLater}
                value={draft.phoneLater ? "" : draft.contactPhone}
                onChange={(event) =>
                  updateDraft("contactPhone", event.target.value)
                }
              />
              <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="phone_later"
                  value="1"
                  checked={draft.phoneLater}
                  onChange={(event) => {
                    const on = event.target.checked;
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            phoneLater: on,
                            contactPhone: on ? "" : d.contactPhone,
                          }
                        : d,
                    );
                  }}
                  className="size-3.5 accent-foreground"
                />
                Phone later — collect before settle
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                value={draft.contactEmail}
                onChange={(event) =>
                  updateDraft("contactEmail", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adults">Adults</Label>
              <Input
                id="adults"
                name="adults"
                type="number"
                min={1}
                max={48}
                required
                value={draft.adults}
                onChange={(event) => updateDraft("adults", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="children">Children (6–12)</Label>
              <Input
                id="children"
                name="children"
                type="number"
                min={0}
                max={12}
                value={draft.children}
                onChange={(event) =>
                  updateDraft("children", event.target.value)
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Half meal · 0–6 free
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra_beds">Extra beds</Label>
              <Input
                id="extra_beds"
                name="extra_beds"
                type="number"
                min={0}
                max={2}
                value={draft.extraBeds}
                onChange={(event) =>
                  updateDraft("extraBeds", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guide_number">Guide #</Label>
              <Input
                id="guide_number"
                name="guide_number"
                value={draft.guideNumber}
                onChange={(event) =>
                  updateDraft("guideNumber", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest_origin">Guest origin</Label>
              <select
                id="guest_origin"
                name="guest_origin"
                value={draft.guestOrigin}
                onChange={(event) =>
                  updateDraft("guestOrigin", event.target.value)
                }
                className={fieldClass}
              >
                <option value="international">International</option>
                <option value="regional">Regional</option>
                <option value="official">Official</option>
                <option value="local">Local</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Booked by</Label>
              <select
                id="source"
                name="source"
                value={draft.source}
                onChange={(event) => updateDraft("source", event.target.value)}
                className={fieldClass}
              >
                <option value="reservation">Reservation</option>
                <option value="owner">Owner</option>
                <option value="agent">Agent</option>
                <option value="mou_agent">MoU agent</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent_id">Agent</Label>
              <AgentPicker
                name="agent_id"
                agents={agents}
                value={draft.agentId}
                onValueChange={(next) => updateDraft("agentId", next)}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sold by (staff)</Label>
              <StaffPicker
                name="sold_by_staff_id"
                staff={staff}
                value={draft.soldByStaffId}
                onValueChange={(next) => updateDraft("soldByStaffId", next)}
                className="bg-background"
              />
              <p className="text-[11px] text-muted-foreground">
                Who brought the guest or agent — Owner/GM approves later.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_mode">Payment</Label>
              <select
                id="payment_mode"
                name="payment_mode"
                value={draft.paymentMode}
                onChange={(event) =>
                  updateDraft("paymentMode", event.target.value)
                }
                className={fieldClass}
              >
                <option value="cash">Cash</option>
                <option value="prepaid">Prepaid</option>
                <option value="partial">Partial</option>
                <option value="on_credit">On credit</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calendar_meal_plan_code">Meal plan</Label>
              <Select
                value={draft.mealPlanCode}
                onValueChange={(value) => updateDraft("mealPlanCode", value)}
                required
              >
                <SelectTrigger id="calendar_meal_plan_code">
                  <SelectValue placeholder="Select meal plan" />
                </SelectTrigger>
                <SelectContent>
                  {mealPlans.map((plan) => (
                    <SelectItem key={plan.code} value={plan.code}>
                      {plan.code} · {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="meal_plan_code" value={draft.mealPlanCode} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                name="notes"
                value={draft.notes}
                onChange={(event) => updateDraft("notes", event.target.value)}
              />
            </div>
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          {mixedCategories ? (
            <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/70 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
              <input
                type="checkbox"
                required
                checked={draft.mixAcknowledged}
                onChange={(event) =>
                  updateDraft("mixAcknowledged", event.target.checked)
                }
                className="mt-0.5 size-4 accent-amber-600"
              />
              <span>
                I reviewed the mixed category selection:{" "}
                {categoryMix
                  .map((category) => `${category.count}× ${category.name}`)
                  .join(" · ")}
              </span>
            </label>
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
              {pending
                ? "Saving…"
                : isGroup
                  ? `Book ${selection.units.length} rooms`
                  : "Save reservation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
