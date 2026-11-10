import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { routeEnter, springButter, volaroEase } from "../motion/presets.js";

type PageTransitionProps = {
  routeKey: string;
  children: ReactNode;
  className?: string;
};

/**
 * Route-keyed butter enter — soft scale + slide; respects reduced motion.
 */
export function PageTransition({ routeKey, children, className }: PageTransitionProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        className={className}
        variants={routeEnter}
        initial="hidden"
        animate="show"
        exit={{
          opacity: 0,
          y: -6,
          scale: 0.992,
          transition: { duration: 0.14, ease: volaroEase },
        }}
        transition={springButter}
        style={{ viewTransitionName: "hos-desk-view" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
