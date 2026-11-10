import type { Transition, Variants } from "motion/react";

/**
 * Volaro / Code & Chill motion DNA
 * Source: demo.codeandchill.store/volaro — `--ease: cubic-bezier(.22, 1, .36, 1)`
 */
export const volaroEase = [0.22, 1, 0.36, 1] as const;

/** Soft settle — page chrome, KPI boards */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

/** Snappy press / hover lift */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 36,
  mass: 0.7,
};

/** Morphing pills / active nav — Volaro segment feel */
export const springLayout: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 34,
  mass: 0.75,
};

/** Butter dock / tab indicator — slightly overshoot */
export const springButter: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 28,
  mass: 0.85,
};

/** Thumb press on boarding passes & hallway tiles */
export const springPress: Transition = {
  type: "spring",
  stiffness: 640,
  damping: 38,
  mass: 0.55,
};

/** Soft settle used on page chrome and cards */
export const easeVolary: Transition = {
  duration: 0.42,
  ease: volaroEase,
};

export const easeVolaryFast: Transition = {
  duration: 0.22,
  ease: volaroEase,
};

export const fadeSlide: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: easeVolary },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: easeVolary,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: easeVolary },
};

/** Route enter — soft scale + slide (desktop / tablet / phone) */
export const routeEnter: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springButter,
  },
};

export const staggerChildren: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
};

export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.028, delayChildren: 0.02 },
  },
};

/** Butter KPI / guest card cascade */
export const staggerButter: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.06 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: easeVolary },
};

export const butterCard: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springSoft,
  },
};

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
