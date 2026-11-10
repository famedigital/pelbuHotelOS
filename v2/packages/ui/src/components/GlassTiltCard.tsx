import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

type GlassTiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Kept for API compat — glow/tilt disabled for desk usability */
  glowColor?: string;
  maxTilt?: number;
};

/** Opaque inset card — tilt/glow removed for clear iOS desk. */
export function GlassTiltCard({ children, className }: GlassTiltCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--hos-radius-lg)]",
        "border-0 bg-[var(--hos-cell)] shadow-[var(--hos-card-shadow)]",
        "[transform:translateZ(0)]",
        className,
      )}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
