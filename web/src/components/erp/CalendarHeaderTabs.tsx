"use client";

import { resolveModule } from "@/lib/erp-nav";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Compact Room rack | Day sheet control for the sticky DeskShell header.
 * Replaces the below-header ModuleTabs strip on calendar routes.
 */
export function CalendarHeaderTabs() {
  const pathname = usePathname();
  const match = resolveModule(pathname);
  if (!match || match.module.key !== "calendar") return null;

  return (
    <nav
      aria-label="Calendar sections"
      className="ml-1 flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5"
    >
      {match.module.tabs.map((tab) => {
        const active = tab.href === match.tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded-[5px] px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
