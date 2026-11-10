import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { easeVolary, springSoft } from "../motion/presets.js";

type ModuleFrameProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  fill?: boolean;
  eyebrow?: string;
};

/** Compact Linear-grade module chrome — butter title settle on mount. */
export function ModuleFrame({
  title,
  description,
  actions,
  children,
  className,
  fill,
  eyebrow,
}: ModuleFrameProps) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2.5 md:gap-3",
        fill && "h-full overflow-hidden",
        className,
      )}
    >
      <motion.header
        className="flex shrink-0 flex-col gap-2 px-0.5 sm:flex-row sm:items-center sm:justify-between"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : springSoft}
      >
        <div className="min-w-0">
          {eyebrow ? <p className="hos-section-label mb-1">{eyebrow}</p> : null}
          <h1 className="m-0 truncate text-[1.125rem] font-bold tracking-tight text-[var(--hos-ink)] md:text-sm">
            {title}
          </h1>
          {description ? (
            <p className="m-0 mt-0.5 truncate text-[11px] leading-snug text-[var(--hos-ink-3)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <motion.div
            className="flex flex-wrap items-center gap-1.5"
            initial={reduce ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduce ? undefined : { ...easeVolary, delay: 0.06 }}
          >
            {actions}
          </motion.div>
        ) : null}
      </motion.header>
      <div
        className={cn(
          "min-h-0 min-w-0",
          fill && "flex flex-1 flex-col overflow-hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}
