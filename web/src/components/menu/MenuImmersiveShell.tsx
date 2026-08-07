"use client";

import { usePublicMenuChromeOptional } from "@/components/site/public-menu-chrome";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Mobile-only chrome collapse for `/menu`: title/breadcrumbs slide away while
 * immersed so the dish grid fills the screen. Header + tab bar hide via context.
 */
export function MenuImmersiveShell({
  header,
  titleBlock,
  children,
  className,
}: {
  header: ReactNode;
  titleBlock: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const chrome = usePublicMenuChromeOptional();
  const hideTitle = Boolean(chrome?.hideChrome);

  return (
    <>
      {header}
      <main
        className={cn(
          "min-h-[70dvh] bg-background lg:pb-10",
          chrome?.cartActive
            ? "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
            : chrome?.immersive
              ? "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
              : "pb-28",
          className,
        )}
      >
        <div className="mx-auto w-full max-w-[1760px] px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div
            className={cn(
              "overflow-hidden border-b border-border/70 lg:max-h-[200px] lg:opacity-100 lg:py-4",
              // Instant hide on mobile immersive — animated height caused flicker with header.
              hideTitle
                ? "max-h-0 border-transparent py-0 opacity-0 pointer-events-none lg:pointer-events-auto lg:border-border/70"
                : "max-h-[200px] py-3 opacity-100",
            )}
            aria-hidden={hideTitle || undefined}
          >
            {titleBlock}
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
