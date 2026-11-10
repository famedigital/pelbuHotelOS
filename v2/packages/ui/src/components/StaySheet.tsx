import { Drawer } from "vaul";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { useIsPhone } from "../hooks/useMediaQuery.js";

/** Portal target for StayHub nested modals (invoice, RMA). */
export const STAY_SHEET_MODAL_ROOT_ID = "hos-stay-sheet-modals";

type StaySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** Optional rich header under title (identity / status). */
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /**
   * Hide visible title chrome when `header` already carries identity.
   * Defaults true on phone; pass true on desktop too for density.
   */
  compactTitle?: boolean;
  /**
   * Nested overlays (PIN, etc.) rendered inside Drawer.Content so they stay
   * inside Vaul’s focus scope. Prefer this over toggling `modal`/`dismissible`
   * (those remount the drawer mid-flight and white-screen the desk).
   */
  overlay?: ReactNode;
};

/**
 * Master–detail inspector drawer.
 * Opaque data surfaces only — no backdrop-blur / translateZ on the panel
 * (those rasterize blurry text on Windows HiDPI).
 */
export function StaySheet({
  open,
  onOpenChange,
  title,
  subtitle,
  header,
  children,
  footer,
  className,
  compactTitle = true,
  overlay,
}: StaySheetProps) {
  const isPhone = useIsPhone();
  const direction = isPhone ? "bottom" : "right";

  return (
    <Drawer.Root
      key={direction}
      open={open}
      onOpenChange={onOpenChange}
      direction={direction}
    >
      <Drawer.Portal>
        {/* Dim only — no backdrop-blur (bleeds into sheet compositing on some GPUs) */}
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-[color-mix(in_srgb,var(--hos-ink)_48%,transparent)]" />
        <Drawer.Content
          className={cn(
            /* relative — nested PIN/RMA host must live inside Content so Vaul’s
               focus scope includes those inputs (body portals are inert). */
            "hos-stay-sheet relative z-[70] flex flex-col bg-[var(--hos-cell)] text-[var(--hos-ink)] outline-none",
            isPhone
              ? "fixed inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[20px] border border-[var(--hos-line)] shadow-[var(--hos-elevated-shadow)]"
              : "fixed bottom-0 right-0 top-0 w-[min(540px,100vw)] rounded-none border-l border-[var(--hos-line)] shadow-[-8px_0_28px_-16px_rgba(0,0,0,0.45)]",
            className,
          )}
        >
          {isPhone ? (
            <div
              className="mx-auto mt-1.5 h-1 w-8 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--hos-ink)_22%,transparent)]"
              aria-hidden
            />
          ) : null}

          <header className="hos-module-chrome shrink-0 rounded-none border-x-0 border-t-0 px-3 py-1.5 sm:px-3.5 sm:py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {compactTitle || (isPhone && header) ? (
                  <>
                    <Drawer.Title className="sr-only">{title}</Drawer.Title>
                    <Drawer.Description className="sr-only">
                      {subtitle ?? "Stay editor"}
                    </Drawer.Description>
                    {header}
                  </>
                ) : (
                  <>
                    <Drawer.Title className="m-0 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--hos-ink-3)]">
                      {title}
                    </Drawer.Title>
                    {subtitle ? (
                      <Drawer.Description className="m-0 mt-0.5 truncate font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                        {subtitle}
                      </Drawer.Description>
                    ) : (
                      <Drawer.Description className="sr-only">Stay editor</Drawer.Description>
                    )}
                    {header ? <div className="mt-1.5">{header}</div> : null}
                  </>
                )}
              </div>
              <Drawer.Close
                aria-label="Close StayHub"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--hos-ink-3)] hover:bg-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)] hover:text-[var(--hos-ink)]"
              >
                <span className="text-[18px] leading-none" aria-hidden>
                  ×
                </span>
              </Drawer.Close>
            </div>
          </header>

          <div className="hos-scrollbar-slim hos-stay-sheet-body min-h-0 flex-1 overflow-auto px-3 py-1.5 sm:px-3.5 sm:py-2">
            {children}
          </div>

          {footer ? (
            <footer className="shrink-0 border-t border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:px-3.5 sm:py-2">
              {footer}
            </footer>
          ) : null}

          {/* Inside Content = inside focus trap; children set pointer-events-auto */}
          <div
            id={STAY_SHEET_MODAL_ROOT_ID}
            className="pointer-events-none absolute inset-0 z-[80]"
          />
          {overlay}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
