"use client";

import { deskLogout } from "@/app/actions/desk";
import { deskShiftChange } from "@/app/actions/staff-auth";
import type { DeskActor } from "@/lib/erp/desk-actor";
import { openErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { ERP_MODULES } from "@/lib/erp-nav";
import {
  erpNavMatchesQuery,
  erpNavSearchHaystack,
} from "@/lib/erp-nav-search";
import {
  filterErpNavByGrants,
  tabVisibleFromGrants,
} from "@/lib/erp/desk-modules";
import { filterModulesForProductPack } from "@/lib/product-pack";
import { pushErpRecent } from "@/lib/erp-recents";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DESK_SHEET_TABS, resolveMenuItems, DESK_MENU_GROUPS } from "@/lib/erp/desk-menu";
import {
  BedDoubleIcon,
  CalendarClockIcon,
  EllipsisIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const PIN_ICONS = {
  "/erp/calendar": CalendarClockIcon,
  "/erp/arrivals": LogInIcon,
  "/erp/in-house": BedDoubleIcon,
  "/erp/departures": LogOutIcon,
  "/erp/reservations": CalendarClockIcon,
} as const;

/** Phone bar — the same front-office pins as the bottom sheet tabs. */
const PRIMARY_TABS = DESK_SHEET_TABS.map((tab) => ({
  title: tab.title,
  href: tab.href,
  icon: PIN_ICONS[tab.href as keyof typeof PIN_ICONS] ?? CalendarClockIcon,
  moduleKey: tab.moduleKey,
}));

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DeskMobileNav({
  allowedModuleKeys,
  actor = null,
}: {
  allowedModuleKeys?: readonly string[];
  actor?: DeskActor | null;
} = {}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allow = useMemo(() => {
    if (!allowedModuleKeys || allowedModuleKeys.length === 0) return null;
    return allowedModuleKeys;
  }, [allowedModuleKeys]);

  const primary = PRIMARY_TABS.filter((item) => {
    if (!allow) return true;
    return tabVisibleFromGrants(item.moduleKey, item.href, allow);
  });

  const sections = useMemo(() => {
    let modules = filterErpNavByGrants(ERP_MODULES, allow);
    modules = filterModulesForProductPack(modules, "hotel");
    const hrefs = new Set<string>();
    for (const module of modules) {
      for (const tab of module.tabs) {
        if (!allow || tabVisibleFromGrants(module.key, tab.href, allow)) {
          hrefs.add(tab.href);
        }
      }
    }
    return DESK_MENU_GROUPS.map((group) => ({
      label: group.label,
      items: resolveMenuItems(group, hrefs, modules),
    })).filter((section) => section.items.length > 0);
  }, [allow]);

  const filteredSections = useMemo(() => {
    const q = query.trim();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          erpNavMatchesQuery(
            erpNavSearchHaystack({
              title: item.title,
              href: item.href,
              context: section.label,
              keywords: item.keywords,
            }),
            q,
          ),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, sections]);

  return (
    <nav
      aria-label="Desk navigation"
      data-slot="desk-mobile-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <div
        className="grid h-14"
        style={{
          gridTemplateColumns: `repeat(${Math.max(primary.length + 1, 2)}, minmax(0, 1fr))`,
        }}
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              <span>{item.title}</span>
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-primary"
                />
              ) : null}
            </Link>
          );
        })}

        <Sheet
          open={moreOpen}
          onOpenChange={(open) => {
            setMoreOpen(open);
            if (!open) setQuery("");
          }}
        >
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <EllipsisIcon className="size-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[88dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>{actor?.name || "Desk"}</SheetTitle>
              <SheetDescription>
                {[actor?.role, actor?.code].filter(Boolean).join(" · ") || "All tools for your role"}
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-3 pb-4">
              <div className="mb-3 space-y-2">
                <label className="sr-only" htmlFor="desk-more-search">
                  Search desk tools
                </label>
                <div className="relative">
                  <SearchIcon
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="desk-more-search"
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Search tools…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-11 rounded-lg pl-9 text-base"
                  />
                </div>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm font-medium"
                    onClick={() => openErpCommandPalette()}
                  >
                    <SearchIcon className="size-4 shrink-0" />
                    Jump to any screen…
                  </button>
                </SheetClose>
              </div>

              {filteredSections.length === 0 ? (
                <p className="mb-4 py-6 text-center text-sm text-muted-foreground">
                  No tools match “{query.trim()}”.
                </p>
              ) : (
                filteredSections.map((section) => (
                  <section key={section.label} className="mb-4">
                    <h2 className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {section.label}
                    </h2>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(pathname, item.href);
                        return (
                          <SheetClose asChild key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() =>
                                pushErpRecent({
                                  href: item.href,
                                  title: item.title,
                                })
                              }
                              className={cn(
                                "flex min-h-12 items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 text-sm",
                                active &&
                                  "border-primary/50 bg-primary/5 text-primary",
                              )}
                            >
                              <Icon className="size-4 shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </Link>
                          </SheetClose>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
              <div className="mt-2 grid gap-1.5">
                <form action={deskShiftChange}>
                  <button
                    type="submit"
                    className="min-h-11 w-full rounded-lg border border-border px-4 text-sm font-medium"
                  >
                    Login + · next shift
                  </button>
                </form>
                <form action={deskLogout}>
                  <button
                    type="submit"
                    className="min-h-11 w-full rounded-lg border border-border px-4 text-sm font-medium"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
