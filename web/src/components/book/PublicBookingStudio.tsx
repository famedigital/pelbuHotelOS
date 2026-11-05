"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CreditCard,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  QrCode,
  Building,
} from "lucide-react";
import type { PublicRoom } from "@/lib/public-content";

interface PublicBookingStudioProps {
  rooms: PublicRoom[];
  initialRoomCode?: string;
}

type MealPlanType = "EP" | "CP" | "MAP" | "AP";

export function PublicBookingStudio({
  rooms,
  initialRoomCode,
}: PublicBookingStudioProps) {
  const [selectedRoomCode, setSelectedRoomCode] = useState(
    initialRoomCode || rooms[0]?.code || "DLX",
  );
  const [checkIn, setCheckIn] = useState<string>("2026-11-15");
  const [nights, setNights] = useState<number>(2);
  const [adults, setAdults] = useState<number>(2);
  const [mealPlan, setMealPlan] = useState<MealPlanType>("MAP");
  const [paymentMethod, setPaymentMethod] = useState<"rma_qr" | "desk" | "agent">("rma_qr");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookingRef, setBookingRef] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Approximate base pricing in Nu.
  const baseRatePerNight =
    selectedRoomCode === "STE" ? 7500 : selectedRoomCode === "DLX" ? 5200 : 3800;

  const mealSupplement =
    mealPlan === "AP" ? 1800 : mealPlan === "MAP" ? 1200 : mealPlan === "CP" ? 500 : 0;

  const ratePerNight = baseRatePerNight + mealSupplement * adults;
  const subtotal = ratePerNight * nights;
  const bstTax = Math.round(subtotal * 0.1); // 10% Bhutan Sales Tax
  const serviceCharge = Math.round(subtotal * 0.1); // 10% Service Charge
  const totalAmount = subtotal + bstTax + serviceCharge;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const ref = `BK-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setBookingRef(ref);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-500/40 bg-card p-8 shadow-2xl text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold text-foreground">
          Reservation Request Confirmed!
        </h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Tashi Delek, <span className="font-semibold text-foreground">{guestName}</span>! Your booking inquiry has been registered in the hotel front desk system.
        </p>

        <div className="mt-6 rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-left space-y-2 font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Booking Ref:</span>
            <span className="font-bold text-foreground">{bookingRef}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room & Plan:</span>
            <span className="text-foreground">{selectedRoomCode} · {mealPlan} ({nights} Nights)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated Total:</span>
            <span className="font-bold text-primary">BTN {totalAmount.toLocaleString("en-BT")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Settlement:</span>
            <span className="text-foreground">
              {paymentMethod === "rma_qr" ? "Bhutan RMA QR on Arrival" : paymentMethod === "desk" ? "Pay at Front Desk" : "Agent City Ledger"}
            </span>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          A confirmation SMS / voucher has been staged. Our front desk team will contact you at {guestPhone || guestEmail}.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => setIsSubmitted(false)}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Modify Booking
          </button>
          <Link
            href="/"
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      {/* Left Column: Form */}
      <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
        <div className="rounded-2xl border border-border/80 bg-card/80 p-6 shadow-xl backdrop-blur-xl space-y-5">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="size-5 text-primary" />
            Stay Dates & Guests
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Check-in Date</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Nights</label>
              <select
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 7, 10, 14].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "Night" : "Nights"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Adult Guests</label>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
              >
                {[1, 2, 3, 4, 6].map((a) => (
                  <option key={a} value={a}>
                    {a} {a === 1 ? "Adult" : "Adults"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-medium text-muted-foreground">Room Category</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {rooms.length > 0 ? (
                rooms.slice(0, 3).map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => setSelectedRoomCode(r.code)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      selectedRoomCode === r.code
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
                    }`}
                  >
                    <p className="font-bold text-xs">{r.name}</p>
                    <p className="mt-1 font-mono text-[11px] text-primary">{r.code}</p>
                  </button>
                ))
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedRoomCode("DLX")}
                    className={`rounded-xl border p-3 text-left ${selectedRoomCode === "DLX" ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <p className="font-bold text-xs">Deluxe Mountain Room</p>
                    <p className="text-[10px] text-muted-foreground">King Bed · Valley View</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRoomCode("STE")}
                    className={`rounded-xl border p-3 text-left ${selectedRoomCode === "STE" ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <p className="font-bold text-xs">Heritage Suite</p>
                    <p className="text-[10px] text-muted-foreground">Timber Balcony · Bukhari</p>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Meal Plan Selector */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-medium text-muted-foreground">Bhutan Meal Plan</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: "EP", label: "EP (Room Only)", desc: "No meals included" },
                { id: "CP", label: "CP (Bed & Breakfast)", desc: "Buffet breakfast" },
                { id: "MAP", label: "MAP (Half Board)", desc: "Breakfast + Dinner" },
                { id: "AP", label: "AP (Full Board)", desc: "Breakfast, Lunch & Dinner" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMealPlan(m.id as MealPlanType)}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    mealPlan === m.id
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p className="font-bold text-xs">{m.id}</p>
                  <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Guest Contact Info */}
          <div className="space-y-3 pt-3 border-t border-border/70">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Guest Information</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Primary Guest Full Name *</label>
                <input
                  type="text"
                  placeholder="Karma Dorji / Tenzin Wangmo"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground">Bhutan Phone Number *</label>
                <input
                  type="tel"
                  placeholder="+975 17 12 34 56"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  required
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="guest@example.bt"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Choice */}
          <div className="space-y-2 pt-3 border-t border-border/70">
            <label className="text-xs font-medium text-muted-foreground">Settlement Option</label>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("rma_qr")}
                className={`rounded-xl border p-3 text-left ${paymentMethod === "rma_qr" ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "border-border bg-background text-muted-foreground"}`}
              >
                <QrCode className="size-4 text-emerald-500 mb-1" />
                <p className="font-bold text-xs">Bhutan RMA QR</p>
                <p className="text-[10px] text-muted-foreground">mBOB / BNB / Druk PNB</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("desk")}
                className={`rounded-xl border p-3 text-left ${paymentMethod === "desk" ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "border-border bg-background text-muted-foreground"}`}
              >
                <CreditCard className="size-4 text-amber-500 mb-1" />
                <p className="font-bold text-xs">Pay at Hotel Desk</p>
                <p className="text-[10px] text-muted-foreground">Cash or POS Card on Arrival</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("agent")}
                className={`rounded-xl border p-3 text-left ${paymentMethod === "agent" ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "border-border bg-background text-muted-foreground"}`}
              >
                <Building className="size-4 text-sky-500 mb-1" />
                <p className="font-bold text-xs">Tour Agent Voucher</p>
                <p className="text-[10px] text-muted-foreground">B2B MoU City Ledger</p>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>Confirm & Reserve Room</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </form>

      {/* Right Column: Rate Breakdown Box */}
      <div className="lg:col-span-5">
        <div className="sticky top-24 rounded-2xl border border-border/80 bg-card/80 p-6 shadow-xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Rate Breakdown
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3" />
              Direct Booking Guaranteed
            </span>
          </div>

          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Selected Category:</span>
              <span className="font-semibold text-foreground">{selectedRoomCode}</span>
            </div>
            <div className="flex justify-between">
              <span>Stay Duration:</span>
              <span className="font-semibold text-foreground">{nights} Nights ({checkIn})</span>
            </div>
            <div className="flex justify-between">
              <span>Meal Plan:</span>
              <span className="font-semibold text-foreground">{mealPlan}</span>
            </div>

            <div className="border-t border-border/60 pt-3 space-y-2">
              <div className="flex justify-between">
                <span>Room Charges:</span>
                <span className="font-mono text-foreground">BTN {subtotal.toLocaleString("en-BT")}</span>
              </div>
              <div className="flex justify-between">
                <span>Bhutan Sales Tax (10% BST):</span>
                <span className="font-mono text-foreground">BTN {bstTax.toLocaleString("en-BT")}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charge (10% SC):</span>
                <span className="font-mono text-foreground">BTN {serviceCharge.toLocaleString("en-BT")}</span>
              </div>
            </div>

            <div className="border-t border-border/80 pt-3 flex justify-between items-baseline text-sm">
              <span className="font-bold text-foreground">Total Payable (BTN):</span>
              <span className="font-mono text-xl font-extrabold text-primary">
                BTN {totalAmount.toLocaleString("en-BT")}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="size-3.5 text-primary inline mr-1" />
            Gapless DRC Tax Invoice with official stamp provided at checkout. Zero credit card foreign transaction fees.
          </div>
        </div>
      </div>
    </div>
  );
}
