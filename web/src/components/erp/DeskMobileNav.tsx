"use client";

import { deskLogout } from "@/app/actions/desk";
import { openErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { useDeskWorkspace } from "@/components/erp/DeskWorkspaceProvider";
import { DeskWorkspaceToggle } from "@/components/erp/DeskWorkspaceToggle";
import { ERP_MODULES } from "@/lib/erp-nav";
import {
  erpNavMatchesQuery,
  erpNavSearchHaystack,
} from "@/lib/erp-nav-search";
import { tabVisibleFromGrants } from "@/lib/erp/desk-modules";
import { filterModulesForWorkspace, foMoreModules } from "@/lib/erp/desk-workspace";
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
import {
  CalendarDaysIcon,
  ClipboardListIcon,
  EllipsisIcon,
  SearchIcon,
  ShoppingCartIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const PRIMARY_FRONT_DESK = [
  {
    title: "Today",
    href: "/erp/today",
    icon: ClipboardListIcon,
    moduleKey: "front-desk",
  },
  {
    title: "Stay View",
    href: "/erp/calendar",
    icon: CalendarDaysIcon,
    moduleKey: "calendar",
  },
  {
    title: "HK",
    href: "/erp/housekeeping",
    icon: SparklesIcon,
    moduleKey: "rooms",
  },
  {
    title: "POS",
    href: "/erp/pos",
    icon: ShoppingCartIcon,
    moduleKey: "pos",
  },
] as const;

const PRIMARY_BACK_OFFICE = [
  {
    title: "Finance",
    href: "/erp/finance",
    icon: WalletIcon,
    moduleKey: "money",
  },
  {
    title: "Pay",
    href: "/erp/payments",
    icon: WalletIcon,
    moduleKey: "money",
  },
  {
    title: "Agents",
    href: "/erp/agents",
    icon: SparklesIcon,
    moduleKey: "channels",
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
  const { workspace } = useDeskWorkspace();

  const allow = useMemo(() => {
    if (!allowedModuleKeys || allowedModuleKeys.length === 0) return null;
    return allowedModuleKeys;
  }, [allowedModuleKeys]);

  const primaryItems =
    workspace === "back_office" ? PRIMARY_BACK_OFFICE : PRIMARY_FRONT_DESK;

  const primary = primaryItems.filter((item) => {
    if (!allow) return true;
    return tabVisibleFromGrants(item.moduleKey, item.href, allow);
  });
  const sections = useMemo(() => {
    const filtered = filterModulesForWorkspace(ERP_MODULES, workspace, allow);
    const list =
      workspace === "front_desk" ? foMoreModules(filtered) : filtered;
    return list.map((m) => ({
      label: m.title,
      items: m.tabs,
    }));
  }, [allow, workspace]);

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
                {workspace === "back_office"
                  ? "Back office tools on your desk account."
                  : "Front desk tools on your desk account."}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-3 sm:hidden">
              <DeskWorkspaceToggle className="w-full justify-stretch [&>button]:flex-1" />
            </div>
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
                              onClick={() =>
                                pushErpRecent({
                                  href: item.href,
                                  title: item.title,
                                })
                              }
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
