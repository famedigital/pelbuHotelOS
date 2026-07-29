"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  rooms: number;
  onRooms: (n: number) => void;
};

function addDaysIso(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingStepStay({
  checkIn,
  checkOut,
  minCheckIn,
  nightsLabel,
  onCheckIn,
  onCheckOut,
  adults,
  onAdults,
  rooms,
  onRooms,
}: Props) {
  const minCheckout = useMemo(
    () => (checkIn ? addDaysIso(checkIn, 1) : minCheckIn),
    [checkIn, minCheckIn],
  );

  return (
    <fieldset className="space-y-6">
      <legend className="sr-only">Stay dates and party</legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="check-in">Check-in</Label>
          <Input
            id="check-in"
            type="date"
            value={checkIn}
            min={minCheckIn}
            onChange={(e) => onCheckIn(e.target.value || "")}
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
          />
          {nightsLabel ? (
            <span className="text-xs text-muted-foreground">
              {nightsLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stepper
          label="Adults"
          value={adults}
          min={1}
          max={12}
          onChange={onAdults}
        />
        <Stepper
          label="Rooms"
          value={rooms}
          min={1}
          max={6}
          onChange={onRooms}
        />
      </div>
    </fieldset>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
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
    </div>
  );
}
