"use client";

import { resolveModule } from "@/lib/erp-nav";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Tab strip for the active desk module. Renders links (not client tab panels)
 * so every screen stays a server-rendered route with its own URL.
 * Calendar routes host Room rack / Day sheet in the sticky header instead.
 */
export function ModuleTabs() {
  const pathname = usePathname();
  const match = resolveModule(pathname);

  if (!match || match.module.tabs.length < 2) return null;
  // Calendar and the POS register own their own chrome; hide the global strip.
  if (match.module.key === "calendar") return null;
  if (pathname === "/erp/pos" || pathname === "/erp/pos/") return null;

  return (
    <div className="erp border-b bg-background/95">
      <nav
        aria-label={`${match.module.title} sections`}
        className="mx-auto flex w-full max-w-[1200px] gap-1 overflow-x-auto px-4 py-2 md:px-6"
      >
        {match.module.tabs.map((tab) => {
          const active = tab.href === match.tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.title}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
