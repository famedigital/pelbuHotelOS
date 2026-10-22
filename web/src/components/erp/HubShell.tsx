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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const subtitle = active?.description ?? description;
  const linkMode = tabs.some((t) => Boolean(t.href));

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
        subtitle={subtitle}
        dense
        wide={wide}
        headerAside={headerAside}
        filters={
          <div className="flex w-full min-w-0 flex-col gap-2">
            {breadcrumb ? (
              <div className="min-w-0">{breadcrumb}</div>
            ) : null}
            <nav
              aria-label={`${heading} sections`}
              className={cn(
                "flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-border bg-muted/40 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                tabsClassName,
              )}
            >
              {tabs.map((tab) => {
                const isActive = tab.id === active?.id;
                const className = cn(
                  "inline-flex h-8 shrink-0 items-center rounded-[5px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                );
                if (linkMode && tab.href) {
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      aria-current={isActive ? "page" : undefined}
                      className={className}
                    >
                      {tab.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className={className}
                    onClick={() => setTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
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
