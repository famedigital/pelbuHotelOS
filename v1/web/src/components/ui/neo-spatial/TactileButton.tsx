"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { NeoSpatialTokens } from "./ThemeTokens";

export interface TactileButtonProps
  extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "emerald" | "amber" | "crimson" | "gold" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_4px_16px_-4px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border border-indigo-400/30 hover:brightness-110",
    secondary:
      "bg-slate-900/70 text-slate-200 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-slate-800/80 hover:text-white",
    emerald:
      "bg-emerald-600 text-white shadow-[0_4px_16px_-4px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border border-emerald-400/30 hover:bg-emerald-500",
    amber:
      "bg-amber-500 text-slate-950 font-semibold shadow-[0_4px_16px_-4px_rgba(245,158,11,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] border border-amber-300/40 hover:bg-amber-400",
    crimson:
      "bg-rose-600 text-white shadow-[0_4px_16px_-4px_rgba(244,63,94,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] border border-rose-400/30 hover:bg-rose-500",
    gold:
      "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-semibold shadow-[0_4px_16px_-4px_rgba(251,191,36,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] border border-amber-200/50 hover:brightness-105",
    ghost:
      "bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-4 py-2 text-sm rounded-xl gap-2",
    lg: "px-6 py-3 text-base rounded-2xl gap-2.5",
  };

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97, y: 1 }}
      transition={NeoSpatialTokens.springs.snappy}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors transform-gpu cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
};
