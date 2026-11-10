import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn.js";

export const Tabs = TabsPrimitive.Root;

const MorphCtx = createContext<{ value: string; glowId: string; morph: boolean }>({
  value: "",
  glowId: "activeTabGlow",
  morph: false,
});

/** Morphing Radix tabs — wrap with MorphTabsRoot when you need layoutId glow. */
export function MorphTabsRoot({
  value,
  onValueChange,
  glowId = "activeTabGlow",
  children,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  glowId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <MorphCtx.Provider value={{ value, glowId, morph: true }}>
      <Tabs value={value} onValueChange={onValueChange} className={className}>
        {children}
      </Tabs>
    </MorphCtx.Provider>
  );
}

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "hos-glass-card inline-flex flex-wrap items-center gap-1 p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  value,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  const reduce = useReducedMotion();
  const ctx = useContext(MorphCtx);
  const active = ctx.morph && ctx.value === value;

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative rounded-[8px] px-3 py-1.5 text-sm font-medium text-[var(--hos-ink-2)] transition-colors",
        "data-[state=active]:text-[var(--hos-primary)]",
        !ctx.morph && "data-[state=active]:bg-[rgba(37,99,235,0.12)]",
        "hover:text-[var(--hos-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hos-primary)]",
        className,
      )}
      {...props}
    >
      {active ? (
        <motion.span
          layoutId={ctx.glowId}
          className="absolute inset-0 rounded-[8px] border border-[var(--hos-primary)]/30 bg-[rgba(37,99,235,0.12)]"
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 450, damping: 32 }
          }
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

/** Uncontrolled convenience for pages that still use plain Tabs without MorphTabsRoot. */
export function useLocalTab(initial: string) {
  return useState(initial);
}
