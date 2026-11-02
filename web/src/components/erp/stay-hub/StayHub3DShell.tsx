"use client";

import { StayHubMobileDrawer } from "@/components/erp/stay-hub/StayHubMobileDrawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import {
  useEffect,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

/**
 * StayHub modal/aside shell — `.glass-elevated` chrome, Esc / Ctrl+P shortcuts.
 * Mobile/tablet (<768): bottom sheet via StayHubMobileDrawer.
 * Inner ledger grids stay opaque (enterprise dual-tier rule).
 */
export function StayHub3DShell({
  open,
  title,
  onClose,
  onPrint,
  boardDock = false,
  balanceBtn = null,
  stickyActions = null,
  children,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onPrint?: () => void;
  boardDock?: boolean;
  balanceBtn?: number | null;
  stickyActions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const isMdUp = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && onPrint) {
        e.preventDefault();
        onPrint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrint]);

  if (!open) return null;

  if (!boardDock && !isMdUp) {
    return (
      <StayHubMobileDrawer
        open={open}
        title={title}
        balanceBtn={balanceBtn}
        onClose={onClose}
        stickyActions={stickyActions}
        className={className}
      >
        {children}
      </StayHubMobileDrawer>
    );
  }

  return (
    <>
      {boardDock ? null : (
        <button
          type="button"
          aria-label="Close stay"
          className="fixed inset-0 z-[79] hidden bg-black/40 md:block"
          onClick={onClose}
        />
      )}
      <aside
        role="dialog"
        aria-modal={boardDock ? false : true}
        aria-label={title}
        className={cn(
          "stay-hub-card stay-hub-dock erp glass-elevated glass-happy-modal fixed inset-y-0 right-0 z-[80] flex h-svh flex-col gap-0 overflow-hidden border-l p-0 shadow-xl",
          "pt-[env(safe-area-inset-top)]",
          className,
        )}
        onKeyDown={((e) => {
          if (e.key === "Escape") onClose();
        }) as KeyboardEventHandler}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to desk"
          className="absolute top-2 right-2 z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
        {children}
        {stickyActions ? (
          <div className="hidden shrink-0 border-t px-3 py-2 md:block">
            <div className="flex gap-2">{stickyActions}</div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
