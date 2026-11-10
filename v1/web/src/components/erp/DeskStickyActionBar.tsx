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
          "flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card p-2.5",
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
        // Mobile: clear fixed bottom tab strip (z-40 · h-14 + safe area)
        "sticky z-10 flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card p-2.5",
        "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
