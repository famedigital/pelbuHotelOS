import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { springLayout } from "../motion/presets.js";

export type MorphTabItem<T extends string = string> = {
  id: T;
  label: ReactNode;
  count?: number;
};

type MorphTabsProps<T extends string> = {
  items: MorphTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Shared spring glow id — default Neo-Spatial activeTabGlow */
  glowId?: string;
  className?: string;
  size?: "sm" | "md";
};

const SPRING = springLayout;

export function MorphTabs<T extends string>({
  items,
  value,
  onChange,
  glowId = "activeTabGlow",
  className,
  size = "sm",
}: MorphTabsProps<T>) {
  const reduce = useReducedMotion();

  return (
    <div
      role="tablist"
      className={cn(
        "hos-glass-card relative flex flex-wrap gap-1 p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <motion.button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            whileHover={reduce ? undefined : { scale: 1.03 }}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={SPRING}
            className={cn(
              "hos-btn-tactile relative font-semibold transition-colors",
              size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
              !active && "hover:text-[var(--hos-primary)]",
            )}
          >
            {active ? (
              <motion.span
                layoutId={glowId}
                className="absolute inset-0 rounded-md border border-[var(--hos-primary)]/35 bg-[rgba(37,99,235,0.14)]"
                transition={reduce ? { duration: 0 } : SPRING}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 inline-flex items-center gap-1",
                active ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink-2)]",
              )}
            >
              {item.label}
              {item.count != null ? (
                <span className="rounded-full bg-[rgba(59,130,246,0.14)] px-1.5 font-mono text-[10px] font-bold tabular-nums">
                  {item.count}
                </span>
              ) : null}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
