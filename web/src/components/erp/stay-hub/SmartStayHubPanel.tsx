"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BedDouble,
  CreditCard,
  User,
  Users,
  Calendar,
  Zap,
  Phone,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ArrowRight,
  Printer,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Building,
  Maximize2,
  Minimize2,
  PlusCircle,
  Receipt,
  Clock,
  Car,
  UtensilsCrossed,
  Edit3,
  Shirt,
  Luggage,
  ExternalLink,
  Coins
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGuestBtn } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fastOneTapCheckIn } from "@/app/actions/erp-checkin";
import { checkoutStayAtomic } from "@/app/actions/folio-cashier";
import { openMasterBillPrint } from "@/app/actions/erp-folio-ops";
import { postFolioPayment } from "@/app/actions/erp-pos";
import { StayHubDualLedger } from "@/components/erp/stay-hub/StayHubDualLedger";
import { StayBillAddons } from "@/components/erp/stay-hub/StayBillAddons";
import { QuickBhutanQrModal } from "@/components/erp/pos/QuickBhutanQrModal";
import { RateAndMealPlanModal } from "@/components/erp/stay-hub/RateAndMealPlanModal";
import { RoomAssignmentModal } from "@/components/erp/stay-hub/RoomAssignmentModal";
import type { StayHubMoneyPayload, StayHubSummary } from "@/app/actions/stay-hub";

export type StayHubTabKey = "overview" | "ledger" | "charges" | "payments" | "guest" | "docs";

interface SmartStayHubPanelProps {
  summary: StayHubSummary;
  money: StayHubMoneyPayload | null;
  propertyId: string;
  onRefresh: () => void;
  onOpenAdvanced?: () => void;
  onClose: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function SmartStayHubPanel({
  summary,
  money,
  propertyId,
  onRefresh,
  onOpenAdvanced,
  onClose,
  isExpanded = false,
  onToggleExpand,
}: SmartStayHubPanelProps) {
  const [activeTab, setActiveTab] = useState<StayHubTabKey>("overview");
  const [isPending, startTransition] = useTransition();

  // Payment states in Cashier tab
  const [payMethod, setPayMethod] = useState<"cash" | "bank_qr" | "card" | "agent_credit">("cash");
  const [payAmount, setPayAmount] = useState<string>("");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  const isAgentStay = Boolean(
    summary.agentId ||
    summary.agentName ||
    (summary.source && summary.source.toLowerCase().includes("agent"))
  );

  const status = summary.status?.toLowerCase() ?? "confirmed";
  const isInHouse = status === "checked_in";
  const isCheckedOut = status === "checked_out";
  const isArrival = !isInHouse && !isCheckedOut;

  const guestBalance = money?.guestVisibleBalanceBtn ?? money?.balanceBtn ?? 0;
  const isBalanceZero = Math.abs(guestBalance) <= 0.5;

  const pax = (summary.adults || 0) + (summary.children || 0);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(summary.checkOut).getTime() - new Date(summary.checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
    ) || 1
  );

  // Auto initialize pay amount to balance
  const activeSuggestedPay = guestBalance > 0 ? guestBalance : 0;
  const currentPayNum = Number(payAmount || activeSuggestedPay);
  const tenderNum = Number(cashTendered || 0);
  const changeDue = tenderNum > currentPayNum ? tenderNum - currentPayNum : 0;

  // 1-Tap Check-In Handler
  const handleOneTapCheckIn = () => {
    startTransition(async () => {
      toast.loading("Checking in guest...", { id: "stay_ci" });
      const res = await fastOneTapCheckIn(summary.bookingId);
      if (res.ok) {
        toast.success(`✓ Checked In! ${res.roomLabel ?? ""}`, { id: "stay_ci" });
        onRefresh();
      } else {
        toast.error(res.error ?? "Check-in failed", { id: "stay_ci" });
      }
    });
  };

