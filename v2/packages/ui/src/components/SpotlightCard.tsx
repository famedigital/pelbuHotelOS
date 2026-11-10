import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  glowColor?: string;
  asButton?: boolean;
};

/** Enterprise beveled glass tile — hover glow only (no lift). */
export function SpotlightCard({
  children,
  className,
  glowColor,
  asButton: _asButton,
  ...rest
}: SpotlightCardProps) {
  const glow =
    glowColor === "emerald" ||
    glowColor === "gold" ||
    glowColor === "brass" ||
    glowColor === "sapphire" ||
    glowColor === "booked"
      ? glowColor
      : undefined;

  return (
    <div
      className={cn(
        "hos-glass-card relative overflow-hidden [transform:translateZ(0)]",
        className,
      )}
      data-glow={glow}
      {...rest}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
