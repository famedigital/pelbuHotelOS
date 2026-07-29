"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "dates" | "nights";

type Props = {
  minCheckIn: string;
  defaultMode?: Mode;
  className?: string;
};

const LS_KEY = "pelbu.staydates.mode";
const MAX_NIGHTS = 14;

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

function fmtHuman(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function stepperBtnClassName(disabled?: boolean) {
  return [
    "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-espresso/15 bg-white text-base text-espresso transition-colors hover:border-espresso/40 hover:bg-espresso/[0.04]",
    disabled ? "cursor-not-allowed opacity-40" : "",
  ].join(" ");
}

/**
 * Stay input with two modes the user can toggle:
 *  - dates:  two native date pickers (default for guest-facing flows)
 *  - nights: check-in date + nights stepper (default for desk staff)
 *
 * Mode choice persists in localStorage (per browser / per staff member).
 *
 * Always renders hidden `check_in` and `check_out` inputs so the parent
 * server action contract is preserved verbatim.
 */
export function StayDatesField({
  minCheckIn,
  defaultMode = "dates",
  className,
}: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [mounted, setMounted] = useState(false);

  const [checkIn, setCheckIn] = useState<string>(todayIso());
  const [checkOut, setCheckOut] = useState<string>(addDaysIso(todayIso(), 1));
  const [nights, setNights] = useState<number>(1);

  // Load persisted mode once on mount (avoid SSR/hydration mismatch).
  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(LS_KEY);
      if (saved === "dates" || saved === "nights") {
        setMode(saved);
      }
    } catch {
      // localStorage unavailable — fall back to prop default
    }
  }, []);

  // Persist mode changes.
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(LS_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode, mounted]);

  // Keep nights + checkout in sync depending on mode.
  useEffect(() => {
    if (mode === "nights") {
      // nights is source of truth → checkout derived
      setCheckOut(addDaysIso(checkIn, Math.max(1, nights)));
    } else {
      // dates is source of truth → nights derived if valid
      const n = nightsBetween(checkIn, checkOut);
      if (n > 0) setNights(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, checkIn, checkOut, nights]);

  const minCheckout = useMemo(
    () => (checkIn ? addDaysIso(checkIn, 1) : minCheckIn),
    [checkIn, minCheckIn],
  );

  const nightsPreview = checkOut ? fmtHuman(checkOut) : "";
  const invalid = !checkIn || !checkOut || nightsBetween(checkIn, checkOut) < 1;

  return (
    <fieldset className={`space-y-3 ${className ?? ""}`}>
      <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
        Stay
      </legend>

      <div
        role="tablist"
        aria-label="Stay entry mode"
        className="inline-flex items-center rounded-full border border-espresso/15 bg-white p-0.5"
      >
        {(["dates", "nights"] as const).map((m) => {
          const active = mounted && mode === m;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m)}
              className={[
                "min-h-8 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] transition-colors",
                active
                  ? "bg-espresso text-ivory"
                  : "text-muted-foreground hover:text-espresso",
              ].join(" ")}
            >
              {m === "dates" ? "Dates" : "Nights"}
            </button>
          );
        })}
      </div>

      {/* Render controls only once mounted so the persisted mode doesn't flash.
          The hidden inputs below keep SSR form submission valid. */}
      {mounted ? (
        mode === "dates" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm text-espresso">
            Check-in
            <input
              type="date"
              value={checkIn}
              min={minCheckIn}
              onChange={(e) => setCheckIn(e.target.value || "")}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Check-out
            <input
              type="date"
              value={checkOut}
              min={minCheckout}
              onChange={(e) => setCheckOut(e.target.value || "")}
              className={`${fieldClassName()} ${
                invalid ? "border-maroon/60 text-maroon focus:border-maroon" : ""
              }`}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block text-sm text-espresso">
            Check-in
            <input
              type="date"
              value={checkIn}
              min={minCheckIn}
              onChange={(e) => setCheckIn(e.target.value || "")}
              className={fieldClassName()}
            />
            {nightsPreview ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                → {nightsPreview}
              </span>
            ) : null}
          </label>
          <label className="block text-sm text-espresso">
            Nights
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Decrease nights"
                onClick={() => setNights((n) => Math.max(1, n - 1))}
                disabled={nights <= 1}
                className={stepperBtnClassName(nights <= 1)}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={MAX_NIGHTS}
                value={nights}
                inputMode="numeric"
                aria-label="Number of nights"
                onChange={(e) => {
                  const n = Number(e.target.value || 1);
                  setNights(
                    Number.isFinite(n)
                      ? Math.min(MAX_NIGHTS, Math.max(1, Math.floor(n)))
                      : 1,
                  );
                }}
                className="w-16 rounded-sm border border-espresso/15 bg-white px-2 py-2.5 text-center text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="button"
                aria-label="Increase nights"
                onClick={() => setNights((n) => Math.min(MAX_NIGHTS, n + 1))}
                disabled={nights >= MAX_NIGHTS}
                className={stepperBtnClassName(nights >= MAX_NIGHTS)}
              >
                +
              </button>
            </div>
          </label>
        </div>
        )
      ) : null}

      {invalid && mounted ? (
        <p className="text-xs text-maroon">Check-out must be after check-in.</p>
      ) : null}

      {/* Hidden inputs preserve the existing server action contract. */}
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />
    </fieldset>
  );
}
