import { motion, useReducedMotion } from "motion/react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { butterCard, springPress, springSoft } from "../motion/presets.js";

type ButterCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Use boarding-pass left accent styling */
  boarding?: boolean;
  /** Disable hover lift (dense racks) */
  flat?: boolean;
  /** Stagger child of StaggerReveal */
  asItem?: boolean;
};

/**
 * Enterprise tactile card — spring enter, hover lift, thumb press.
 * Opaque interiors stay high-contrast; glass is chrome only.
 */
export function ButterCard({
  children,
  className,
  boarding,
  flat,
  asItem,
  ...props
}: ButterCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(
        boarding ? "hos-boarding-pass" : "hos-glass-card",
        "hos-butter-card",
        className,
      )}
      variants={asItem && !reduce ? butterCard : undefined}
      initial={asItem || reduce ? undefined : "hidden"}
      animate={asItem || reduce ? undefined : "show"}
      whileHover={
        reduce || flat
          ? undefined
          : { y: -2, transition: springSoft }
      }
      whileTap={
        reduce || flat
          ? undefined
          : { scale: 0.985, transition: springPress }
      }
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  );
}
