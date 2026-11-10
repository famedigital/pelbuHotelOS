import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { StillWaterSurface } from "./StillWaterSurface.js";

type GlassProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  as?: "div" | "header" | "nav" | "aside" | "section";
  /**
   * Still-water WebGL wake on L0. Off by default — desk FO needs 60fps.
   * Pass true only on marketing / low-density surfaces.
   */
  stillWater?: boolean;
};

/** L0 atmospheric canvas mesh under sharp DOM chrome. */
export function GlassShell({
  className,
  children,
  as: Tag = "div",
  stillWater = false,
  ...rest
}: GlassProps) {
  return (
    <Tag
      className={cn("hos-glass-shell relative min-h-full overflow-hidden", className)}
      {...rest}
    >
      {stillWater ? <StillWaterSurface /> : null}
      <div className="relative z-[1] min-h-full bg-transparent">{children}</div>
    </Tag>
  );
}

/** Luxury bento / worklist panel — opaque cell over mesh. */
export function GlassPanel({ className, children, as: Tag = "div", ...rest }: GlassProps) {
  return (
    <Tag
      className={cn("hos-luxury-card hos-board-chrome [transform:translateZ(0)]", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Elevated floating sheet / modal chrome. */
export function GlassElevated({ className, children, as: Tag = "div", ...rest }: GlassProps) {
  return (
    <Tag
      className={cn(
        "hos-surface-glass rounded-[var(--hos-radius-lg)] [transform:translateZ(0)]",
        "shadow-[var(--hos-elevated-shadow)]",
        "backdrop-blur-[28px]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
