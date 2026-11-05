"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BedDouble,
  Calendar,
  User,
  Users,
  Building,
  DollarSign,
  UtensilsCrossed,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  Plus,
  Minus,
  Search,
  ChevronDown,
  ShieldCheck,
  CreditCard,
  Phone,
  FileText,
  BadgePercent,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createFastBooking, type DeskBookIntent } from "@/app/actions/fast-book";
import { formatGuestBtn } from "@/lib/pricing";
import { thimphuToday } from "@/lib/erp-lists";
import type { FastBookRoomType } from "@/components/erp/FastBookForm";
import type { BookableAgent } from "@/components/erp/AgentPicker";

interface SmartFastBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypes: FastBookRoomType[];
  agents: BookableAgent[];
  cleanUnits?: Array<{
    id: string;
    label: string;
    roomTypeId: string;
    hkStatus: string;
  }>;
  mealPlans?: Array<{
    code: string;
    name: string;
    blurb: string | null;
    amountPerAdultNight?: number | null;
  }>;
  property?: {
    id?: string;
    name: string;
  };
  defaults?: {
    checkIn?: string;
    checkOut?: string;
    roomUnitId?: string;
    mealPlanCode?: string;
    guestOrigin?: string;
  };
  onSuccess: (bookingId: string, intent: DeskBookIntent) => void;
  onSwitchToAdvanced?: () => void;
}

type BookingProfile = "agent" | "walk_in" | "corporate";

