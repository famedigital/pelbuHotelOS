import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { fadeUp, listItem, staggerChildren, staggerFast } from "../motion/presets.js";

type StaggerRevealProps = {
  children: ReactNode;
  className?: string;
  /** Faster stagger for dense lists (flight rows / folio lines) */
  dense?: boolean;
};

/** Parent stagger container — Volaro list / KPI board entrance. */
export function StaggerReveal({ children, className, dense }: StaggerRevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      variants={dense ? staggerFast : staggerChildren}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  blur?: boolean;
};

/** Child of StaggerReveal — fades/slides in with Volaro ease. */
export function StaggerItem({ children, className, blur }: StaggerItemProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={cn(className)} variants={blur ? fadeUp : listItem}>
      {children}
    </motion.div>
  );
}
