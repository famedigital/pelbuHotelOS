"use client";

import { deskLogout } from "@/app/actions/desk";
import { openErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { ERP_MODULES, NAV_SECTIONS } from "@/lib/erp-nav";
import {
  filterErpNavByGrants,
  tabVisibleFromGrants,
} from "@/lib/erp/desk-modules";
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
import {
  BedDoubleIcon,
  CalendarDaysIcon,
  EllipsisIcon,
  SearchIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const PRIMARY_ITEMS = [
  {
    title: "Calendar",
    href: "/erp/calendar",
    icon: CalendarDaysIcon,
    moduleKey: "calendar",
  },
  {
    title: "Book",
    href: "/erp/fast-book",
    icon: SparklesIcon,
    moduleKey: "front-desk",
  },
  {
    title: "Stay",
    href: "/erp/in-house",
    icon: BedDoubleIcon,
    moduleKey: "front-desk",
  },
  {
    title: "POS",
    href: "/erp/pos",
    icon: ShoppingCartIcon,
    moduleKey: "pos",
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DeskMobileNav({
  allowedModuleKeys,
}: {
  allowedModuleKeys?: readonly string[];
} = {}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allow = useMemo(() => {
    if (!allowedModuleKeys || allowedModuleKeys.length === 0) return null;
    return allowedModuleKeys;
  }, [allowedModuleKeys]);

  const primary = PRIMARY_ITEMS.filter((item) => {
    if (!allow) return true;
    return tabVisibleFromGrants(item.moduleKey, item.href, allow);
  });
  const sections = useMemo(() => {
    if (!allow) return NAV_SECTIONS;
    return filterErpNavByGrants(ERP_MODULES, allow).map((m) => ({
      label: m.title,
      items: m.tabs,
    }));
  }, [allow]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            section.label.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, sections]);

  return (
    <nav
      aria-label="Desk navigation"
      data-slot="desk-mobile-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div
        className="grid h-16"
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
                "relative flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              <span>{item.title}</span>
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-primary"
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
            className="max-h-[88dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Pelbu desk</SheetTitle>
              <SheetDescription>
                Tools available on your desk account.
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-5">
              <div className="mb-4 space-y-2">
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
                    className="h-11 rounded-xl pl-9 text-base"
                  />
                </div>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm font-medium"
                    onClick={() => openErpCommandPalette()}
                  >
                    <SearchIcon className="size-4 shrink-0" />
                    Jump to any screen…
                  </button>
                </SheetClose>
              </div>

              {filteredSections.length === 0 ? (
                <p className="mb-5 py-6 text-center text-sm text-muted-foreground">
                  No tools match “{query.trim()}”.
                </p>
              ) : (
                filteredSections.map((section) => (
                  <section key={section.label} className="mb-5">
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {section.label}
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(pathname, item.href);
                        return (
                          <SheetClose asChild key={item.href}>
                            <Link
                              href={item.href}
                              className={cn(
                                "flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm",
                                active && "border-primary/40 bg-primary/5",
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
              <form action={deskLogout}>
                <button
                  type="submit"
                  className="min-h-12 w-full rounded-xl border border-border px-4 text-sm font-medium"
                >
                  Sign out
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
