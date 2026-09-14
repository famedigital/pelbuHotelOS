"use client";

import {
  createAgentBooking,
  previewAgentStay,
  type AgentBookingState,
  type AgentRoomOption,
} from "@/app/actions/agent-book";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useEffect, useMemo, useState } from "react";

const initial: AgentBookingState = { ok: false };

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function AgentBookForm() {
  const [state, action, pending] = useActionState(createAgentBooking, initial);
  const minCheckIn = useMemo(() => todayIso(), []);

  const [checkIn, setCheckIn] = useState(minCheckIn);
  const [checkOut, setCheckOut] = useState(addDaysIso(minCheckIn, 1));
  const [rooms, setRooms] = useState(1);
  const [guideNumber, setGuideNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [options, setOptions] = useState<AgentRoomOption[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stayNights = nights(checkIn, checkOut);
  const datesValid = stayNights >= 1;

  useEffect(() => {
    if (!datesValid) {
      const t = window.setTimeout(() => {
        setOptions([]);
        setError(null);
      }, 0);
      return () => window.clearTimeout(t);
    }
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- fetch lifecycle */
    setLoading(true);
    setError(null);
    previewAgentStay({ checkIn, checkOut, rooms })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setOptions(res.preview.options);
          setSelectedCode((current) =>
            current && res.preview.options.some((o) => o.code === current && o.available)
              ? current
              : null,
          );
        } else {
          setError(res.error);
          setOptions([]);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load rates. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, rooms, datesValid]);

  const selected = options.find((o) => o.code === selectedCode) ?? null;

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <h2 className="text-lg font-semibold">Rooms held</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your booking is held until{" "}
          {state.holdExpiresAt
            ? new Date(state.holdExpiresAt).toLocaleString("en-BT", {
                timeZone: "Asia/Thimphu",
              })
            : "shortly"}
          . The desk confirms against your credit. Reference{" "}
          <span className="font-mono">{state.bookingId?.slice(0, 8)}</span>.
        </p>
        <a
          href="/agents/app/calendar"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          View my bookings
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />
      <input type="hidden" name="rooms" value={rooms} />
      <input type="hidden" name="room_type_code" value={selectedCode ?? ""} />
      <input type="hidden" name="meal_plan_code" value="EP" />

      {state.error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ci">Check-in</Label>
          <Input
            id="ci"
            type="date"
            value={checkIn}
            min={minCheckIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="co">Check-out</Label>
          <Input
            id="co"
            type="date"
            value={checkOut}
            min={addDaysIso(checkIn, 1)}
            onChange={(e) => setCheckOut(e.target.value)}
          />
          {stayNights > 0 ? (
            <span className="text-xs text-muted-foreground">
              {stayNights} night{stayNights === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rooms">Rooms</Label>
        <Input
          id="rooms"
          type="number"
          min={1}
          max={10}
          value={rooms}
          onChange={(e) =>
            setRooms(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
          }
          className="w-28"
        />
      </div>

      <div className="space-y-3">
        <Label>Room type</Label>
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking availability…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pick valid dates to see your rates.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {options.map((o) => {
              const isSelected = selectedCode === o.code;
              return (
                <label
                  key={o.roomTypeId}
                  className={[
                    "cursor-pointer rounded-xl border px-4 py-3 text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40",
                    o.available ? "" : "cursor-not-allowed opacity-50",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="room_type_code_ui"
                    value={o.code}
                    checked={isSelected}
                    disabled={!o.available}
                    onChange={() => setSelectedCode(o.code)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.available ? `${o.remaining} left` : "Sold out"}
                    </span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {o.perNightBtn == null
                      ? "Rate on request"
                      : `${formatBtn(o.perNightBtn)} / night`}
                  </div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {o.totalBtn == null ? "—" : formatBtn(o.totalBtn)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      total
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="guide">Guide number (optional)</Label>
          <Input
            id="guide"
            name="guide_number"
            value={guideNumber}
            onChange={(e) => setGuideNumber(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estimated total</span>
            <span className="text-lg font-semibold tabular-nums">
              {selected.totalBtn == null
                ? "On request"
                : formatBtn(selected.totalBtn)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Held for desk confirmation against your credit. No payment now.
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !selectedCode || !datesValid}
        className="min-h-11 w-full"
      >
        {pending ? "Holding rooms…" : "Hold rooms"}
      </Button>
    </form>
  );
}