  // Atomic Checkout Handler
  const handleAtomicCheckout = () => {
    if (!isBalanceZero) {
      toast.error(`Please collect remaining balance Nu. ${formatGuestBtn(guestBalance)} before checkout.`);
      setActiveTab("payments");
      return;
    }
    startTransition(async () => {
      toast.loading("Checking out & generating tax invoice...", { id: "stay_co" });
      const res = await checkoutStayAtomic({
        bookingId: summary.bookingId,
        propertyId,
      });
      if (res.success) {
        toast.success(`✓ Checked Out! Invoice ${res.invoiceNumber ?? ""}`, { id: "stay_co" });
        onRefresh();
      } else {
        toast.error(res.error ?? "Checkout failed", { id: "stay_co" });
      }
    });
  };

  // 1-Click Zero Friction Agent Checkout (Direct to AR Credit Ledger + Gapless Invoice)
  const handleAgentDirectCheckout = () => {
    startTransition(async () => {
      toast.loading("Settling to Agent credit ledger & issuing tax invoice...", { id: "agent_co" });
      const res = await checkoutStayAtomic({
        bookingId: summary.bookingId,
        propertyId,
        allowBalance: true,
        issueInvoice: true,
      });
      if (res.success) {
        toast.success(`✓ Checked Out! Invoice ${res.invoiceNumber ?? ""}`, { id: "agent_co" });
        onRefresh();
      } else {
        toast.error(res.error ?? "Agent checkout failed", { id: "agent_co" });
      }
    });
  };

  // Submit Folio Payment
  const handleRecordPayment = () => {
    if (!money?.folioId) {
      toast.error("No active folio found for this stay.");
      return;
    }
    const amt = currentPayNum;
    if (amt <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    startTransition(async () => {
      toast.loading("Recording payment...", { id: "stay_pay" });
      const formData = new FormData();
      formData.append("folio_id", money.folioId!);
      formData.append("method", payMethod);
      formData.append("amount_btn", String(amt));
      if (payNotes) formData.append("notes", payNotes);

      try {
        const res = await postFolioPayment({ ok: false }, formData);
        if (res.ok) {
          toast.success(`✓ Nu. ${formatGuestBtn(amt)} payment recorded!`, { id: "stay_pay" });
          setPayAmount("");
          setCashTendered("");
          setPayNotes("");
          onRefresh();
        } else {
          toast.error(res.error ?? "Failed to record payment", { id: "stay_pay" });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error posting payment";
        toast.error(msg, { id: "stay_pay" });
      }
    });
  };

  // Print Master Bill
  const handlePrintMaster = () => {
    if (!money?.folioId) return;
    void openMasterBillPrint(money.folioId).then((r) => {
      if (r.ok) window.open(r.href, "_blank", "noopener,noreferrer");
      else toast.error(r.error);
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ─── TOP TABS HEADER (ORGANIZED & SPACIOUS) ────────────────────── */}
      <div className="border-b border-border/60 bg-muted/30 px-3 sm:px-6 pr-14 sm:pr-16 pt-2 pb-0 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Stay Quick Title */}
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-black text-foreground truncate flex items-center gap-2">
              <span>{summary.contactName || "Guest"}</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-xs font-bold">
                {summary.roomLabel ? `Room ${summary.roomLabel}` : "Room Pending"}
              </span>
            </h2>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                isInHouse
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  : isArrival
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-zinc-500/20 text-muted-foreground"
              )}
            >
              {isInHouse ? "In-House" : isArrival ? "Arrival" : "Checked Out"}
            </span>
          </div>

          {/* Right Header Controls (Live Balance Pill & Wide View Toggle) */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-mono font-bold border tabular-nums transition-colors",
                isBalanceZero
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
              )}
            >
              {isBalanceZero ? "Nu. 0.00" : `Nu. ${formatGuestBtn(guestBalance)} Due`}
            </div>

            {onToggleExpand && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleExpand}
                className="h-8 px-2.5 text-xs font-bold rounded-lg gap-1.5 text-muted-foreground hover:text-foreground"
                title={isExpanded ? "Collapse to standard width" : "Expand to wide screen"}
              >
                {isExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-primary" />
                    <span className="hidden sm:inline">Standard</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-primary" />
                    <span className="hidden sm:inline">Wide View</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 6 UN-CRAMPED WORKSPACE TABS */}
        <div className="w-full">
          <div
            className="flex h-10 gap-1 sm:gap-2 justify-start border-b-0 overflow-x-auto no-scrollbar w-full"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* TAB 1: OVERVIEW */}
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "h-9 px-3 rounded-t-lg font-bold text-xs flex items-center gap-1.5 transition-all border-b-2",
                activeTab === "overview"
                  ? "bg-background border-primary text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Stay Overview</span>
            </button>

