"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { SpotlightContainer } from "./SpotlightContainer";

export interface NeoGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  enableSpotlight?: boolean;
  spotlightColor?: string;
  variant?: "default" | "elevated" | "accent";
  accentColor?: "indigo" | "emerald" | "amber" | "crimson" | "gold";
  children: React.ReactNode;
}

export const NeoGlassCard: React.FC<NeoGlassCardProps> = ({
  enableSpotlight = true,
  spotlightColor,
  variant = "default",
  accentColor,
  className,
  children,
  ...props
}) => {
  const accentGlow = {
    indigo: "border-indigo-500/30 shadow-[0_0_24px_-8px_rgba(99,102,241,0.25)]",
    emerald: "border-emerald-500/30 shadow-[0_0_24px_-8px_rgba(16,185,129,0.25)]",
    amber: "border-amber-500/30 shadow-[0_0_24px_-8px_rgba(245,158,11,0.25)]",
    crimson: "border-rose-500/30 shadow-[0_0_24px_-8px_rgba(244,63,94,0.25)]",
    gold: "border-amber-400/30 shadow-[0_0_24px_-8px_rgba(251,191,36,0.25)]",
  };

  const cardClasses = cn(
    "relative rounded-2xl p-6 transition-all duration-200 transform-gpu",
    // Dark mode: Obsidian Void
    "bg-slate-950/60 text-slate-100 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_20px_40px_-15px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-[180%]",
    // Light mode: Liquid Ceramic
    "light:bg-white/85 light:text-slate-900 light:border-slate-200/90 light:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_12px_32px_-8px_rgba(15,23,42,0.06)]",
    // Accent override
    accentColor ? accentGlow[accentColor] : "",
    variant === "elevated" && "hover:-translate-y-0.5 hover:border-white/20 transition-transform",
    className
  );

  if (enableSpotlight) {
    return (
      <SpotlightContainer spotlightColor={spotlightColor} className={cardClasses} {...props}>
        <div className="relative z-20">{children}</div>
      </SpotlightContainer>
    );
  }

  return (
    <div className={cardClasses} {...props}>
      {children}
    </div>
  );
};
