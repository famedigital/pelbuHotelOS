"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  Send,
  Calendar,
  BedDouble,
  DollarSign,
  ArrowRight,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGuestBtn } from "@/lib/pricing";
import { DensePineSpreadsheet, SpreadsheetRow } from "@/components/erp/atheros/DensePineSpreadsheet";
import type { AgentOption, AgentDossierData, AgentDossierStay } from "@/lib/erp-agent-dossier";

interface UniversalAgentDossierViewProps {
  agents: AgentOption[];
  selectedAgentId?: string;
  initialDossier: AgentDossierData | null;
  propertySlug?: string;
}

export function UniversalAgentDossierView({
  agents,
  selectedAgentId,
  initialDossier,
  propertySlug = "demo-hotel",
}: UniversalAgentDossierViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"all" | "in_house" | "upcoming" | "unpaid" | "completed">("all");
  const [copiedLink, setCopiedLink] = useState(false);

  // Current selected agent
  const currentAgentId = selectedAgentId || (agents[0]?.id ?? "");

  const handleAgentChange = (newAgentId: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("agentId", newAgentId);
      router.push(`/erp/agents/dossier?${params.toString()}`);
    });
  };

  const dossier = initialDossier;
  const agent = dossier?.agent;
  const stats = dossier?.stats;

  // Credit health calculation
  const creditLimit = agent?.creditLimitBtn || 500000;
  const creditUsed = agent?.creditUsedBtn || stats?.outstandingDueBtn || 0;
  const creditUsagePct = Math.min(100, Math.round((creditUsed / Math.max(1, creditLimit)) * 100));

  const creditHealthStatus = useMemo(() => {
    if (creditUsagePct > 90) return { label: "Critical Exposure", color: "text-rose-500", bar: "bg-rose-500", border: "border-rose-500/30" };
    if (creditUsagePct > 70) return { label: "Moderate Risk", color: "text-amber-500", bar: "bg-amber-500", border: "border-amber-500/30" };
    return { label: "Good Standing", color: "text-emerald-500", bar: "bg-emerald-500", border: "border-emerald-500/30" };
  }, [creditUsagePct]);

  // Map dossier stays to spreadsheet rows
  const spreadsheetRows: SpreadsheetRow[] = useMemo(() => {
    if (!dossier?.stays) return [];
    
    let filteredStays = dossier.stays;
    const today = new Date().toISOString().slice(0, 10);

    if (activeTab === "in_house") {
      filteredStays = filteredStays.filter((s) => s.status === "checked_in");
    } else if (activeTab === "upcoming") {
      filteredStays = filteredStays.filter((s) => s.checkIn >= today && s.status !== "checked_out");
    } else if (activeTab === "unpaid") {
      filteredStays = filteredStays.filter((s) => s.dueAmountBtn > 0);
    } else if (activeTab === "completed") {
      filteredStays = filteredStays.filter((s) => s.status === "checked_out");
    }

    return filteredStays.map((s) => ({
      id: s.bookingId,
      roomLabel: s.roomLabel,
      guestName: s.guestName,
      agentName: agent?.companyName,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      nights: s.nights,
      status: s.status,
      grossAmountBtn: s.grossAmountBtn,
      paidAmountBtn: s.paidAmountBtn,
      dueAmountBtn: s.dueAmountBtn,
      guideNumber: s.guideName || s.guidePhone || undefined,
    }));
  }, [dossier?.stays, activeTab, agent?.companyName]);

  const handleCopyPaymentLink = () => {
    if (!agent) return;
    const paymentUrl = `${window.location.origin}/pay/agent/${agent.id}`;
    navigator.clipboard.writeText(paymentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & AGENT SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Universal B2B Dossier
            </span>
            <span className="text-xs text-muted-foreground">• 0-Latency Single Workspace</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            {agent?.companyName || "Select an Agent"}
          </h1>
          <p className="text-sm text-muted-foreground">
            All reservations, payment streams, voucher folios & credit limits unified in one screen.
          </p>
        </div>

        {/* AGENT SELECTOR DROPDOWN */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px]">
            <select
              value={currentAgentId}
              onChange={(e) => handleAgentChange(e.target.value)}
              disabled={isPending}
              aria-label="Select B2B Partner Agent"
              className="w-full h-11 px-4 py-2 pr-10 text-sm font-semibold rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-input focus:ring-2 focus:ring-primary/40 appearance-none shadow-sm cursor-pointer disabled:opacity-50"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.companyName} {a.market ? `(${a.market})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3.5 pointer-events-none" />
          </div>

          <button
            onClick={handleCopyPaymentLink}
            className="h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold sovereign-glass hover:bg-primary hover:text-primary-foreground border border-primary/30 transition-all shadow-sm active:scale-95"
            title="Generate & Copy Instant B2B Payment Portal Link"
          >
            <Send className="w-4 h-4" />
            <span>{copiedLink ? "Link Copied! ✓" : "Pay Link"}</span>
          </button>
        </div>
      </div>

      {/* 2. B2B CREDIT & EXPOSURE HERO CARD */}
      {agent && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Credit Limit & Dues Well */}
          <div className="lg:col-span-1 p-6 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-primary" /> Credit Exposure
                </span>
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", creditHealthStatus.border, creditHealthStatus.color)}>
                  {creditHealthStatus.label}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground font-medium">Outstanding Dues</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-stat tracking-tight">
                    Nu. {formatGuestBtn(stats.outstandingDueBtn)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Credit Utilized ({creditUsagePct}%)</span>
                    <span>Limit: Nu. {formatGuestBtn(creditLimit)}</span>
                  </div>
                  <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/50">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", creditHealthStatus.bar)}
                      style={{ width: `${creditUsagePct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                    <span className="text-muted-foreground block text-[10px] font-medium uppercase">Commission</span>
                    <span className="font-bold text-foreground text-sm">{agent.commissionPct}% Agreed</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                    <span className="text-muted-foreground block text-[10px] font-medium uppercase">Status</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 capitalize text-sm">{agent.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                {agent.contactPerson || "Front Office Contact"}
              </span>
              {agent.phone && (
                <a href={`tel:${agent.phone}`} className="hover:text-primary transition-colors flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {agent.phone}
                </a>
              )}
            </div>
          </div>

          {/* Quick Metrics Bento 2x2 */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* In-House */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">In-House</span>
                <BedDouble className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-foreground tabular-stat">{stats.inHouseCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Rooms active today</p>
              </div>
              <div className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Live guests on site
              </div>
            </div>

            {/* Upcoming */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Upcoming</span>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-foreground tabular-stat">{stats.upcomingCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Future arrivals</p>
              </div>
              <div className="mt-2 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                Vouchers confirmed
              </div>
            </div>

            {/* Total Paid */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Settled</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-foreground tabular-stat">
                  Nu. {formatGuestBtn(stats.totalPaidBtn)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Cleared into bank</p>
              </div>
              <div className="mt-2 text-[11px] font-medium text-muted-foreground">
                Verified folio credits
              </div>
            </div>

            {/* Gross Revenue */}
            <div className="p-5 rounded-2xl sovereign-glass border border-white/20 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Gross Turn</span>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-foreground tabular-stat">
                  Nu. {formatGuestBtn(stats.grossRevenueBtn)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{stats.totalNights} room nights total</p>
              </div>
              <div className="mt-2 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                Lifetime booking sum
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTER TABS & DENSE PINE SPREADSHEET */}
      <div className="space-y-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl sovereign-glass border border-white/20 dark:border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-muted-foreground px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Quick Filter:
            </span>
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              All Stays ({dossier?.stays.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("in_house")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === "in_house"
                  ? "bg-emerald-600 text-white shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              In-House Now ({stats?.inHouseCount || 0})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === "upcoming"
                  ? "bg-blue-600 text-white shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              Upcoming ({stats?.upcomingCount || 0})
            </button>
            <button
              onClick={() => setActiveTab("unpaid")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === "unpaid"
                  ? "bg-rose-600 text-white shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              Unpaid Dues
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === "completed"
                  ? "bg-zinc-700 text-white shadow"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              Past / Completed ({stats?.completedCount || 0})
            </button>
          </div>

          <div className="text-xs text-muted-foreground pr-2 font-medium">
            Showing <span className="font-bold text-foreground">{spreadsheetRows.length}</span> reservations
          </div>
        </div>

        {/* Dense Pine Spreadsheet Component */}
        <DensePineSpreadsheet
          data={spreadsheetRows}
          title={`${agent?.companyName || "Agent"} Ledger`}
          hotelName="Hotel OS Bhutan"
          onSelectRow={(row) => {
            // Navigate to StayHub or stay folio
            router.push(`/erp/stays/${row.id}`);
          }}
        />
      </div>
    </div>
  );
}
