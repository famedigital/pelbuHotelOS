"use client";

import { usePublicMenuChromeOptional } from "@/components/site/public-menu-chrome";
import { useStaySearchOptional } from "@/components/site/PublicStaySearch";
import { hidesPublicChrome } from "@/lib/public-chrome";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
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
  {
    href: "/rooms",
    label: "Rooms",
    icon: ConciergeBellIcon,
    match: "prefix" as const,
  },
  {
    href: "/book",
    label: "Book",
    icon: CalendarDaysIcon,
    match: "prefix" as const,
    emphasize: true,
    openSheet: true,
  },
  { href: "/menu", label: "Dine", icon: SoupIcon, match: "prefix" as const },
  { href: "/spa", label: "Spa", icon: SparklesIcon, match: "prefix" as const },
] as const;

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function scrollDocumentToTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

/** App-like public footer tabs — mobile only; desktop keeps SiteHeader nav. */
export function PublicMobileNav() {
  const pathname = usePathname();
  const staySearch = useStaySearchOptional();
  const menuChrome = usePublicMenuChromeOptional();
  if (hidesPublicChrome(pathname)) return null;

  if (menuChrome?.cartActive) return null;

  if (menuChrome?.immersive) {
    return (
      <>
        <div
          className="h-[calc(3.25rem_+_env(safe-area-inset-bottom,0px))] md:hidden"
          aria-hidden
        />
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cedar-rule bg-mist-0/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_-18px_rgba(14,22,19,0.28)] backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={scrollDocumentToTop}
            className="mx-auto flex h-12 w-full max-w-lg items-center justify-center gap-2 text-sm font-semibold text-juniper"
            aria-label="Back to top"
          >
            <ArrowUpIcon className="size-4" aria-hidden />
            Back to top
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="h-[calc(4rem_+_env(safe-area-inset-bottom,0px))] md:hidden"
        aria-hidden
      />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cedar-rule bg-mist-0/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_-18px_rgba(14,22,19,0.28)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const emphasize = "emphasize" in item && item.emphasize;
            const openSheet = "openSheet" in item && item.openSheet;
            const pathActive = isActive(pathname, item.href, item.match);
            const active =
              openSheet && staySearch
                ? staySearch.open || pathActive
                : pathActive;

            const className = cn(
              "relative flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
              active && "text-juniper",
              emphasize && !active && "text-juniper-soft",
            );

            const content = (
              <>
                <span
                  className={cn(
                    emphasize &&
                      "mb-0.5 -mt-3 flex size-10 items-center justify-center rounded-full bg-ember text-white shadow-sm",
                  )}
                >
                  <Icon
                    className={cn("size-5", emphasize && "size-[1.15rem]")}
                    strokeWidth={active || emphasize ? 2.4 : 1.8}
                  />
                </span>
                <span className={cn(emphasize && "font-semibold text-cedar-ink")}>
                  {item.label}
                </span>
                {active && !emphasize ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-ember"
                  />
                ) : null}
              </>
            );

            if (openSheet) {
              return (
                <button
                  key={item.href}
                  type="button"
                  className={className}
                  aria-current={active ? "page" : undefined}
                  aria-haspopup="dialog"
                  aria-expanded={staySearch?.open ?? false}
                  onClick={() => staySearch?.openStaySearch()}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={className}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
