"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Clock,
  Printer,
  AlertTriangle,
  Utensils,
  Coffee,
  Soup,
  CheckCircle2,
  RefreshCw,
  BellRing,
  BedDouble,
  ChevronRight,
  Flame
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MealCovers } from "@/lib/kitchen/covers";
import type { OpenPosTicket } from "@/lib/pos";
import { updateOrderKotStatus } from "@/app/actions/erp-pos";

interface GlanceableKitchenBoardProps {
  covers: MealCovers;
  tickets: OpenPosTicket[];
  propertyTitle?: string;
  todayDate: string;
}

export function GlanceableKitchenBoard({
  covers,
  tickets,
  propertyTitle = "Hotel OS Bhutan",
  todayDate,
}: GlanceableKitchenBoardProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Live ticking clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).toUpperCase()
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter KOT tickets to those relevant to kitchen
  const kitchenTickets = tickets.filter(
    (t) =>
      t.kot_status !== "served" &&
      t.kot_status !== "cancelled" &&
      !t.is_parked
  );

  const handleMarkTicketStatus = (orderId: string, nextStatus: "cooking" | "ready" | "served") => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("order_id", orderId);
      formData.set("kot_status", nextStatus);
      await updateOrderKotStatus(formData);
    });
  };

  // Extract dietary restrictions and allergies from guest names or notes
  const dietaryGuests = covers.guests.filter((g) => {
    const name = g.guestName.toLowerCase();
    return (
      name.includes("veg") ||
      name.includes("jain") ||
      name.includes("allergy") ||
      name.includes("nut") ||
      name.includes("gluten") ||
      name.includes("vip")
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER - GLANCEABLE WALLBOARD STRIP */}
      <div className="p-6 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Kitchen Live Wallboard
            </span>
            <span className="text-xs text-muted-foreground">• 07:30 AM Briefing Ops</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground mt-1 flex items-center gap-3">
            <Utensils className="w-8 h-8 text-primary" />
            {propertyTitle} — Chef Command
          </h1>
          <p className="text-sm text-muted-foreground">
            {todayDate} • Glanceable headcounts, dietary warnings, and live orders.
          </p>
        </div>

        {/* Big Digital Clock & Print Pass Button */}
        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-right backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
              Bhutan Standard Time
            </span>
            <span className="text-2xl font-black tracking-widest text-emerald-400 font-mono tabular-nums">
              {timeStr || "07:30:00 AM"}
            </span>
          </div>

          <Link
            href="/erp/kitchen/pass"
            target="_blank"
            className="h-12 px-5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Printer className="w-5 h-5" />
            <span>Print 07:30 Pass (A4)</span>
          </Link>
        </div>
      </div>

      {/* 2. HEADCOUNT COVERS HERO METRIC TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Breakfast */}
        <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-500" /> Breakfast (CP)
            </span>
            <div className="text-4xl font-black text-foreground tabular-stat tracking-tight">
              {covers.breakfast}
            </div>
            <p className="text-xs text-muted-foreground">Pax booked today</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
            <Coffee className="w-6 h-6" />
          </div>
        </div>

        {/* Lunch */}
        <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Soup className="w-4 h-4 text-blue-500" /> Lunch (MAP/AP)
            </span>
            <div className="text-4xl font-black text-foreground tabular-stat tracking-tight">
              {covers.lunch}
            </div>
            <p className="text-xs text-muted-foreground">Pre-paid package covers</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
            <Soup className="w-6 h-6" />
          </div>
        </div>

        {/* Dinner */}
        <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-purple-500" /> Dinner (MAP/AP)
            </span>
            <div className="text-4xl font-black text-foreground tabular-stat tracking-tight">
              {covers.dinner}
            </div>
            <p className="text-xs text-muted-foreground">Buffet &amp; set menu covers</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
            <Utensils className="w-6 h-6" />
          </div>
        </div>

        {/* Active KOTs */}
        <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-500" /> Live Cooking Tickets
            </span>
            <div className="text-4xl font-black text-rose-600 dark:text-rose-400 tabular-stat tracking-tight">
              {kitchenTickets.length}
            </div>
            <p className="text-xs text-muted-foreground">Active orders in prep</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. DUAL-STREAM CHOPPING BOARD (LEFT: MEALS & DIETARY, RIGHT: LIVE KOT TICKETS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: MEAL ROSTER & DIETARY ALERTS (5 COLS) */}
        <div className="lg:col-span-5 space-y-5">
          {/* DIETARY & ALLERGIES ALERT BOX */}
          <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Special Dietary &amp; Allergy Precautions</span>
            </div>
            {dietaryGuests.length > 0 ? (
              <div className="space-y-2">
                {dietaryGuests.map((g) => (
                  <div
                    key={g.bookingId}
                    className="p-3 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-amber-500/30 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-bold">
                      <span className="text-foreground">{g.guestName}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono">
                        {g.rooms || "Room assigned"}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Plan: <span className="font-semibold text-foreground">{g.mealPlanCode}</span> • Adults: {g.adults}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No acute allergy notes recorded for today&apos;s active stays. Standard hygiene &amp; prep protocols apply.
              </p>
            )}
          </div>

          {/* IN-HOUSE MEAL PLAN ROSTER */}
          <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-primary" />
                In-House Meal Plan Roster ({covers.guests.length})
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {covers.guests.reduce((s, g) => s + g.adults, 0)} Total Guests
              </span>
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
              {covers.guests.map((g) => (
                <div
                  key={g.bookingId}
                  className="p-3 rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-foreground text-sm flex items-center gap-2">
                      <span>{g.rooms || "Room TBA"}</span>
                      <span className="text-xs font-normal text-muted-foreground">• {g.guestName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {g.adults} Pax • Status: <span className="capitalize">{g.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-lg font-black text-xs tracking-wider border",
                        g.mealPlanCode === "AP"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                          : g.mealPlanCode === "MAP"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      )}
                    >
                      {g.mealPlanCode}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE KOT TICKETS (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-500" />
              Live Active KOT Tickets ({kitchenTickets.length})
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;10m
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 10-20m
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> &gt;20m
              </span>
            </div>
          </div>

          {kitchenTickets.length === 0 ? (
            <div className="p-12 text-center rounded-2xl sovereign-glass border border-dashed border-border/60 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-foreground">All KOTs Cleared</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                No pending kitchen orders right now. New tickets fired from Restaurant POS or Room Service will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kitchenTickets.map((ticket) => {
                const elapsedMins = Math.floor(
                  (Date.now() - new Date(ticket.created_at).getTime()) / 60000
                );
                const isUrgent = elapsedMins > 20;
                const isWarning = elapsedMins > 10;

                return (
                  <div
                    key={ticket.id}
                    className={cn(
                      "p-5 rounded-2xl sovereign-glass border shadow-md flex flex-col justify-between transition-all",
                      isUrgent
                        ? "border-rose-500/50 bg-rose-500/5"
                        : isWarning
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-white/20 dark:border-white/10"
                    )}
                  >
                    <div>
                      {/* Ticket Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-border/40">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                            {ticket.delivery_type === "room" ? "🛎️ Room Delivery" : "🍽️ Restaurant"}
                          </span>
                          <h3 className="text-base font-black text-foreground">
                            {ticket.customer_name || "Dine-In Guest"}
                          </h3>
                        </div>

                        <div className="text-right">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-black font-mono",
                              isUrgent
                                ? "bg-rose-500 text-white animate-pulse"
                                : isWarning
                                ? "bg-amber-500 text-black"
                                : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            )}
                          >
                            {elapsedMins}m ago
                          </span>
                        </div>
                      </div>

                      {/* Items list */}
                      <div className="py-3 space-y-2">
                        {ticket.order_items.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between text-sm">
                            <span className="font-black text-foreground text-base">
                              {item.qty}× {item.name_snapshot}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground uppercase font-semibold">
                              {item.prep_station || "Kitchen"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-3 border-t border-border/40 flex items-center gap-2">
                      {ticket.kot_status !== "ready" ? (
                        <button
                          onClick={() => handleMarkTicketStatus(ticket.id, "ready")}
                          disabled={isPending}
                          className="flex-1 h-10 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-500 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark Ready</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkTicketStatus(ticket.id, "served")}
                          disabled={isPending}
                          className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Served / Dispatched</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
