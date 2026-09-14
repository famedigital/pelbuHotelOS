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
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type Props = {
  className?: string;
  fromPriceBtn?: number | null;
  taxInclusive?: boolean;
  /**
   * `card` — stacked white card.
   * `bar` — slim horizontal dock under the hero (desktop).
   * `sheet` — bare form for the mobile book sheet.
   */
  variant?: "card" | "bar" | "sheet";
  idPrefix?: string;
};

/** Stay search → GET /book. */
export function HeroBookingSearch({
  className,
  fromPriceBtn,
  taxInclusive,
  variant = "card",
  idPrefix = "hero",
}: Props) {
  const defaults = useMemo(() => parseStaySearch(), []);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [adults, setAdults] = useState(defaults.adults);
  const [rooms, setRooms] = useState(defaults.rooms);

  const minCheckIn = defaults.checkIn;
  const minCheckout = checkIn
    ? addDaysIso(checkIn, 1)
    : addDaysIso(todayIso(), 1);
  const nights = nightsBetween(checkIn, checkOut);
  const datesValid = nights >= 1;
  const priceHint =
    fromPriceBtn != null && fromPriceBtn > 0
      ? `From ${formatBtn(fromPriceBtn)} / night · live rates, no OTA markup`
      : "Live rates — no OTA markup.";
  const isSheet = variant === "sheet";
  const isBar = variant === "bar";

  function onCheckInChange(value: string) {
    setCheckIn(value);
    if (value && (!checkOut || checkOut <= value)) {
      setCheckOut(addDaysIso(value, 1));
    }
  }

  if (isBar) {
    return (
      <form
        action="/book"
        method="get"
        className={cn(
          "grid items-end gap-3 border border-cedar-rule bg-white p-4 text-cedar-ink shadow-[0_20px_50px_-28px_rgba(14,22,19,0.45)] sm:grid-cols-2 lg:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr_auto]",
          className,
        )}
        aria-label="Check room availability"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-check-in`} className="text-xs text-muted-foreground">
            Check-in
          </Label>
          <Input
            id={`${idPrefix}-check-in`}
            name="checkIn"
            type="date"
            value={checkIn}
            min={minCheckIn}
            required
            onChange={(event) => onCheckInChange(event.target.value)}
            className="h-11 rounded-md border-cedar-rule bg-mist-0 text-base md:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-check-out`} className="text-xs text-muted-foreground">
            Check-out
          </Label>
          <Input
            id={`${idPrefix}-check-out`}
            name="checkOut"
            type="date"
            value={checkOut}
            min={minCheckout}
            required
            onChange={(event) => setCheckOut(event.target.value)}
            className="h-11 rounded-md border-cedar-rule bg-mist-0 text-base md:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-adults`} className="text-xs text-muted-foreground">
            Guests
          </Label>
          <select
            id={`${idPrefix}-adults`}
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
          <Label htmlFor={`${idPrefix}-rooms`} className="text-xs text-muted-foreground">
            Rooms
          </Label>
          <select
            id={`${idPrefix}-rooms`}
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
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <p className="text-[11px] text-muted-foreground" aria-live="polite">
            {datesValid
              ? `${nights} night${nights === 1 ? "" : "s"} · ${priceHint}`
              : "Choose a later check-out"}
          </p>
          <Button
            type="submit"
            variant="ember"
            size="lg"
            className="h-11 w-full rounded-md text-sm font-semibold"
            disabled={!datesValid}
          >
            Check availability
          </Button>
        </div>
      </form>
    );
  }

  const fields = (
    <>
      {!isSheet ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-juniper">
              Direct booking
            </p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {priceHint}
            {taxInclusive && fromPriceBtn != null && fromPriceBtn > 0
              ? " · inc. tax"
              : ""}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {priceHint}
          {taxInclusive && fromPriceBtn != null && fromPriceBtn > 0
            ? " · inc. tax"
            : ""}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 items-start gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-check-in`} className="text-xs text-muted-foreground">
            Check-in
          </Label>
          <Input
            id={`${idPrefix}-check-in`}
            name="checkIn"
            type="date"
            value={checkIn}
            min={minCheckIn}
            required
            onChange={(event) => onCheckInChange(event.target.value)}
            className="h-11 rounded-md border-cedar-rule bg-white text-base md:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-check-out`} className="text-xs text-muted-foreground">
            Check-out
          </Label>
          <Input
            id={`${idPrefix}-check-out`}
            name="checkOut"
            type="date"
            value={checkOut}
            min={minCheckout}
            required
            onChange={(event) => setCheckOut(event.target.value)}
            className="h-11 rounded-md border-cedar-rule bg-white text-base md:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-adults`} className="text-xs text-muted-foreground">
            Guests
          </Label>
          <select
            id={`${idPrefix}-adults`}
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
          <Label htmlFor={`${idPrefix}-rooms`} className="text-xs text-muted-foreground">
            Rooms
          </Label>
          <select
            id={`${idPrefix}-rooms`}
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

      <div className={cn(isSheet ? "mt-5" : "mt-3")}>
        <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
          {datesValid
            ? `${nights} night${nights === 1 ? "" : "s"}`
            : "Choose a later check-out"}
        </p>
        <Button
          type="submit"
          variant="ember"
          size="lg"
          className="h-12 w-full rounded-md text-base font-semibold"
          disabled={!datesValid}
        >
          Check availability
        </Button>
      </div>
    </>
  );

  return (
    <form
      action="/book"
      method="get"
      className={cn(
        isSheet
          ? "text-cedar-ink"
          : "rounded-md border border-cedar-rule bg-white p-5 text-cedar-ink shadow-[0_24px_60px_-28px_rgba(14,22,19,0.35)]",
        className,
      )}
      aria-label="Check room availability"
    >
      {fields}
    </form>
  );
}
