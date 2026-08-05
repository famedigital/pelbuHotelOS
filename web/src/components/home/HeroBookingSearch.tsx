"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBtn } from "@/lib/pricing";
import {
  addDaysIso,
  nightsBetween,
  parseStaySearch,
  todayIso,
} from "@/lib/stay-dates";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:h-11 sm:rounded-xl sm:px-3";

type Props = {
  className?: string;
  fromPriceBtn?: number | null;
  taxInclusive?: boolean;
};

/**
 * Airbnb-style stay search for the homepage hero. Submits to /book with
 * dates and party size so the booking wizard opens prefilled.
 * Mobile: compact dock at the bottom so the hero photo stays primary.
 */
export function HeroBookingSearch({
  className,
  fromPriceBtn,
  taxInclusive,
}: Props) {
  const defaults = useMemo(() => parseStaySearch(), []);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [adults, setAdults] = useState(defaults.adults);
  const [rooms, setRooms] = useState(defaults.rooms);

  const minCheckIn = defaults.checkIn;
  const minCheckout = checkIn ? addDaysIso(checkIn, 1) : addDaysIso(todayIso(), 1);
  const nights = nightsBetween(checkIn, checkOut);
  const datesValid = nights >= 1;
  const priceHint =
    fromPriceBtn != null && fromPriceBtn > 0
      ? `From ${formatBtn(fromPriceBtn)} / night · live rates, no OTA markup`
      : "Live rates — no OTA markup.";
  const priceHintShort =
    fromPriceBtn != null && fromPriceBtn > 0
      ? `From ${formatBtn(fromPriceBtn)}/nt`
      : "Live rates";

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
        "rounded-xl border border-white/25 bg-white/95 p-3 text-sky-ink shadow-[0_16px_40px_-24px_rgba(8,47,73,0.5)] backdrop-blur-md sm:rounded-2xl sm:p-5 sm:shadow-[0_24px_60px_-28px_rgba(8,47,73,0.55)]",
        className,
      )}
      aria-label="Check room availability"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 sm:text-xs sm:tracking-[0.18em]">
          Direct booking
        </p>
        <p className="truncate text-[11px] text-sky-ink/65 sm:hidden">
          {priceHintShort}
          {taxInclusive && fromPriceBtn != null && fromPriceBtn > 0
            ? " · tax"
            : ""}
        </p>
      </div>
      <p className="mt-1 hidden text-sm text-sky-ink/70 sm:block">
        {priceHint}
        {taxInclusive && fromPriceBtn != null && fromPriceBtn > 0
          ? " · inc. tax"
          : ""}
      </p>

      {/* Mobile: tight 2×2; sm+: dates row then guests/rooms. */}
      <div className="mt-2.5 grid grid-cols-2 items-start gap-2 sm:mt-4 sm:gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label
            htmlFor="hero-check-in"
            className="text-[11px] text-sky-ink/80 sm:text-xs"
          >
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
            className="h-9 rounded-lg border-sky-200 bg-white text-sm sm:h-11 sm:rounded-xl sm:text-base md:text-sm"
          />
        </div>
        <div className="grid gap-1">
          <Label
            htmlFor="hero-check-out"
            className="text-[11px] text-sky-ink/80 sm:text-xs"
          >
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
            className="h-9 rounded-lg border-sky-200 bg-white text-sm sm:h-11 sm:rounded-xl sm:text-base md:text-sm"
          />
        </div>
        <div className="grid gap-1">
          <Label
            htmlFor="hero-adults"
            className="text-[11px] text-sky-ink/80 sm:text-xs"
          >
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
        <div className="grid gap-1">
          <Label
            htmlFor="hero-rooms"
            className="text-[11px] text-sky-ink/80 sm:text-xs"
          >
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

      <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:block">
        <p
          className="min-w-0 flex-1 truncate text-[11px] text-sky-ink/55 sm:mb-0 sm:text-xs"
          aria-live="polite"
        >
          {datesValid
            ? `${nights} night${nights === 1 ? "" : "s"}`
            : "Choose a later check-out"}
        </p>
        <Button
          type="submit"
          variant="citrus"
          size="lg"
          className="h-9 shrink-0 rounded-lg px-4 text-sm font-semibold sm:mt-4 sm:h-12 sm:w-full sm:rounded-xl sm:text-base"
          disabled={!datesValid}
        >
          <span className="sm:hidden">Check dates</span>
          <span className="hidden sm:inline">Check availability</span>
        </Button>
      </div>
    </form>
  );
}
