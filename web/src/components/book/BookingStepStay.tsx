"use client";

import type { ExtraBedOption, MealPlanOption } from "@/app/actions/bookings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_CHILDREN, MAX_EXTRA_BEDS } from "@/lib/meal-plans-calc";
import { formatBtn } from "@/lib/pricing";
import { addDaysIso } from "@/lib/stay-dates";
import { useMemo } from "react";

type Props = {
  checkIn: string;
  checkOut: string;
  minCheckIn: string;
  nightsLabel: string | null;
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  adults: number;
  onAdults: (n: number) => void;
  children: number;
  onChildren: (n: number) => void;
  rooms: number;
  onRooms: (n: number) => void;
  extraBeds: number;
  onExtraBeds: (n: number) => void;
  mealPlans: MealPlanOption[];
  mealPlanCode: string;
  onMealPlan: (code: string) => void;
  extraBed: ExtraBedOption | null;
};

export function BookingStepStay({
  checkIn,
  checkOut,
  minCheckIn,
  nightsLabel,
  onCheckIn,
  onCheckOut,
  adults,
  onAdults,
  children,
  onChildren,
  rooms,
  onRooms,
  extraBeds,
  onExtraBeds,
  mealPlans,
  mealPlanCode,
  onMealPlan,
  extraBed,
}: Props) {
  const minCheckout = useMemo(
    () => (checkIn ? addDaysIso(checkIn, 1) : minCheckIn),
    [checkIn, minCheckIn],
  );

  const selectedPlan =
    mealPlans.find((p) => p.code === mealPlanCode) ?? null;
  const showChildrenFreeHint =
    children > 0 &&
    selectedPlan != null &&
    selectedPlan.amountPerAdultNight != null &&
    selectedPlan.amountPerAdultNight > 0 &&
    selectedPlan.amountPerChildNight == null;

  return (
    <fieldset className="space-y-6">
      <legend className="sr-only">Stay dates and party</legend>

      <div className="space-y-2">
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="check-in">Check-in</Label>
            <Input
              id="check-in"
              type="date"
              value={checkIn}
              min={minCheckIn}
              onChange={(e) => onCheckIn(e.target.value || "")}
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="check-out">Check-out</Label>
            <Input
              id="check-out"
              type="date"
              value={checkOut}
              min={minCheckout}
              onChange={(e) => onCheckOut(e.target.value || "")}
              className="h-10"
            />
          </div>
        </div>
        <p
          className="min-h-4 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {nightsLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        <Stepper
          label="Adults"
          value={adults}
          min={1}
          max={12}
          onChange={onAdults}
        />
        <Stepper
          label="Children"
          value={children}
          min={0}
          max={MAX_CHILDREN}
          onChange={onChildren}
        />
        <Stepper
          label="Rooms"
          value={rooms}
          min={1}
          max={6}
          onChange={onRooms}
        />
        {extraBed?.sellable ? (
          <Stepper
            label="Extra beds"
            value={extraBeds}
            min={0}
            max={extraBed.maxQty || MAX_EXTRA_BEDS}
            onChange={onExtraBeds}
            hint={
              extraBed.ratePerNight != null
                ? `${formatBtn(extraBed.ratePerNight)} / bed / night`
                : undefined
            }
          />
        ) : null}
      </div>

      {showChildrenFreeHint ? (
        <p className="text-xs text-muted-foreground" role="status">
          Children meals are included at no extra charge on this meal plan.
        </p>
      ) : null}

      {mealPlans.length > 0 ? (
        <div className="space-y-3">
          <Label>Meal plan</Label>
          <p className="text-xs text-muted-foreground">
            Meal add-ons are included in your estimate when priced. Final invoice
            is confirmed by the desk.
          </p>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Meal plan"
          >
            {mealPlans.map((plan) => {
              const selected = mealPlanCode === plan.code;
              return (
                <label
                  key={plan.code}
                  className={[
                    "cursor-pointer rounded-sm border px-4 py-3 text-sm transition-colors",
                    selected
                      ? "border-ink shadow-[inset_0_0_0_1px_var(--ink)]"
                      : "border-paper-3 hover:border-ink/40",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="meal_plan_code_ui"
                    value={plan.code}
                    checked={selected}
                    onChange={() => onMealPlan(plan.code)}
                    className="sr-only"
                  />
                  <span className="font-medium text-ink">{plan.name}</span>
                  {plan.blurb ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {plan.blurb}
                    </span>
                  ) : null}
                  {plan.priced && plan.amountPerAdultNight != null ? (
                    <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                      {plan.amountPerAdultNight === 0
                        ? "Included with room"
                        : `${formatBtn(plan.amountPerAdultNight)} / adult / night`}
                      {plan.amountPerChildNight != null
                        ? ` · ${formatBtn(plan.amountPerChildNight)} / child`
                        : plan.amountPerAdultNight > 0
                          ? " · children free"
                          : ""}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-paper-3 bg-card text-lg text-ink transition-colors hover:border-ink/40 hover:bg-paper-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          inputMode="numeric"
          aria-label={label}
          onChange={(e) => {
            const n = Number(e.target.value || min);
            onChange(
              Number.isFinite(n)
                ? Math.min(max, Math.max(min, Math.floor(n)))
                : min,
            );
          }}
          className="h-10 w-16 rounded-sm border border-paper-3 bg-card px-2 text-center text-sm text-ink outline-none transition-colors focus:border-brass focus:ring-2 focus:ring-brass/25"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-paper-3 bg-card text-lg text-ink transition-colors hover:border-ink/40 hover:bg-paper-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
      {hint ? (
        <p className="text-[11px] text-muted-foreground tabular-nums">{hint}</p>
      ) : null}
    </div>
  );
}