export function SmartFastBookingModal({
  open,
  onOpenChange,
  roomTypes,
  agents,
  cleanUnits = [],
  mealPlans = [],
  property,
  defaults,
  onSuccess,
  onSwitchToAdvanced,
}: SmartFastBookingModalProps) {
  const today = thimphuToday();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Booking Profile Presets (Lazy 1-Click)
  const [profile, setProfile] = useState<BookingProfile>("agent");

  // Primary Guest Details
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guideNumber, setGuideNumber] = useState("");
  const [agentId, setAgentId] = useState("");

  // Dates
  const [checkIn, setCheckIn] = useState(defaults?.checkIn || today);
  const [checkOut, setCheckOut] = useState(
    defaults?.checkOut ||
      new Date(new Date(defaults?.checkIn || today).getTime() + 86400000)
        .toISOString()
        .slice(0, 10)
  );

  // Selected Room Quantities: { [roomTypeCode]: quantity }
  const [roomQuantities, setRoomQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (roomTypes.length > 0) {
      initial[roomTypes[0].code] = 1;
    }
    return initial;
  });

  // Selected Specific Door (optional fast assignment)
  const [selectedDoorId, setSelectedDoorId] = useState<string>(defaults?.roomUnitId || "");

  // Meal Plan Code
  const [mealPlanCode, setMealPlanCode] = useState<string>(
    defaults?.mealPlanCode || "MAP"
  );

  // Custom Nightly Rate Override (optional)
  const [customRate, setCustomRate] = useState<string>("");

  // Calculate nights
  const nights = useMemo(() => {
    const d1 = new Date(checkIn).getTime();
    const d2 = new Date(checkOut).getTime();
    return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) || 1);
  }, [checkIn, checkOut]);

  // Adjust defaults on profile switch
  const handleSelectProfile = (p: BookingProfile) => {
    setProfile(p);
    if (p === "agent") {
      setMealPlanCode("MAP");
      if (agents.length > 0 && !agentId) {
        setAgentId(agents[0].id);
      }
    } else if (p === "walk_in") {
      setMealPlanCode("EP");
      setAgentId("");
    } else if (p === "corporate") {
      setMealPlanCode("CP");
    }
  };

  // Helper: Quick Duration Click
  const handleSetNights = (n: number) => {
    const startDate = new Date(checkIn);
    const endDate = new Date(startDate.getTime() + n * 86400000);
    setCheckOut(endDate.toISOString().slice(0, 10));
  };

  // Active selected room type
  const activeRoomType = useMemo(() => {
    for (const rt of roomTypes) {
      if ((roomQuantities[rt.code] || 0) > 0) return rt;
    }
    return roomTypes[0] || null;
  }, [roomTypes, roomQuantities]);

  // Live Price Calculation
  const estimatedTotal = useMemo(() => {
    let subtotal = 0;
    for (const rt of roomTypes) {
      const qty = roomQuantities[rt.code] || 0;
      if (qty <= 0) continue;
      const rate = customRate ? Number(customRate) : 3500; // estimated fallback tariff
      subtotal += rate * qty * nights;
    }
    // Add meal estimate if MAP/AP
    if (mealPlanCode === "MAP") subtotal += 800 * nights;
    if (mealPlanCode === "AP") subtotal += 1500 * nights;
    return subtotal;
  }, [roomTypes, roomQuantities, nights, customRate, mealPlanCode]);

  // Handle Form Submission
  const handleSubmitBooking = (intent: DeskBookIntent) => {
    if (!guestName.trim()) {
      toast.error("Please enter the guest's name.");
      return;
    }
    if (profile === "agent" && !agentId) {
      toast.error("Please select a tour operator / travel agent.");
      return;
    }

    startTransition(async () => {
      const toastId = intent === "check_in" ? "instant_ci" : "create_res";
      toast.loading(
        intent === "check_in" ? "Creating & checking in guest..." : "Creating reservation...",
        { id: toastId }
      );

      const fd = new FormData();
      fd.set("contact_name", guestName.trim());
      if (phone.trim()) fd.set("contact_phone", phone.trim());
      if (email.trim()) fd.set("contact_email", email.trim());
      fd.set("check_in", checkIn);
      fd.set("check_out", checkOut);
      fd.set("adults", "2");
      fd.set("children", "0");
      fd.set("meal_plan_code", mealPlanCode);

      if (profile === "agent") {
        fd.set("source", "agent");
        fd.set("payment_mode", "on_credit");
        fd.set("guest_origin", "international");
        fd.set("agent_id", agentId);
        if (guideNumber.trim()) fd.set("guide_number", guideNumber.trim());
        fd.set("guest_details_later", guideNumber.trim() ? "0" : "1");
      } else if (profile === "corporate") {
        fd.set("source", "corporate");
        fd.set("payment_mode", "on_credit");
        fd.set("guest_origin", "regional");
        if (agentId) fd.set("agent_id", agentId);
      } else {
        fd.set("source", "walk_in");
        fd.set("payment_mode", "cash");
        fd.set("guest_origin", "regional");
      }

      // Room quantities
      let totalQty = 0;
      for (const rt of roomTypes) {
        const q = roomQuantities[rt.code] || 0;
        if (q > 0) {
          fd.set(`qty_${rt.code}`, String(q));
          totalQty += q;
          if (customRate) {
            fd.set(`agreed_rate_${rt.code}`, customRate);
            fd.set("rate_reason", "Smart Desk Reservation Tariff");
          }
        }
      }

      if (totalQty === 0 && roomTypes[0]) {
        fd.set(`qty_${roomTypes[0].code}`, "1");
      }

      if (selectedDoorId) {
        fd.set("room_unit_id", selectedDoorId);
      }

      fd.set("desk_book_intent", intent);

      try {
        const res = await createFastBooking({ ok: false }, fd);
        if (res.ok && res.bookingId) {
          toast.success(
            intent === "check_in"
              ? `✓ Checked In! Room ${res.confirmationCode ?? ""}`
              : `✓ Confirmed! Ref: ${res.confirmationCode ?? ""}`,
            { id: toastId }
          );
          onSuccess(res.bookingId, intent);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Failed to create reservation", { id: toastId });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error creating booking";
        toast.error(msg, { id: toastId });
      }
    });
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-4xl sm:max-w-5xl my-auto rounded-3xl bg-background border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular Top Ambient Edge */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4 fill-current" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                Smart Desk Reservation Engine
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                Bhutan Express
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              30-Second reservation flow. Fast, lazy, and pre-configured for Bhutan hotel operations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToAdvanced && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSwitchToAdvanced}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                title="Switch to detailed multi-group rate sheet"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Advanced Sheet</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-5 flex-1">
          {/* STEP 1: 3 LAZY BOOKING PRESETS */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
              1. Select Booking Profile Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* PRESET 1: TRAVEL AGENT */}
              <button
                type="button"
                onClick={() => handleSelectProfile("agent")}
                className={cn(
                  "p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all relative overflow-hidden",
                  profile === "agent"
                    ? "bg-primary/10 border-primary ring-2 ring-primary/30 shadow-md"
                    : "bg-muted/30 border-border/60 hover:bg-muted/60"
                )}
              >
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  <Building className="w-5 h-5" />
                </span>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-black text-foreground flex items-center justify-between">
                    <span>Tour Operator / Agent</span>
                    {profile === "agent" && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Billed to Agent Credit MOU. Pre-sets MAP Half Board.
                  </p>
                </div>
              </button>

              {/* PRESET 2: WALK-IN / DIRECT */}
              <button
                type="button"
                onClick={() => handleSelectProfile("walk_in")}
                className={cn(
                  "p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all relative overflow-hidden",
                  profile === "walk_in"
                    ? "bg-primary/10 border-primary ring-2 ring-primary/30 shadow-md"
                    : "bg-muted/30 border-border/60 hover:bg-muted/60"
                )}
              >
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <User className="w-5 h-5" />
                </span>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-black text-foreground flex items-center justify-between">
                    <span>Walk-In / Direct Guest</span>
                    {profile === "walk_in" && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Guest pays Cash/QR on arrival. Pre-sets EP Room Only.
                  </p>
                </div>
              </button>

              {/* PRESET 3: CORPORATE MOU */}
              <button
                type="button"
                onClick={() => handleSelectProfile("corporate")}
                className={cn(
                  "p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all relative overflow-hidden",
                  profile === "corporate"
                    ? "bg-primary/10 border-primary ring-2 ring-primary/30 shadow-md"
                    : "bg-muted/30 border-border/60 hover:bg-muted/60"
                )}
              >
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </span>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-black text-foreground flex items-center justify-between">
                    <span>Corporate / Long Stay</span>
                    {profile === "corporate" && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Government / NGO contracted stay. Pre-sets CP Breakfast.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* STEP 2: GUEST & AGENCY DETAILS */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3.5">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              <span>2. Guest &amp; Agency Information</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Primary Guest Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tashi Dorji / Mr. Balint"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border/70 bg-background text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="e.g. +975 17123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border/70 bg-background text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {profile === "agent" ? (
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">
                    Select Tour Operator <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-border/70 bg-background text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Choose Agent Partner…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.company_name} ({a.market || "General"})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="guest@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border/70 bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              )}
            </div>

            {profile === "agent" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Tour Guide License # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TG-12345"
                    value={guideNumber}
                    onChange={(e) => setGuideNumber(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border/60 bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center text-[11px] text-muted-foreground pt-4">
                  <span>* International tourist guide requirement can be waived on booking and completed on arrival.</span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: STAY SCHEDULE & DURATION */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>3. Stay Dates &amp; Duration</span>
              </span>

              {/* DURATION CHIPS */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 5, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSetNights(num)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all",
                      nights === num
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted border border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {num}N
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Check-In Date
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border/70 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Check-Out Date ({nights} Nights)
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border/70 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {/* STEP 4: ROOM CATEGORIES & LIVE AVAILABILITY */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-emerald-500" />
              <span>4. Room Selection &amp; Meal Plan</span>
            </span>

            {/* ROOM CATEGORY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {roomTypes.map((rt) => {
                const qty = roomQuantities[rt.code] || 0;
                const isSelected = qty > 0;

                return (
                  <div
                    key={rt.id}
                    className={cn(
                      "p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2",
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500 shadow-sm"
                        : "bg-background border-border/60"
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-foreground truncate">
                          {rt.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground">
                          {rt.code}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Standard Rack Tariff
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {qty > 0 ? `${qty} Room(s)` : "None"}
                      </span>

                      <div className="flex items-center gap-1.5 bg-muted rounded-xl p-1 border border-border/50">
                        <button
                          type="button"
                          onClick={() => {
                            setRoomQuantities((prev) => ({
                              ...prev,
                              [rt.code]: Math.max(0, (prev[rt.code] || 0) - 1),
                            }));
                          }}
                          className="w-6 h-6 rounded-lg bg-background flex items-center justify-center hover:bg-muted text-foreground transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-mono font-bold">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRoomQuantities((prev) => ({
                              ...prev,
                              [rt.code]: (prev[rt.code] || 0) + 1,
                            }));
                          }}
                          className="w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MEAL PLAN & FAST DOOR PICKER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Included Meal Plan
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { code: "EP", label: "EP (Room)" },
                    { code: "CP", label: "CP (B/F)" },
                    { code: "MAP", label: "MAP (Half)" },
                    { code: "AP", label: "AP (All)" },
                  ].map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => setMealPlanCode(m.code)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-mono font-bold border transition-all text-center",
                        mealPlanCode === m.code
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background border-border/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Pre-Assign Physical Room Door (Optional)
                </label>
                <select
                  value={selectedDoorId}
                  onChange={(e) => setSelectedDoorId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border/70 bg-background text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Auto-Assign on Check-In</option>
                  {cleanUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Room {u.label} ({u.hkStatus.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TELEMETRY ESTIMATE CARD */}
          <div className="p-4 rounded-2xl sovereign-glass border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                Estimated Reservation Value
              </span>
              <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                Nu. {formatGuestBtn(estimatedTotal)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {nights} Nights • {mealPlanCode} Meal Plan • Inclusive of Bhutan Tourism GST &amp; Service Charge
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                {profile === "agent" ? "🏢 Bill to Agent Credit" : "💵 Direct Front Desk Pay"}
              </span>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER WITH 3 INSTANT LAZY ACTIONS */}
        <div className="p-4 sm:p-5 border-t border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-11 px-4 text-xs font-bold rounded-xl order-last sm:order-first"
          >
            Cancel
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {/* ACTION 1: 24H HOLD */}
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleSubmitBooking("reserve")}
              className="h-11 px-4 text-xs font-bold rounded-xl gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Hold 24h</span>
            </Button>

            {/* ACTION 2: CONFIRM RESERVATION */}
            <Button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmitBooking("confirm")}
              className="h-11 px-5 text-xs font-black rounded-xl bg-primary text-primary-foreground gap-2 shadow-md active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Reservation</span>
            </Button>

            {/* ACTION 3: 1-TAP INSTANT CHECK-IN (FOR TODAY ARRIVALS) */}
            <Button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmitBooking("check_in")}
              className="h-11 px-5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              title="Instant check-in: creates booking, assigns room, and opens stay hub"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>1-Tap Check-In Now</span>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
