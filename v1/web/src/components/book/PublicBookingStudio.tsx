"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { PublicRoom } from "@/lib/public-content";
import {
  createBooking,
  previewStayCost,
  type BookingActionState,
  type StayPreview,
} from "@/app/actions/bookings";
import { EmptyState } from "@/components/ui/empty-state";

interface PublicBookingStudioProps {
  rooms: PublicRoom[];
  initialRoomCode?: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PublicBookingStudio({
  rooms,
  initialRoomCode,
}: PublicBookingStudioProps) {
  const [selectedRoomCode, setSelectedRoomCode] = useState(
    initialRoomCode || rooms[0]?.code || "",
  );
  const [checkIn, setCheckIn] = useState(todayPlus(1));
  const [checkOut, setCheckOut] = useState(todayPlus(3));
  const [adults, setAdults] = useState(2);
  const [roomsCount, setRoomsCount] = useState(1);
  const [mealPlan, setMealPlan] = useState("MAP");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [preview, setPreview] = useState<StayPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingActionState | null>(null);
  const [pending, start] = useTransition();

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.code === selectedRoomCode) ?? rooms[0],
    [rooms, selectedRoomCode],
  );

  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    let cancelled = false;
    start(async () => {
      const res = await previewStayCost({
        checkIn,
        checkOut,
        rooms: roomsCount,
        adults,
      });
      if (cancelled) return;
      if (!res.ok) {
        setPreview(null);
        setPreviewError(res.error);
        return;
      }
      setPreviewError(null);
      setPreview(res.preview);
      const match = res.preview.options.find((rt) => rt.code === selectedRoomCode);
      if (!match && res.preview.options[0]) {
        setSelectedRoomCode(res.preview.options[0].code);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, roomsCount, adults, selectedRoomCode]);

  const roomQuote = preview?.options.find((r) => r.code === selectedRoomCode);
  const stayTotal = roomQuote?.totalBtn ?? null;

  if (rooms.length === 0) {
    return (
      <EmptyState
        title="No rooms published"
        description="Ask the hotel to publish sellable room types before guests can book."
      />
    );
  }

  if (result?.ok) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-500/40 bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Hold confirmed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tashi Delek, <strong>{guestName}</strong>. Your stay is held in the hotel system
          {result.holdExpiresAt
            ? ` until ${new Date(result.holdExpiresAt).toLocaleString()}`
            : ""}
          .
        </p>
        <div className="mt-6 space-y-2 rounded-xl border bg-muted/40 p-4 text-left font-mono text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Booking id</span>
            <span>{result.bookingId?.slice(0, 8)}…</span>
          </div>
          {result.tokenAmount != null ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit due</span>
              <span>Nu {result.tokenAmount}</span>
            </div>
          ) : null}
        </div>
        {result.paymentUrl ? (
          <Link
            href={result.paymentUrl}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Pay deposit <ArrowRight className="size-4" />
          </Link>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Front desk will send an RMA / mBoB deposit link shortly.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!guestName.trim() || !guestPhone.trim()) {
          toast.error("Name and phone are required");
          return;
        }
        if (!checkIn || !checkOut || checkOut <= checkIn) {
          toast.error("Check-out must be after check-in");
          return;
        }
        const fd = new FormData();
        fd.set("contact_name", guestName.trim());
        fd.set("contact_phone", guestPhone.trim());
        if (guestEmail.trim()) fd.set("contact_email", guestEmail.trim());
        fd.set("check_in", checkIn);
        fd.set("check_out", checkOut);
        fd.set("adults", String(adults));
        fd.set("children", "0");
        fd.set("rooms", String(roomsCount));
        fd.set("extra_beds", "0");
        fd.set("room_type_code", selectedRoomCode);
        fd.set("meal_plan_code", mealPlan);
        start(async () => {
          const res = await createBooking({ ok: false }, fd);
          if (!res.ok) {
            toast.error(res.error ?? "Booking failed");
            setResult(res);
            return;
          }
          toast.success("Hold created");
          setResult(res);
        });
      }}
    >
      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Calendar className="size-4" /> Stay details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Check-in
            <input
              type="date"
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 2));
              }}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-xs">
            Check-out
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-xs">
            Adults
            <input
              type="number"
              min={1}
              max={12}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Rooms
            <input
              type="number"
              min={1}
              max={6}
              value={roomsCount}
              onChange={(e) => setRoomsCount(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">Room type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(preview?.options.length
              ? preview.options
              : rooms.map((r) => ({
                  code: r.code,
                  name: r.name,
                  perNightBtn: null as number | null,
                  available: true,
                }))
            ).map((rt) => (
              <button
                key={rt.code}
                type="button"
                onClick={() => setSelectedRoomCode(rt.code)}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                  selectedRoomCode === rt.code
                    ? "border-primary bg-primary/10"
                    : "hover:border-primary/40"
                }`}
              >
                <div className="font-medium">{rt.name}</div>
                <div className="text-xs text-muted-foreground">
                  {"perNightBtn" in rt && rt.perNightBtn != null
                    ? `from Nu ${rt.perNightBtn}/night`
                    : selectedRoom?.blurb ?? rt.code}
                  {"available" in rt && rt.available === false ? " · sold out" : ""}
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-xs">
          Meal plan
          <select
            value={mealPlan}
            onChange={(e) => setMealPlan(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="EP">EP — room only</option>
            <option value="CP">CP — breakfast</option>
            <option value="MAP">MAP — breakfast + dinner</option>
            <option value="AP">AP — all meals</option>
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs sm:col-span-2">
            Full name
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-xs">
            Phone
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-xs">
            Email
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <aside className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Quote</h2>
        {pending && !preview ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Live quote…
          </p>
        ) : null}
        {previewError ? (
          <EmptyState title="Quote unavailable" description={previewError} />
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nights</dt>
              <dd>{preview?.nights ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Season</dt>
              <dd className="capitalize">{preview?.season ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Stay total</dt>
              <dd className="font-semibold tabular-nums">
                {stayTotal != null ? `Nu ${stayTotal}` : "—"}
              </dd>
            </div>
          </dl>
        )}
        <button
          type="submit"
          disabled={pending || !preview}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Hold with live rate
        </button>
        <p className="text-[11px] text-muted-foreground">
          Server-priced hold via Innora desk. No fake BK codes. Deposit via RMA / mBoB after hold.
        </p>
      </aside>
    </form>
  );
}
