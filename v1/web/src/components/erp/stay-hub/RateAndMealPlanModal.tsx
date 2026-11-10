"use client";

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  DollarSign,
  UtensilsCrossed,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  AlertCircle,
  HelpCircle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setAgreedNightlyRate } from "@/app/actions/erp-agreed-rate";
import { changeStayMealPlanWithPin } from "@/app/actions/erp-folio-ops";
import { loadStayNightMeals, saveStayNightMeals, type NightMeal } from "@/app/actions/erp-night-meals";
import { checkIsDeskAdminOrManager } from "@/app/actions/desk";
import { formatGuestBtn } from "@/lib/pricing";

interface RateAndMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  folioId?: string | null;
  propertyId: string;
  contactName: string;
  roomLabel?: string | null;
  currentMealPlan?: string | null;
  currentNightlyRate?: number | null;
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  onSuccess: () => void;
}

const MEAL_PLANS = [
  { code: "EP", name: "EP — Room Only", desc: "European Plan (No meals included)", badge: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400" },
  { code: "CP", name: "CP — Bed & Breakfast", desc: "Continental Plan (Breakfast included)", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { code: "MAP", name: "MAP — Half Board", desc: "Breakfast + Dinner (Most Bhutan Tours)", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { code: "AP", name: "AP — Full Board", desc: "All 3 Meals (Breakfast, Lunch, Dinner)", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

const REASONS = [
  "Tour Operator Agreed MOU Tariff",
  "Corporate Partner Negotiated Rate",
  "Seasonal Promotional Discount",
  "Owner / Family Courtesy Rate",
  "Long-Stay Volume Discount",
  "Guest Complaint Service Recovery",
];

export function RateAndMealPlanModal({
  isOpen,
  onClose,
  bookingId,
  folioId,
  propertyId,
  contactName,
  roomLabel,
  currentMealPlan = "EP",
  currentNightlyRate,
  checkIn,
  checkOut,
  adults = 2,
  children = 0,
  onSuccess,
}: RateAndMealPlanModalProps) {
  const [activeTab, setActiveTab] = useState<"entire_stay" | "daily_nights">("entire_stay");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mode 1: Entire Stay States
  const [selectedMealPlan, setSelectedMealPlan] = useState<string>(
    (currentMealPlan || "EP").toUpperCase()
  );
  const [rateOverrideActive, setRateOverrideActive] = useState<boolean>(
    currentNightlyRate != null && currentNightlyRate > 0
  );
  const [nightlyRate, setNightlyRate] = useState<string>(
    currentNightlyRate != null && currentNightlyRate > 0 ? String(currentNightlyRate) : ""
  );
  const [selectedReason, setSelectedReason] = useState<string>(REASONS[0]);
  const [managerPin, setManagerPin] = useState<string>("");

  // Mode 2: Daily Night Breakdown States
  const [dailyNights, setDailyNights] = useState<NightMeal[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // Check admin role on open
  useEffect(() => {
    if (!isOpen) return;
    setCheckingRole(true);
    void checkIsDeskAdminOrManager().then((admin) => {
      setIsAdmin(admin);
      setCheckingRole(false);
    });
  }, [isOpen]);

  // Load Daily Nights when opening daily tab
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "daily_nights") {
      setLoadingDaily(true);
      void loadStayNightMeals(bookingId).then((res) => {
        setLoadingDaily(false);
        if (res.ok) {
          setDailyNights(res.nights);
        } else {
          toast.error("Could not load night-by-night breakdown: " + res.error);
        }
      });
    }
  }, [isOpen, activeTab, bookingId]);

  if (!isOpen) return null;

  // Handle Entire Stay Save
  const handleSaveEntireStay = () => {
    const mealChanged = selectedMealPlan !== (currentMealPlan || "EP").toUpperCase();
    const rateChanged = rateOverrideActive
      ? Number(nightlyRate) !== currentNightlyRate
      : currentNightlyRate != null;

    if (!mealChanged && !rateChanged) {
      toast.info("No changes were made to rate or meal plan.");
      onClose();
      return;
    }

    if (!isAdmin && !managerPin.trim()) {
      toast.error("Please enter the Manager PIN to authorize this change.");
      return;
    }

    startTransition(async () => {
      toast.loading("Updating rates & meal plan...", { id: "rate_update" });

      try {
        // Update Nightly Rate if changed
        if (rateChanged) {
          const rateFd = new FormData();
          rateFd.set("booking_id", bookingId);
          if (managerPin.trim()) {
            rateFd.set("manager_pin", managerPin.trim());
          }
          rateFd.set("reason", selectedReason);
          rateFd.set("adjust_posted", "1");

          if (rateOverrideActive && Number(nightlyRate) >= 0) {
            rateFd.set("agreed_nightly_rate_btn", String(Number(nightlyRate)));
            if (selectedMealPlan === "EP") {
              rateFd.set("set_ep", "1");
            }
          } else {
            rateFd.set("clear", "1");
          }

          const rateRes = await setAgreedNightlyRate({ ok: false }, rateFd);
          if (!rateRes.ok) {
            toast.error(rateRes.error ?? "Failed to update nightly rate", { id: "rate_update" });
            return;
          }
        }

        // Update Meal Plan if changed and folio exists
        if (mealChanged && folioId) {
          const mealFd = new FormData();
          mealFd.set("folio_id", folioId);
          mealFd.set("meal_plan_code", selectedMealPlan);
          mealFd.set("reason", selectedReason);
          if (managerPin.trim()) {
            mealFd.set("manager_pin", managerPin.trim());
          }

          const mealRes = await changeStayMealPlanWithPin({ ok: false }, mealFd);
          if (!mealRes.ok) {
            toast.error(mealRes.error ?? "Failed to update meal plan", { id: "rate_update" });
            return;
          }
        }

        toast.success("✓ Rate & meal plan successfully updated!", { id: "rate_update" });
        onSuccess();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error saving changes";
        toast.error(msg, { id: "rate_update" });
      }
    });
  };

  // Handle Daily Nights Save
  const handleSaveDailyNights = () => {
    if (dailyNights.length === 0) {
      toast.error("No nights to save.");
      return;
    }

    if (!isAdmin && !managerPin.trim()) {
      toast.error("Please enter the Manager PIN to authorize daily schedule changes.");
      return;
    }

    startTransition(async () => {
      toast.loading("Saving daily night schedule...", { id: "daily_save" });
      const fd = new FormData();
      fd.set("booking_id", bookingId);
      if (managerPin.trim()) {
        fd.set("manager_pin", managerPin.trim());
      }
      fd.set(
        "nights_json",
        JSON.stringify(
          dailyNights.map((n) => ({
            date: n.date,
            mealPlanCode: n.mealPlanCode,
            rooms: n.rooms.map((r) => ({
              roomUnitId: r.roomUnitId,
              rateBtn: r.rateBtn,
            })),
          }))
        )
      );

      try {
        const res = await saveStayNightMeals({ ok: false }, fd);
        if (res.ok) {
          toast.success("✓ Daily night schedule saved!", { id: "daily_save" });
          onSuccess();
          onClose();
        } else {
          toast.error(res.error ?? "Failed to save daily nights", { id: "daily_save" });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error saving daily schedule";
        toast.error(msg, { id: "daily_save" });
      }
    });
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl my-auto rounded-3xl bg-background border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular Top Edge */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <UtensilsCrossed className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                Meal Plan &amp; Nightly Rate Controller
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {contactName} {roomLabel ? `• Room ${roomLabel}` : ""} • {checkIn} → {checkOut}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* NAVIGATION MODE TABS */}
        <div className="px-5 sm:px-6 pt-3 pb-0 border-b border-border/40 bg-muted/10 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("entire_stay")}
              className={cn(
                "pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all",
                activeTab === "entire_stay"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Entire Stay (Flat Rate &amp; Plan)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("daily_nights")}
              className={cn(
                "pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all",
                activeTab === "daily_nights"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Daily Night-by-Night Breakdown</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* ========================================================= */}
          {/* TAB 1: ENTIRE STAY FLAT RATE & MEAL PLAN                  */}
          {/* ========================================================= */}
          {activeTab === "entire_stay" && (
            <div className="space-y-5">
              {/* MEAL PLAN SELECTOR */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                  <span>Choose Meal Plan for Stay</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MEAL_PLANS.map((plan) => {
                    const isSelected = selectedMealPlan === plan.code;
                    return (
                      <button
                        key={plan.code}
                        type="button"
                        onClick={() => setSelectedMealPlan(plan.code)}
                        className={cn(
                          "p-3 rounded-2xl text-left border transition-all relative overflow-hidden flex flex-col justify-between gap-1",
                          isSelected
                            ? "bg-primary/10 border-primary shadow-sm"
                            : "bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-foreground flex items-center gap-1.5">
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono font-bold", plan.badge)}>
                              {plan.code}
                            </span>
                            <span>{plan.name.split("—")[1]}</span>
                          </span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {plan.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NIGHTLY RATE OVERRIDE */}
              <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span>Agreed Nightly Room Rate (Nu.)</span>
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Override standard rack rate sheet with an agreed client tariff.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !rateOverrideActive;
                      setRateOverrideActive(next);
                      if (!next) setNightlyRate("");
                    }}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold border transition-colors",
                      rateOverrideActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-muted text-muted-foreground border-border/60"
                    )}
                  >
                    {rateOverrideActive ? "Custom Active" : "Standard Rate"}
                  </button>
                </div>

                {rateOverrideActive && (
                  <div className="pt-2 animate-in fade-in duration-150 space-y-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">
                        Nu.
                      </span>
                      <input
                        type="number"
                        step="50"
                        placeholder="e.g. 3500"
                        value={nightlyRate}
                        onChange={(e) => setNightlyRate(e.target.value)}
                        className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/80 bg-background font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      * Tax basis will calculate automatically based on property GST rules.
                    </p>
                  </div>
                )}
              </div>

              {/* REASON & AUTHORIZATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Approval Reason
                  </label>
                  <select
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-border/70 bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ROLE-AWARE AUTHORIZATION: ADMIN (NO PIN) VS FO (PIN REQUIRED) */}
                <div>
                  {isAdmin ? (
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Authorization Status
                      </label>
                      <div className="h-10 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Admin Session Active (PIN exempt)</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1 flex items-center justify-between">
                        <span>Manager Approval PIN</span>
                        <span className="text-[10px] text-rose-500 font-bold">* Required for Front Desk</span>
                      </label>
                      <input
                        type="password"
                        maxLength={8}
                        placeholder="Enter Manager PIN"
                        value={managerPin}
                        onChange={(e) => setManagerPin(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-border/70 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: DAILY NIGHT-BY-NIGHT BREAKDOWN                      */}
          {/* ========================================================= */}
          {activeTab === "daily_nights" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Configure specific meal plans and rates per date. For example, guests arriving late can have <strong>CP</strong> on night 1 and <strong>MAP</strong> on night 2.
                </p>
              </div>

              {loadingDaily ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Loading nights schedule...</span>
                </div>
              ) : dailyNights.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No individual night records found. You can update using the Entire Stay tab.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dailyNights.map((night, idx) => (
                    <div
                      key={night.date}
                      className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-black font-mono text-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>Night {idx + 1}: {night.date}</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Room {night.rooms.map((r) => r.label).join(", ") || roomLabel || "101"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* MEAL SELECTOR FOR THIS NIGHT */}
                        <div className="flex items-center gap-1 bg-background rounded-xl p-1 border border-border/60">
                          {["EP", "CP", "MAP", "AP"].map((code) => {
                            const isCur = night.mealPlanCode === code;
                            return (
                              <button
                                key={code}
                                type="button"
                                onClick={() => {
                                  const updated = [...dailyNights];
                                  updated[idx] = { ...updated[idx], mealPlanCode: code };
                                  setDailyNights(updated);
                                }}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all",
                                  isCur
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {code}
                              </button>
                            );
                          })}
                        </div>

                        {/* RATE INPUT FOR THIS NIGHT */}
                        {night.rooms[0] && (
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                              Nu.
                            </span>
                            <input
                              type="number"
                              step="50"
                              placeholder="Rate"
                              value={night.rooms[0].rateBtn ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : Number(e.target.value);
                                const updated = [...dailyNights];
                                const updatedRooms = [...updated[idx].rooms];
                                updatedRooms[0] = { ...updatedRooms[0], rateBtn: val };
                                updated[idx] = { ...updated[idx], rooms: updatedRooms };
                                setDailyNights(updated);
                              }}
                              className="w-full h-8 pl-8 pr-2 rounded-xl border border-border/60 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DAILY TAB AUTHORIZATION: ADMIN (NO PIN) VS FO (PIN REQUIRED) */}
              <div className="pt-2">
                {isAdmin ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Admin Session Active — Instant Save without Manager PIN</span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 dark:text-amber-300">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Manager Approval PIN Required for Front Desk Staff</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Front desk modifications to daily rates or meal schedules require manager sign-off.
                    </p>
                    <div className="max-w-xs pt-1">
                      <input
                        type="password"
                        maxLength={8}
                        placeholder="Enter Manager PIN to authorize"
                        value={managerPin}
                        onChange={(e) => setManagerPin(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-border/70 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 px-4 text-xs font-bold rounded-xl"
          >
            Cancel
          </Button>

          {activeTab === "entire_stay" ? (
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSaveEntireStay}
              className="h-10 px-5 text-xs font-black rounded-xl bg-primary text-primary-foreground gap-2 shadow active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Stay Plan &amp; Rate</span>
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isPending || dailyNights.length === 0}
              onClick={handleSaveDailyNights}
              className="h-10 px-5 text-xs font-black rounded-xl bg-primary text-primary-foreground gap-2 shadow active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Daily Schedule</span>
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
