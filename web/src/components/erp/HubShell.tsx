"use client";

import { DeskListShell } from "@/components/erp/DeskListShell";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback } from "react";

export type HubTab = {
  id: string;
  label: string;
  /** One-line teaching copy shown when this tab is active */
  description: string;
  /** Optional href for link-mode hubs (sibling routes). Omit for ?tab= mode. */
  href?: string;
};

/**
 * Professional compact hub: DeskListShell dense + sticky segment tabs + optional CTA.
 * Tab sync via `?tab=` (default) or per-tab `href` links.
 */
export function HubShell({
  heading,
  description,
  tabs,
  activeTab,
  tabParam = "tab",
  children,
  filters,
  headerAside,
  stickyCta,
  breadcrumb,
  wide = true,
  className,
  tabsClassName,
  /** Title and trail live in the desk menu bar. */
  hideHeading = false,
}: {
  heading: string;
  /** Hub-level subtitle when no tab overrides, or fallback */
  description: string;
  tabs: readonly HubTab[];
  activeTab: string;
  tabParam?: string;
  children: ReactNode;
  filters?: ReactNode;
  headerAside?: ReactNode;
  stickyCta?: ReactNode;
  breadcrumb?: ReactNode;
  wide?: boolean;
  className?: string;
  /** Extra classes on the section tab strip (for example hide it on desktop). */
  tabsClassName?: string;
  hideHeading?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const subtitle = active?.description ?? description;
  const linkMode = tabs.some((t) => Boolean(t.href));
  const asideInFilters = hideHeading && headerAside;
  const collapseFiltersOnDesktop =
    Boolean(tabsClassName?.split(/\s+/).includes("md:hidden")) &&
    !filters &&
    !asideInFilters;

  const setTab = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(tabParam, id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams, tabParam],
  );

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <DeskListShell
        heading={heading}
        subtitle={hideHeading ? undefined : subtitle}
        dense
        wide={wide}
        hideHeading={hideHeading}
        headerAside={hideHeading ? undefined : headerAside}
        filtersClassName={collapseFiltersOnDesktop ? "md:hidden" : undefined}
        filters={
          <div className="flex w-full min-w-0 flex-col gap-2">
            {!hideHeading && breadcrumb ? (
              <div className="min-w-0">{breadcrumb}</div>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
            <nav
              aria-label={`${heading} sections`}
              className={cn(
                "relative flex max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1 bg-muted/50 dark:bg-zinc-900/60 backdrop-blur-xl border border-border/60 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                tabsClassName,
              )}
            >
              {tabs.map((tab) => {
                const isActive = tab.id === active?.id;
                const tabItemClass = cn(
                  "relative inline-flex h-8 shrink-0 items-center rounded-lg px-3.5 text-xs font-bold whitespace-nowrap select-none transition-all duration-200 cursor-pointer active:scale-95",
                  isActive
                    ? "bg-white dark:bg-zinc-800 text-foreground border border-black/5 dark:border-white/15 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.1),inset_0_1px_1px_#fff] dark:shadow-[0_4px_18px_-2px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] font-black scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                );
                if (linkMode && tab.href) {
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      aria-current={isActive ? "page" : undefined}
                      className={tabItemClass}
                    >
                      {isActive && (
                        <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                      )}
                      {tab.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className={tabItemClass}
                    onClick={() => setTab(tab.id)}
                  >
                    {isActive && (
                      <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            {asideInFilters ? (
              <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                {headerAside}
              </div>
            ) : null}
            </div>
            {filters ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {filters}
              </div>
            ) : null}
          </div>
        }
      >
        {children}
      </DeskListShell>

      {stickyCta ? (
        <div className="sticky bottom-16 z-20 border-t border-border bg-background/95 px-3 py-2 backdrop-blur-sm md:bottom-0 md:px-4">
          {stickyCta}
        </div>
      ) : null}
    </div>
  );
}
