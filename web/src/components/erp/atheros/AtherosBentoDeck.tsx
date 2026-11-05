"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatGuestBtn } from "@/lib/pricing";
import {
  BedDoubleIcon,
  TrendingUpIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ArrowUpRightIcon,
} from "lucide-react";

interface BentoMetricProps {
  label: string;
  value: string | number;
  subValue?: string;
  percent: number;
  ringColor: "pine" | "saffron" | "emerald" | "coral";
  icon: React.ComponentType<{ className?: string }>;
  trendLabel?: string;
}

function ProgressRing({
  percent,
  color,
  size = 56,
  strokeWidth = 5,
}: {
  percent: number;
  color: "pine" | "saffron" | "emerald" | "coral";
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  const strokeColors = {
    pine: "stroke-[#1a4332] dark:stroke-[#2d6a4f]",
    saffron: "stroke-[#d97706] dark:stroke-[#f59e0b]",
    emerald: "stroke-[#10b981]",
    coral: "stroke-[#ef4444]",
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-black/5 dark:stroke-white/10 fill-none"
          strokeWidth={strokeWidth}
        />
        {/* Animated fill ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn("fill-none transition-all duration-700 ease-out", strokeColors[color])}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums text-foreground">
        {Math.round(clampedPercent)}%
      </span>
    </div>
  );
}

export function BentoMetricCard({
  label,
  value,
  subValue,
  percent,
  ringColor,
  icon: Icon,
  trendLabel,
}: BentoMetricProps) {
  return (
    <div className="sovereign-glass group relative overflow-hidden p-4">
      {/* Specular Glare overlay */}
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10 blur-xl dark:bg-white/5" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Icon className="size-3.5 text-muted-foreground/80" />
            <span>{label}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
              {value}
            </span>
            {subValue ? (
              <span className="text-xs font-medium text-muted-foreground truncate">
                {subValue}
              </span>
            ) : null}
          </div>
          {trendLabel ? (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRightIcon className="size-3" />
              <span>{trendLabel}</span>
            </div>
          ) : null}
        </div>

        {/* Live SVG Circular Progress Ring */}
        <div className="shrink-0 pt-0.5">
          <ProgressRing percent={percent} color={ringColor} />
        </div>
      </div>
    </div>
  );
}

export interface AtherosBentoDeckProps {
  occupancyPercent: number;
  totalRooms: number;
  occupiedRooms: number;
  todayRevenueBtn: number;
  targetRevenueBtn?: number;
  cleanRooms: number;
  dirtyRooms: number;
  agentCreditUsedBtn: number;
  agentCreditLimitBtn?: number;
}

export function AtherosBentoDeck({
  occupancyPercent,
  totalRooms,
  occupiedRooms,
  todayRevenueBtn,
  targetRevenueBtn = 150000,
  cleanRooms,
  dirtyRooms,
  agentCreditUsedBtn,
  agentCreditLimitBtn = 500000,
}: AtherosBentoDeckProps) {
  const revenuePacePercent = useMemo(() => {
    return targetRevenueBtn > 0 ? (todayRevenueBtn / targetRevenueBtn) * 100 : 0;
  }, [todayRevenueBtn, targetRevenueBtn]);

  const cleanTurnaroundPercent = useMemo(() => {
    return totalRooms > 0 ? (cleanRooms / totalRooms) * 100 : 0;
  }, [cleanRooms, totalRooms]);

  const creditExposurePercent = useMemo(() => {
    return agentCreditLimitBtn > 0 ? (agentCreditUsedBtn / agentCreditLimitBtn) * 100 : 0;
  }, [agentCreditUsedBtn, agentCreditLimitBtn]);

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. OCCUPANCY VELOCITY */}
      <BentoMetricCard
        label="Occupancy Pace"
        value={`${occupiedRooms}/${totalRooms}`}
        subValue="Units Active"
        percent={occupancyPercent}
        ringColor="pine"
        icon={BedDoubleIcon}
        trendLabel="+4% vs yesterday"
      />

      {/* 2. REVENUE RUN-RATE */}
      <BentoMetricCard
        label="Today's Pace"
        value={formatGuestBtn(todayRevenueBtn)}
        subValue={`Goal: ${formatGuestBtn(targetRevenueBtn)}`}
        percent={revenuePacePercent}
        ringColor="saffron"
        icon={TrendingUpIcon}
        trendLabel="On Target"
      />

      {/* 3. HOUSEKEEPING TURNAROUND */}
      <BentoMetricCard
        label="Turnaround Index"
        value={`${cleanRooms}/${totalRooms}`}
        subValue={`${dirtyRooms} to clean`}
        percent={cleanTurnaroundPercent}
        ringColor="emerald"
        icon={SparklesIcon}
      />

      {/* 4. B2B AGENT EXPOSURE */}
      <BentoMetricCard
        label="B2B Credit Pool"
        value={formatGuestBtn(agentCreditUsedBtn)}
        subValue="Used Exposure"
        percent={creditExposurePercent}
        ringColor="coral"
        icon={ShieldCheckIcon}
        trendLabel="Healthy headroom"
      />
    </div>
  );
}
