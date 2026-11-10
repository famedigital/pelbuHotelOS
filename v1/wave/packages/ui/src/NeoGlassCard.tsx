import type { HTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

export interface NeoGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "crimson" | "gold";
}

export function NeoGlassCard({
  children,
  className,
  accent,
  ...props
}: NeoGlassCardProps) {
  return (
    <div
      className={clsx(
        "hos-glass rounded-2xl p-4",
        accent === "indigo" && "border-indigo-500/30",
        accent === "emerald" && "border-emerald-500/30",
        accent === "amber" && "border-amber-500/30",
        accent === "crimson" && "border-rose-500/30",
        accent === "gold" && "border-amber-400/30",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
