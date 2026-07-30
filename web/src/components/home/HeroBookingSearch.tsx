"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDaysIso,
  nightsBetween,
  parseStaySearch,
  todayIso,
} from "@/lib/stay-dates";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * Airbnb-style stay search for the homepage hero. Submits to /book with
 * dates and party size so the booking wizard opens prefilled.
 */
export function HeroBookingSearch({ className }: { className?: string }) {
  const defaults = useMemo(() => parseStaySearch(), []);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [adults, setAdults] = useState(defaults.adults);
  const [rooms, setRooms] = useState(defaults.rooms);

  const minCheckIn = defaults.checkIn;
  const minCheckout = checkIn ? addDaysIso(checkIn, 1) : addDaysIso(todayIso(), 1);
  const nights = nightsBetween(checkIn, checkOut);
  const datesValid = nights >= 1;

  function onCheckInChange(value: string) {
    setCheckIn(value);
    if (value && (!checkOut || checkOut <= value)) {
      setCheckOut(addDaysIso(value, 1));
    }
  }

  return (
    <form
      action="/book"
      method="get"
      className={cn(
        "rounded-2xl border border-white/25 bg-white/95 p-4 text-sky-ink shadow-[0_24px_60px_-28px_rgba(8,47,73,0.55)] backdrop-blur-md sm:p-5",
        className,
      )}
      aria-label="Check room availability"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
        Direct booking
      </p>
      <p className="mt-1 text-sm text-sky-ink/70">
        Live rates — no OTA markup.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="hero-check-in" className="text-xs text-sky-ink/80">
            Check-in
          </Label>
          <Input
            id="hero-check-in"
            name="checkIn"
            type="date"
            value={checkIn}
            min={minCheckIn}
            required
            onChange={(event) => onCheckInChange(event.target.value)}
            className="h-11 rounded-xl border-sky-200 bg-white text-base sm:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hero-check-out" className="text-xs text-sky-ink/80">
            Check-out
          </Label>
          <Input
            id="hero-check-out"
            name="checkOut"
            type="date"
            value={checkOut}
            min={minCheckout}
            required
            onChange={(event) => setCheckOut(event.target.value)}
            className="h-11 rounded-xl border-sky-200 bg-white text-base sm:text-sm"
          />
          <p className="text-xs text-sky-ink/55" aria-live="polite">
            {datesValid
              ? `${nights} night${nights === 1 ? "" : "s"}`
              : "Choose a later check-out"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="hero-adults" className="text-xs text-sky-ink/80">
            Guests
          </Label>
          <select
            id="hero-adults"
            name="adults"
            value={adults}
            onChange={(event) => setAdults(Number(event.target.value))}
            className={selectClass}
            aria-label="Number of guests"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} guest{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hero-rooms" className="text-xs text-sky-ink/80">
            Rooms
          </Label>
          <select
            id="hero-rooms"
            name="rooms"
            value={rooms}
            onChange={(event) => setRooms(Number(event.target.value))}
            className={selectClass}
            aria-label="Number of rooms"
          >
            {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} room{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button
        type="submit"
        variant="citrus"
        size="lg"
        className="mt-4 h-12 w-full rounded-xl text-base font-semibold"
        disabled={!datesValid}
      >
        Check availability
      </Button>
    </form>
  );
}
