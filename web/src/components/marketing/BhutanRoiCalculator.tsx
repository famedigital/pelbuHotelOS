"use client";

import { useState } from "react";
import { TrendingUp, Sparkles } from "lucide-react";

export function BhutanRoiCalculator() {
  const [rooms, setRooms] = useState<number>(18);
  const [rate, setRate] = useState<number>(4500);
  const [occupancy, setOccupancy] = useState<number>(65);

  // Calculations
  const totalRoomNightsYear = rooms * 365;
  const occupiedNightsYear = Math.round(totalRoomNightsYear * (occupancy / 100));
  const annualGrossRevenue = occupiedNightsYear * rate;

  // Assuming standard OTA commission is 18% on roughly 40% of unmanaged rooms
  const otaExposureShare = 0.35; // 35% typically booked through high-commission foreign OTAs without Hotel OS
  const otaCommissionsLost = Math.round(
    annualGrossRevenue * otaExposureShare * 0.18,
  );

  // Hotel OS annual fee for Classic or Plus package
  const hotelOsAnnualCost = rooms <= 15 ? 34800 : 58800; // BTN 2,900/mo or 4,900/mo
  const netSavings = Math.max(0, otaCommissionsLost - hotelOsAnnualCost);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/75 p-6 shadow-2xl backdrop-blur-xl md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/70 pb-6">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Bhutan Hotel Economics
          </span>
          <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            OTA Commission vs Sovereign Profit Calculator
          </h3>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Sparkles className="size-3.5" />
          <span>Keep Profits in Bhutan</span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Sliders Input Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Slider 1: Rooms */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <span>Sellable Rooms:</span>
              <span className="font-mono text-primary font-bold">{rooms} Rooms</span>
            </div>
            <input
              type="range"
              min={6}
              max={60}
              step={1}
              value={rooms}
              onChange={(e) => setRooms(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Boutique (6 rooms)</span>
              <span>Heritage Lodge (30 rooms)</span>
              <span>Resort (60 rooms)</span>
            </div>
          </div>

          {/* Slider 2: Average Daily Rate */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <span>Average Daily Rate (ADR):</span>
              <span className="font-mono text-primary font-bold">
                BTN {rate.toLocaleString("en-BT")} / night
              </span>
            </div>
            <input
              type="range"
              min={2500}
              max={15000}
              step={250}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Standard (Nu. 2,500)</span>
              <span>Deluxe (Nu. 6,000)</span>
              <span>Luxury Heritage (Nu. 15,000)</span>
            </div>
          </div>

          {/* Slider 3: Occupancy Rate */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <span>Annual Average Occupancy:</span>
              <span className="font-mono text-primary font-bold">{occupancy}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={95}
              step={5}
              value={occupancy}
              onChange={(e) => setOccupancy(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>30% (Low season)</span>
              <span>65% (Healthy Bhutan average)</span>
              <span>95% (Festival peak)</span>
            </div>
          </div>
        </div>

        {/* Results Output Box */}
        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 shadow-xl backdrop-blur-xl">
            <div
              className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-20"
              style={{ background: "#10b981" }}
              aria-hidden
            />

            <p className="text-xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
              Projected Annual Savings
            </p>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xs text-muted-foreground font-mono">BTN</span>
              <p className="font-mono text-3xl font-extrabold text-foreground sm:text-4xl">
                {netSavings.toLocaleString("en-BT")}
              </p>
              <span className="text-xs text-muted-foreground">/ yr</span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Money kept in your hotel by empowering local B2B travel agent MoU direct bookings instead of paying 18% foreign OTA commission fees.
            </p>

            <div className="mt-5 space-y-2 border-t border-emerald-500/20 pt-4 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Annual Gross Room Sales:</span>
                <span className="font-mono font-semibold text-foreground">
                  BTN {annualGrossRevenue.toLocaleString("en-BT")}
                </span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>18% Foreign OTA Commission Leak:</span>
                <span className="font-mono font-semibold">
                  - BTN {otaCommissionsLost.toLocaleString("en-BT")}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Hotel OS Bhutan (Flat BTN fee):</span>
                <span className="font-mono font-semibold text-foreground">
                  BTN {hotelOsAnnualCost.toLocaleString("en-BT")} / yr
                </span>
              </div>
            </div>

            <div className="mt-6">
              <a
                href="/demo"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
              >
                <span>Modernize Your Property Today</span>
                <TrendingUp className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