            {/* TAB 2: FOLIO & LEDGER */}
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={cn(
                "h-9 px-3 rounded-t-lg font-bold text-xs flex items-center gap-1.5 transition-all border-b-2",
                activeTab === "ledger"
                  ? "bg-background border-primary text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-500" />
              <span>Folio Ledger</span>
              <span
                className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                  isBalanceZero
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-rose-500/10 text-rose-600 font-bold"
                )}
              >
                Nu. {formatGuestBtn(guestBalance)}
              </span>
            </button>

            {/* TAB 3: CHARGES & ADDONS */}
            <button
              type="button"
              onClick={() => setActiveTab("charges")}
              className={cn(
                "h-9 px-3 rounded-t-lg font-bold text-xs flex items-center gap-1.5 transition-all border-b-2",
                activeTab === "charges"
                  ? "bg-background border-primary text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span>Add Charges</span>
            </button>

            {/* TAB 4: PAYMENTS & CASHIER */}
            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={cn(
                "h-9 px-3 rounded-t-lg font-bold text-xs flex items-center gap-1.5 transition-all border-b-2",
                activeTab === "payments"
                  ? "bg-background border-primary text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Coins className="w-3.5 h-3.5 text-emerald-500" />
              <span>Cashier &amp; Pay</span>
            </button>

            {/* TAB 5: GUEST & KYC */}
            <button
              type="button"
              onClick={() => setActiveTab("guest")}
              className={cn(
                "h-9 px-3 rounded-t-lg font-bold text-xs flex items-center gap-1.5 transition-all border-b-2",
                activeTab === "guest"
                  ? "bg-background border-primary text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Guest Info</span>
            </button>

            {/* TAB 6: DOCUMENTS & PRINT */}
            <button
              type="button"
              onClick={() => setActiveTab("docs")}
              className={cn(
                "h-9 px-3 rounded-t-lg font-bold text-xs flex items-center gap-1.5 transition-all border-b-2",
                activeTab === "docs"
                  ? "bg-background border-primary text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Documents</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── TAB CONTENTS AREA (ROOMY & SCROLLABLE) ────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/10">
        {/* =============================================================== */}
        {/* TAB 1: OVERVIEW & FAST ACTIONS                                  */}
        {/* =============================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* HERO ACTION BANNER */}
            {isArrival && (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      Expected Arrival Today
                    </span>
                    <span className="text-xs text-muted-foreground">• Ready to check in</span>
                  </div>
                  <h2 className="text-xl font-black text-foreground">
                    {summary.contactName || "Guest Arrival"}
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>Room: <strong className="text-foreground">{summary.roomLabel ? `Room ${summary.roomLabel}` : "Unassigned"}</strong></span>
                    <button
                      type="button"
                      onClick={() => setRoomModalOpen(true)}
                      className="px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-bold text-[11px] transition-colors"
                      title="Assign physical room door before check-in"
                    >
                      {summary.roomLabel ? "Change Room Door" : "Assign Room Door"}
                    </button>
                    <span>• {nights} Nights • {pax} Pax</span>
                  </p>
                </div>

                <Button
                  size="lg"
                  disabled={isPending}
                  onClick={handleOneTapCheckIn}
                  className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all shrink-0"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>1-Tap Check-In Now</span>
                </Button>
              </div>
            )}

            {isInHouse && (
              isAgentStay ? (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-blue-500/10 to-transparent border-2 border-emerald-500/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        🏢 B2B Travel Agent Stay
                      </span>
                      <span className="text-xs font-black text-foreground">
                        {summary.agentName || "Partner Agency Voucher"}
                      </span>
                      <span className="text-xs text-muted-foreground">• Room {summary.roomLabel || "Assigned"}</span>
                      <button
                        type="button"
                        onClick={() => setRoomModalOpen(true)}
                        className="px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-bold text-[10px] transition-colors"
                        title="Move guest to another room"
                      >
                        Move Room
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoomModalOpen(true)}
                        className="px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-bold text-[10px] transition-colors"
                        title="Move guest to another room"
                      >
                        Move Room
                      </button>
                    </div>
                    <h2 className="text-xl font-black text-foreground">
                      {summary.contactName}
                    </h2>
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>Checkout: <strong className="text-foreground">{summary.checkOut}</strong> ({nights} nights)</span>
                      <span>•</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        Room &amp; Meals billed on credit to Agent MOU (Guest does not pay at desk)
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Guest Personal Extras
                      </span>
                      <span
                        className={cn(
                          "text-xl font-black font-mono tabular-nums",
                          isBalanceZero ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        Nu. {formatGuestBtn(guestBalance)}
                      </span>
                    </div>

                    {isBalanceZero ? (
                      <Button
                        size="lg"
                        disabled={isPending}
                        onClick={handleAgentDirectCheckout}
                        className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                        title="1-Click: Settle room tariff to agent credit and generate tax invoice"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Bill to Agent &amp; Check-Out (1-Click)</span>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="lg"
                          onClick={() => setActiveTab("payments")}
                          className="h-12 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Collect Nu. {formatGuestBtn(guestBalance)} Extras</span>
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          disabled={isPending}
                          onClick={handleAgentDirectCheckout}
                          className="h-12 px-4 rounded-xl font-bold text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          title="Charge all remaining dues to Agent AR"
                        >
                          <span>Bill All to Agent</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        Active In-House Stay
                      </span>
                      <span className="text-xs text-muted-foreground">• Room {summary.roomLabel || "Assigned"}</span>
                    </div>
                    <h2 className="text-xl font-black text-foreground">
                      {summary.contactName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Checkout: <strong className="text-foreground">{summary.checkOut}</strong> (Nights: {nights})
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Balance Due
                      </span>
                      <span
                        className={cn(
                          "text-xl font-black font-mono tabular-nums",
                          isBalanceZero ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        Nu. {formatGuestBtn(guestBalance)}
                      </span>
                    </div>

                    {isBalanceZero ? (
                      <Button
                        size="lg"
                        disabled={isPending}
                        onClick={handleAtomicCheckout}
                        className="h-12 px-5 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Settle &amp; Check-Out</span>
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        onClick={() => setActiveTab("payments")}
                        className="h-12 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Collect Dues</span>
                      </Button>
                    )}
                  </div>
                </div>
              )
            )}

            {isCheckedOut && (
              <div className="p-5 rounded-2xl bg-zinc-500/10 border border-zinc-500/30 flex items-center justify-between shadow-sm">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-500/20 text-foreground">
                    ✓ Stay Completed &amp; Checked Out
                  </span>
                  <h2 className="text-lg font-black text-foreground mt-1">
                    {summary.contactName} • Room {summary.roomLabel}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Folio settled with zero balance. Fiscal tax invoice generated.
                  </p>
                </div>

                {money?.folioId && (
                  <Button
                    onClick={handlePrintMaster}
                    className="h-11 px-4 rounded-xl font-bold text-xs bg-black text-white hover:bg-zinc-800 flex items-center gap-2 shadow active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Re-Print Tax Invoice</span>
                  </Button>
                )}
              </div>
            )}

            {/* BENTO GRID: 4 KEY STAY MODULES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* CARD 1: ROOM & HOUSEKEEPING */}
              <div className="p-4 rounded-2xl sovereign-glass border border-white/10 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <BedDouble className="w-3.5 h-3.5 text-primary" /> Room &amp; Unit
                    </span>
                    <button
                      type="button"
                      onClick={() => setRoomModalOpen(true)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                      title="Assign or move physical room door"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{summary.roomLabel ? "Move" : "Assign"}</span>
                    </button>
                  </div>
                  <div className="text-lg font-black text-foreground mt-1 flex items-center gap-2">
                    <span>{summary.roomLabel ? `Room ${summary.roomLabel}` : "Unassigned"}</span>
                    {!summary.roomLabel && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{summary.roomTypeName || "Standard"}</span>
                  {summary.roomHkStatus && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-foreground">
                      {summary.roomHkStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 2: DATES & NIGHTS */}
              <div className="p-4 rounded-2xl sovereign-glass border border-white/10 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" /> Schedule
                </span>
                <div className="text-xl font-black text-foreground">
                  {nights} Nights
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {summary.checkIn} → {summary.checkOut}
                </div>
              </div>

              {/* CARD 3: GUEST & GUIDE */}
              <div className="p-4 rounded-2xl sovereign-glass border border-white/10 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-emerald-500" /> Occupancy &amp; Party
                </span>
                <div className="text-xl font-black text-foreground">
                  {pax} Pax
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {summary.guideNumber ? `Guide #${summary.guideNumber}` : summary.agentName || "Direct Booking"}
                </div>
              </div>

              {/* CARD 4: MEAL PLAN & NIGHTLY RATE */}
              <div className="p-4 rounded-2xl sovereign-glass border border-white/10 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" /> Plan &amp; Rate
                    </span>
                    <button
                      type="button"
                      onClick={() => setRateModalOpen(true)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                      title="Change meal plan or negotiated rate"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                  <div className="text-lg font-black text-foreground mt-1 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-xs">
                      {summary.mealPlanCode || "EP"}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate">
                      {summary.agreedNightlyRateBtn != null
                        ? `Nu. ${formatGuestBtn(summary.agreedNightlyRateBtn)}/nt`
                        : "Rack Rate"}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {summary.agreedRateReason || (summary.agreedNightlyRateBtn != null ? "Agreed Tariff" : "Published Rate")}
                </div>
              </div>

              {/* CARD 5: BILLING SNAPSHOT */}
              <div className="p-4 rounded-2xl sovereign-glass border border-white/10 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Folio Due
                  </span>
                  <div
                    className={cn(
                      "text-xl font-black font-mono mt-1",
                      isBalanceZero ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    Nu. {formatGuestBtn(guestBalance)}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {isBalanceZero ? "✓ Cleared" : isAgentStay ? "Guest extras only" : "Outstanding"}
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS ROW */}
            <div className="p-4 rounded-2xl sovereign-glass border border-white/10 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Quick Shortcuts
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("ledger")}
                  className="h-11 rounded-xl text-xs font-bold flex items-center justify-start gap-2 hover:bg-muted"
                >
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span>View Ledger</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setRoomModalOpen(true)}
                  className="h-11 rounded-xl text-xs font-bold flex items-center justify-start gap-2 hover:bg-muted"
                >
                  <BedDouble className="w-4 h-4 text-emerald-500" />
                  <span>{summary.roomLabel ? "Move Room" : "Assign Room"}</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setRateModalOpen(true)}
                  className="h-11 rounded-xl text-xs font-bold flex items-center justify-start gap-2 hover:bg-muted"
                >
                  <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                  <span>Rate / Meal Plan</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setActiveTab("charges")}
                  className="h-11 rounded-xl text-xs font-bold flex items-center justify-start gap-2 hover:bg-muted"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-500" />
                  <span>Add Room Extras</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setActiveTab("payments")}
                  className="h-11 rounded-xl text-xs font-bold flex items-center justify-start gap-2 hover:bg-muted"
                >
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <span>Collect Payment</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setActiveTab("docs")}
                  className="h-11 rounded-xl text-xs font-bold flex items-center justify-start gap-2 hover:bg-muted"
                >
                  <Printer className="w-4 h-4 text-muted-foreground" />
                  <span>Print Documents</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 2: FOLIO & DUAL LEDGER                                      */}
        {/* =============================================================== */}
        {activeTab === "ledger" && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Ledger Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl sovereign-glass border border-white/10">
              <div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <span>Guest &amp; Agent Dual Stream Ledger</span>
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    ({summary.folioDocNo || "Folio Open"})
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Separates Agent Voucher obligations (Stream A) from Guest Personal Incidentals (Stream B).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRateModalOpen(true)}
                  className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                  <span>Change Rate / Meal Plan</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintMaster}
                  className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Master Folio</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setActiveTab("payments")}
                  className="h-9 px-3 text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Collect Due Nu. {formatGuestBtn(guestBalance)}</span>
                </Button>
              </div>
            </div>

            {/* BHUTAN DESK DUAL LEDGER GUIDE BANNER */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Bhutan Desk Invariant:</strong> <strong>Tab A (Agent / Company)</strong> is billed to the tour operator's MOU credit ledger on invoice. <strong>Tab B (Guest Incidentals)</strong> is only for personal extras (laundry/bar) collected at checkout.
                </span>
              </div>
              {isAgentStay && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-950 dark:text-amber-100 shrink-0">
                  🏢 {summary.agentName || "Partner Agency Voucher"}
                </span>
              )}
            </div>

            {/* DUAL LEDGER COMPONENT (FULL WIDTH) */}
            {money ? (
              <div className="rounded-2xl border border-white/10 overflow-hidden shadow-sm">
                <StayHubDualLedger
                  money={money}
                  summary={{
                    rateBtn: money.balanceBtn,
                    extBtn: 0,
                    discountBtn: 0,
                    paymentBtn: 0,
                    balanceBtn: money.balanceBtn,
                  }}
                  onChanged={onRefresh}
                />
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-muted-foreground">
                Loading folio transactions...
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 3: CHARGES & ADDONS                                          */}
        {/* =============================================================== */}
        {activeTab === "charges" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl sovereign-glass border border-white/10">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-500" />
                <span>Post Charges &amp; Addons to Guest Folio</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add extra mattress, meals, laundry, airport transfer, or minibar directly to Room {summary.roomLabel || ""}.
              </p>
            </div>

            {/* ADDONS COMPONENT */}
            {money?.folioId ? (
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-4">
                <StayBillAddons
                  folioId={money.folioId}
                  bookingId={summary.bookingId}
                  guestName={summary.contactName || "Guest"}
                  roomUnitId={summary.roomUnitId || null}
                  roomLabel={summary.roomLabel || null}
                  onPosted={() => {
                    toast.success("Charge posted to folio!");
                    onRefresh();
                  }}
                />
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Folio must be active to post charges.
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 4: PAYMENTS & CASHIER TERMINAL                              */}
        {/* =============================================================== */}
        {activeTab === "payments" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {isAgentStay && (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      🏢 B2B Travel Agent Account
                    </span>
                    <span className="text-xs font-black text-foreground">{summary.agentName || "Partner Tour Operator"}</span>
                  </div>
                  <h3 className="text-base font-black text-foreground">
                    Direct Bill to Agent Credit Ledger (AR)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tourists do not pay room tariffs at desk. Settle directly to Agent MOU and generate tax invoice.
                  </p>
                </div>

                {isInHouse && (
                  <Button
                    size="lg"
                    disabled={isPending}
                    onClick={handleAgentDirectCheckout}
                    className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bill to Agent &amp; Check-Out (1-Click)</span>
                  </Button>
                )}
              </div>
            )}

            {/* CASHIER HERO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CURRENT BALANCE DUE */}
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-2 md:col-span-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Remaining Guest Due
                </span>
                <div
                  className={cn(
                    "text-3xl font-black font-mono tabular-nums",
                    isBalanceZero ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  Nu. {formatGuestBtn(guestBalance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isBalanceZero
                    ? "✓ No balance pending. Ready for checkout."
                    : "Collect via Cash, Bhutan QR, or Card."}
                </p>

                {/* FAST QR PAY MODAL BUTTON */}
                {guestBalance > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQrModalOpen(true)}
                    className="w-full mt-2 h-10 rounded-xl text-xs font-bold gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Show Bhutan RMA QR</span>
                  </Button>
                )}
              </div>

              {/* RECORD PAYMENT PANEL */}
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-4 md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary" /> Record Tender Collection
                </span>

                {/* METHOD TOGGLE */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod("cash")}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold text-center border transition-all",
                      payMethod === "cash"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    💵 Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("bank_qr")}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold text-center border transition-all",
                      payMethod === "bank_qr"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    📱 QR Pay
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("card")}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold text-center border transition-all",
                      payMethod === "card"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    💳 Card POS
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("agent_credit")}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold text-center border transition-all",
                      payMethod === "agent_credit"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    🏢 Agent AR
                  </button>
                </div>

                {/* AMOUNT INPUT & TENDER CALCULATOR */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">
                      Payment Amount (Nu.)
                    </label>
                    <input
                      type="number"
                      step="1"
                      placeholder={String(activeSuggestedPay)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-border/60 bg-background font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  {payMethod === "cash" && (
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">
                        Cash Tendered from Guest
                      </label>
                      <input
                        type="number"
                        step="1"
                        placeholder="e.g. 5000"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-border/60 bg-background font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  )}
                </div>

                {/* CASH CHANGE TO RETURN */}
                {payMethod === "cash" && changeDue > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                    <span>Change to Return to Guest:</span>
                    <span className="font-mono text-base font-black">
                      Nu. {formatGuestBtn(changeDue)}
                    </span>
                  </div>
                )}

                {/* NOTES */}
                <div>
                  <input
                    type="text"
                    placeholder="Optional note / transaction reference..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* POST PAYMENT BUTTON */}
                <Button
                  disabled={isPending || currentPayNum <= 0}
                  onClick={handleRecordPayment}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-black text-sm gap-2 shadow active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Record Nu. {formatGuestBtn(currentPayNum)} Payment</span>
                </Button>
              </div>
            </div>

            {/* CHECKOUT SECTION IF ZERO BALANCE */}
            {isInHouse && isBalanceZero && (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="text-base font-black text-foreground">
                    ✓ Balance is Fully Settled
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    You can safely check out the guest and generate the final fiscal tax invoice.
                  </p>
                </div>

                <Button
                  size="lg"
                  disabled={isPending}
                  onClick={handleAtomicCheckout}
                  className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Settle &amp; Check-Out Guest</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 5: GUEST DETAILS & KYC                                      */}
        {/* =============================================================== */}
        {activeTab === "guest" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GUEST PROFILE */}
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="w-4 h-4 text-primary" /> Guest Identity
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Full Name</span>
                    <span className="font-bold text-foreground">{summary.contactName || "Guest"}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Phone Number</span>
                    <span className="font-mono text-foreground">{summary.contactPhone || "Not on file"}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Email Address</span>
                    <span className="font-mono text-foreground">{summary.contactEmail || "Not on file"}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Country / Origin</span>
                    <span className="font-bold text-foreground">{summary.guestOrigin || "Bhutan"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Total Pax</span>
                    <span className="font-bold text-foreground">{pax} ({summary.adults || 1} Adults, {summary.children || 0} Children)</span>
                  </div>
                </div>
              </div>

              {/* STAY & AGENT DETAILS */}
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-500" /> Stay &amp; Tour Agent
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Meal Plan</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-primary font-mono">{summary.mealPlanCode || "EP"}</span>
                      <button
                        type="button"
                        onClick={() => setRateModalOpen(true)}
                        className="text-[11px] font-bold text-primary hover:underline"
                      >
                        [Change]
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Tour Guide</span>
                    <span className="font-bold text-foreground">
                      {summary.guideNumber ? `Guide #${summary.guideNumber}` : "Direct (No Guide)"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Travel Agent</span>
                    <span className="font-bold text-foreground">
                      {summary.agentName || "Direct Walk-In"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Agent Status</span>
                    <span className="font-bold uppercase text-[10px] text-muted-foreground">
                      {summary.agentStatus || "Standard"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">SDF Complete</span>
                    <span className={cn("font-bold text-xs", summary.sdfIncomplete ? "text-amber-500" : "text-emerald-500")}>
                      {summary.sdfIncomplete ? "⚠️ Pending" : "✓ Verified"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SPECIAL NOTES */}
            {summary.notes && (
              <div className="p-4 rounded-2xl sovereign-glass border border-white/10 space-y-1.5 text-xs">
                <span className="font-bold uppercase tracking-wider text-muted-foreground">
                  Special Notes &amp; Requests:
                </span>
                <p className="text-foreground leading-relaxed">{summary.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB 6: DOCUMENTS & PRINT DESK                                   */}
        {/* =============================================================== */}
        {activeTab === "docs" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl sovereign-glass border border-white/10">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Printer className="w-4 h-4 text-primary" />
                <span>Print &amp; Fiscal Documents Desk</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate official A4 guest registration cards, tax invoices, and proforma statements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 1. MASTER FOLIO STATEMENT */}
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-3 flex flex-col justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600">
                    Ledger Summary
                  </span>
                  <h4 className="text-base font-black text-foreground mt-2">
                    Master Folio Bill
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete itemized breakdown of room nights, meal plan, and all incidental outlets.
                  </p>
                </div>
                <Button
                  onClick={handlePrintMaster}
                  className="w-full h-11 rounded-xl text-xs font-bold gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Master Bill</span>
                </Button>
              </div>

              {/* 2. OFFICIAL TAX INVOICE */}
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-3 flex flex-col justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                    Fiscal DRC Compliant
                  </span>
                  <h4 className="text-base font-black text-foreground mt-2">
                    Official Tax Invoice
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gapless INV-YYYY-XXXXX invoice with Bhutan sales tax / GST breakdown.
                  </p>
                </div>
                <Button
                  onClick={handlePrintMaster}
                  className="w-full h-11 rounded-xl text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <FileText className="w-4 h-4" />
                  <span>Tax Invoice</span>
                </Button>
              </div>

              {/* 3. ARRIVAL REGISTRATION CARD */}
              <div className="p-5 rounded-2xl sovereign-glass border border-white/10 space-y-3 flex flex-col justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-500/10 text-muted-foreground">
                    Check-In KYC
                  </span>
                  <h4 className="text-base font-black text-foreground mt-2">
                    Registration Card
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    A4 arrival sheet with guest declarations, passport fields, and signature box.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/erp/stays/${summary.bookingId}/registration`, "_blank");
                  }}
                  className="w-full h-11 rounded-xl text-xs font-bold gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Registration</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ROOM ASSIGNMENT & SHIFT CONTROLLER MODAL */}
      <RoomAssignmentModal
        isOpen={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        bookingId={summary.bookingId}
        contactName={summary.contactName || "Guest"}
        currentRoomLabel={summary.roomLabel}
        isInHouse={isInHouse}
        onSuccess={onRefresh}
      />

      {/* RATE & MEAL PLAN CONTROLLER MODAL */}
      <RateAndMealPlanModal
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        bookingId={summary.bookingId}
        folioId={money?.folioId}
        propertyId={propertyId}
        contactName={summary.contactName || "Guest"}
        roomLabel={summary.roomLabel}
        currentMealPlan={summary.mealPlanCode}
        currentNightlyRate={summary.agreedNightlyRateBtn}
        checkIn={summary.checkIn}
        checkOut={summary.checkOut}
        adults={summary.adults}
        children={summary.children}
        onSuccess={onRefresh}
      />

      {/* QUICK BHUTAN RMA QR MODAL */}
      <QuickBhutanQrModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        orderId={money?.folioId || summary.bookingId}
        totalBtn={guestBalance}
        accountTitle={`Stay Room ${summary.roomLabel || ""} · ${summary.contactName || "Guest"}`}
        onConfirmPayment={() => {
          setQrModalOpen(false);
          setPayMethod("bank_qr");
          setPayAmount(String(guestBalance));
          handleRecordPayment();
        }}
      />
    </div>
  );
}
