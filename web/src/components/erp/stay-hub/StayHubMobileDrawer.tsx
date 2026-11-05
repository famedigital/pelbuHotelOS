"use client";

import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import {
  useEffect,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

/**
 * Phone / tablet StayHub surface — swipe-feel bottom sheet with handlebar,
 * live balance pill, scrollable body, and a sticky thumb-zone action dock.
 */
export function StayHubMobileDrawer({
  open,
  title,
  balanceBtn = null,
  onClose,
  children,
  stickyActions = null,
  className,
}: {
  open: boolean;
  title: string;
  balanceBtn?: number | null;
  onClose: () => void;
  children: ReactNode;
  stickyActions?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const clear =
    balanceBtn == null ||
    !Number.isFinite(balanceBtn) ||
    Math.abs(balanceBtn) <= 0.5;

  return (
    <>
      <button
        type="button"
        aria-label="Close stay"
        className="fixed inset-0 z-[79] bg-black/45 backdrop-blur-md md:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "stay-hub-card erp glass-elevated glass-happy-modal fixed inset-x-0 bottom-0 z-[80] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border-t md:hidden",
          "pb-[env(safe-area-inset-bottom)]",
          className,
        )}
        onKeyDown={((e) => {
          if (e.key === "Escape") onClose();
        }) as KeyboardEventHandler}
      >
        <div className="relative flex shrink-0 items-center justify-center px-3 pt-2 pb-1">
          <span
            aria-hidden
            className="h-1.5 w-12 rounded-full bg-muted-foreground/35"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stay"
            className="touch-press absolute top-1.5 right-2 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
          {balanceBtn != null ? (
            <span
              className={cn(
                "absolute top-2 left-3 inline-flex min-h-8 items-center rounded-full border px-2.5 text-xs font-semibold tabular-nums",
                clear
                  ? "glass-badge-clean border-emerald-500/35"
                  : "border-amber-500/45 bg-amber-500/12 text-amber-800 dark:text-amber-200",
              )}
            >
              {clear ? "BTN 0.00" : formatGuestBtn(balanceBtn)}
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {stickyActions ? (
          <div className="shrink-0 border-t border-border bg-background px-3 py-2">
            <div className="flex min-h-12 items-stretch gap-2">{stickyActions}</div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
