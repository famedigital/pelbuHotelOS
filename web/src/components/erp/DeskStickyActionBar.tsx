import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Sticky desk action strip that must sit **above** DeskMobileNav on phones
 * and never collide with section filter chips above.
 *
 * Use for save bars, phone-upload CTAs, and any floating action row on ERP list pages.
 */
export function DeskStickyActionBar({
  children,
  className,
  position = "bottom",
}: {
  children: ReactNode;
  className?: string;
  position?: "bottom" | "inline";
}) {
  if (position === "inline") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-card p-3",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Mobile: clear fixed bottom tab strip (z-40 · ~4rem + safe area)
        "sticky z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
