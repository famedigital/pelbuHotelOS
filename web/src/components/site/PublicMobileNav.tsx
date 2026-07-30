"use client";

import { cn } from "@/lib/utils";
import {
  CalendarDaysIcon,
  ConciergeBellIcon,
  HomeIcon,
  SoupIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon, match: "exact" as const },
  { href: "/rooms", label: "Rooms", icon: ConciergeBellIcon, match: "prefix" as const },
  { href: "/book", label: "Book", icon: CalendarDaysIcon, match: "prefix" as const },
  { href: "/menu", label: "Menu", icon: SoupIcon, match: "prefix" as const },
  { href: "/spa", label: "Spa", icon: SparklesIcon, match: "prefix" as const },
] as const;

const HIDDEN_PREFIXES = [
  "/erp",
  "/staff",
  "/login",
  "/agents/portal",
  "/agents/app",
  "/agents/login",
  "/pay",
];

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** App-like public footer tabs — mobile only; desktop keeps SiteHeader nav. */
export function PublicMobileNav() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <>
      <div
        className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden"
        aria-hidden
      />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href, item.match);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  active && "text-sky-700",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                <span>{item.label}</span>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-citrus"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
