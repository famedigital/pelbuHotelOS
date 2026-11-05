"use client";

import { deskLogout } from "@/app/actions/desk";
import { deskShiftChange } from "@/app/actions/staff-auth";
import type { DeskActor } from "@/lib/erp/desk-actor";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { DeskSearchHint } from "@/components/erp/DeskSearchHint";
import { openErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { PropertySwitcher } from "@/components/erp/PropertySwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BRAND_ICONS } from "@/lib/brand";
import {
  DESK_MENU_GROUPS,
  menuItemActive,
  DESK_RAIL_TOP,
  leafByHref,
  pathMatchesHref,
  resolveMenuItems,
} from "@/lib/erp/desk-menu";
import {
  filterErpNavByGrants,
  tabVisibleFromGrants,
} from "@/lib/erp/desk-modules";
import { ERP_MODULES } from "@/lib/erp-nav";
import { filterModulesForProductPack } from "@/lib/product-pack";
import { pushErpRecent } from "@/lib/erp-recents";
import type { PropertySwitcherOption } from "@/lib/property-types";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  MenuIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const MENU_TITLE: Record<string, string> = {
  stay: "Front office",
  money: "Cashier",
  rooms: "Rooms",
  fnb: "F&B",
  hotel: "Hotel",
};

const RIBBON_LABEL: Record<string, string> = {
  "/erp": "Home",
  "/erp/day": "Day",
  "/erp/stayview": "Dashboard",
  "/erp/arrivals": "Arrival",
  "/erp/in-house": "In house",
  "/erp/departures": "Departure",
  "/erp/reservations": "Reservations",
  "/erp/guests": "Guests",
  "/erp/stays": "Stays",
  "/erp/reserve": "New booking",
  "/erp/ask": "Free rooms",
  "/erp/calendar": "Room rack",
  "/erp/calendar/day-sheet": "Day sheet",
  "/erp/bills": "Bills",
  "/erp/bills?tab=stay": "Bills",
  "/erp/bills?tab=payments": "Payments",
  "/erp/bills?tab=invoices": "Invoices",
  "/erp/folios": "Bills",
  "/erp/invoices": "Invoices",
  "/erp/payments": "Payments",
  "/erp/night-audit": "Night close",
  "/erp/housekeeping": "Housekeeping",
  "/erp/pos": "Restaurant bill",
  "/erp/kitchen": "Kitchen",
};

function ribbonLabel(href: string, title: string) {
  return RIBBON_LABEL[href] ?? title;
}

function railTopLinks() {
  const leaves = leafByHref();
  return DESK_RAIL_TOP.flatMap((item) => {
    const leaf = leaves.get(item.href);
    if (!leaf) return [];
    return [{ href: item.href, label: item.label, icon: leaf.icon }];
  });
}

/** Grant-filtered href set — no FO/BO workspace split. */
function useAllowedHrefs(allowedModuleKeys?: readonly string[]) {
  return useMemo(() => {
    const grants =
      !allowedModuleKeys || allowedModuleKeys.length === 0
        ? null
        : allowedModuleKeys;
    let modules = filterErpNavByGrants(ERP_MODULES, grants);
    modules = filterModulesForProductPack(modules, "hotel");
    const set = new Set<string>();
    for (const m of modules) {
      for (const t of m.tabs) {
        if (!grants || tabVisibleFromGrants(m.key, t.href, grants)) {
          set.add(t.href);
        }
      }
    }
    return set;
  }, [allowedModuleKeys]);
}

type DeskMenuGroupView = {
  id: string;
  label: string;
  items: { href: string; title: string; icon: LucideIcon }[];
};

type DeskMenuValue = {
  groups: DeskMenuGroupView[];
  activeMenuId: string | null;
  setPickedMenu: (id: string) => void;
  activeGroup: DeskMenuGroupView | undefined;
};

const DeskMenuContext = createContext<DeskMenuValue | null>(null);

/** Shared menubar + sidebar state. Clicking a top menu switches the rail. */
export function DeskMenuProvider({
  allowedModuleKeys,
  children,
}: {
  allowedModuleKeys?: readonly string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const allowedHrefs = useAllowedHrefs(allowedModuleKeys);
  const [pickedMenu, setPickedMenu] = useState<string | null>(null);

  const groups = useMemo(() => {
    return DESK_MENU_GROUPS.map((g) => ({
      ...g,
      items: resolveMenuItems(g, allowedHrefs),
    })).filter((g) => g.items.length > 0);
  }, [allowedHrefs]);

  const pathGroupId =
    pathname.startsWith("/erp/folios")
      ? "money"
      : (groups.find((group) =>
          group.items.some((item) => pathMatchesHref(pathname, item.href)),
        )?.id ??
        groups[0]?.id ??
        null);
  const activeMenuId = pickedMenu ?? pathGroupId;
  const activeGroup =
    groups.find((group) => group.id === activeMenuId) ?? groups[0];

  useEffect(() => {
    setPickedMenu(null);
  }, [pathname]);

  const value = useMemo(
    () => ({ groups, activeMenuId, setPickedMenu, activeGroup }),
    [groups, activeMenuId, activeGroup],
  );

  return (
    <DeskMenuContext.Provider value={value}>{children}</DeskMenuContext.Provider>
  );
}

function useDeskMenu() {
  const value = useContext(DeskMenuContext);
  if (!value) {
    throw new Error("Desk menu is only available inside DeskMenuProvider");
  }
  return value;
}

/**
 * Word-style desk chrome: menu titles across the top.
 * The active menu's links live in DeskSideNav.
 */
export function DeskTopChrome({
  brandName = SITE_NAME,
  logoSrc,
  businessDate,
  properties,
  activePropertyId,
  allowedModuleKeys,
  actor,
}: {
  brandName?: string;
  logoSrc?: string | null;
  businessDate?: string | null;
  properties?: PropertySwitcherOption[];
  activePropertyId?: string;
  allowedModuleKeys?: readonly string[];
  actor?: DeskActor | null;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const bizLabel = businessDate?.slice(0, 10) ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const { groups, activeMenuId, setPickedMenu } = useDeskMenu();

  return (
    <div
      data-slot="desk-top-chrome"
      className="glass-top-chrome relative z-30 shrink-0 border-b border-white/10 dark:border-white/5 bg-background/85 dark:bg-zinc-950/85 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_4px_30px_rgba(0,0,0,0.05)] print:hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />
      <div className="flex h-10 min-w-0 items-center gap-1 px-2 sm:px-3">
        <Link
          href="/erp/day"
          className="mr-1 flex shrink-0 items-center gap-1.5"
          title={brandName}
        >
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt=""
              width={20}
              height={20}
              className="size-5 rounded object-contain"
              unoptimized
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={BRAND_ICONS.mark}
              alt=""
              className="size-5 rounded object-contain"
            />
          )}
          <span className="hidden max-w-[8rem] truncate text-sm font-semibold tracking-tight lg:inline">
            {brandName}
          </span>
        </Link>

        {bizLabel ? (
          <Link
            href="/erp/night-audit"
            title="Business date — night close"
            className="shrink-0"
          >
            <Badge
              variant="secondary"
              className="h-5 font-mono text-[10px] tracking-tight tabular-nums"
            >
              {bizLabel.slice(5)}
            </Badge>
          </Link>
        ) : null}
        <FrontDeskLiveRefresh />

        <nav
          aria-label="Desk menus"
          className="ml-2 hidden min-w-0 items-center gap-1 md:flex"
        >
          {groups.map((group) => {
            const isActive = activeMenuId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setPickedMenu(group.id)}
                className={cn(
                  "relative h-8 shrink-0 rounded-xl px-3 text-xs font-bold transition-all duration-200 select-none",
                  isActive
                    ? "bg-white/95 dark:bg-zinc-800/90 text-foreground border border-black/10 dark:border-white/15 shadow-[0_3px_12px_-1px_rgba(0,0,0,0.08),inset_0_1px_1px_#fff] dark:shadow-[0_4px_16px_-2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] font-black scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent",
                )}
              >
                {isActive && (
                  <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                )}
                <span>{MENU_TITLE[group.id] ?? group.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Phone Menu */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2"
              >
                <MenuIcon className="size-4" />
                Menu
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(100%,20rem)] overflow-y-auto p-0"
            >
              <SheetHeader className="border-b px-4 py-3 text-left">
                <SheetTitle>Desk</SheetTitle>
              </SheetHeader>
              <div className="space-y-3 px-3 py-3">
                {properties && properties.length > 0 && activePropertyId ? (
                  <div className="space-y-1">
                    <p className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Hotel
                    </p>
                    <PropertySwitcher
                      properties={properties}
                      activePropertyId={activePropertyId}
                      id="property_id_menu"
                      className="ml-0"
                      selectClassName="h-11 w-full max-w-none text-base"
                    />
                  </div>
                ) : null}
                <ul className="space-y-0.5">
                  {railTopLinks().map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <SheetClose asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted",
                              menuItemActive(pathname, search, item.href) &&
                                "bg-muted font-medium",
                            )}
                          >
                            <Icon className="size-4 shrink-0 opacity-70" />
                            {item.label}
                          </Link>
                        </SheetClose>
                      </li>
                    );
                  })}
                </ul>
                {groups.map((group) => (
                  <section key={group.id}>
                    <h2 className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {MENU_TITLE[group.id] ?? group.label}
                    </h2>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <SheetClose asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  "flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted",
                                  menuItemActive(pathname, search, item.href) &&
                                    "bg-muted font-medium",
                                )}
                              >
                                <Icon className="size-4 shrink-0 opacity-70" />
                                {ribbonLabel(item.href, item.title)}
                              </Link>
                            </SheetClose>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Search"
            onClick={() => openErpCommandPalette()}
          >
            <SearchIcon className="size-4" />
          </Button>
        </div>

        <div
          data-slot="erp-header-innora"
          className="ml-auto flex items-center md:ml-0"
        />

        <div className="flex items-center gap-1 md:ml-auto">
          <div className="hidden items-center gap-1 md:flex">
          <DeskSearchHint />
          {properties && properties.length > 0 && activePropertyId ? (
            <PropertySwitcher
              properties={properties}
              activePropertyId={activePropertyId}
            />
          ) : null}
          <form id="desk-shift-change" action={deskShiftChange} />
          <form id="desk-logout" action={deskLogout} />
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 max-w-[11rem] items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-muted">
              <span className="truncate">{actor?.name || "Account"}</span>
              <ChevronDownIcon className="size-3 shrink-0 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate">{actor?.name || "Account"}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {[actor?.role, actor?.code].filter(Boolean).join(" · ") || "Signed in"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/erp/settings">Hotel settings</a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/erp/hr">Staff</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button type="submit" form="desk-shift-change" className="w-full">
                  Next login
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <button type="submit" form="desk-logout" className="w-full">
                  Log out
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      {properties && properties.length > 0 && activePropertyId ? (
        <div className="flex items-center gap-2 border-t border-border px-2 py-1.5 md:hidden">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Hotel
          </span>
          <PropertySwitcher
            properties={properties}
            activePropertyId={activePropertyId}
            id="property_id_mobile"
            className="ml-0 min-w-0 flex-1"
            selectClassName="h-11 w-full max-w-none text-base"
          />
        </div>
      ) : null}

      {/* POS register portals — zero height when empty */}
      <div className="flex empty:hidden">
        <div
          data-slot="erp-header-pos-modes"
          className="flex shrink-0 items-center empty:hidden"
        />
        <div
          data-slot="erp-header-pos-actions"
          className="ml-auto flex shrink-0 items-center gap-1.5 empty:hidden"
        />
      </div>
    </div>
  );
}

/** Desktop rail for the menu picked in the top bar. Phones keep the Menu sheet. */
export function DeskSideNav() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { activeGroup } = useDeskMenu();
  if (!activeGroup) return null;

  const title = MENU_TITLE[activeGroup.id] ?? activeGroup.label;
  const inGroup = new Set(activeGroup.items.map((item) => item.href));
  const topLinks = railTopLinks().filter((item) => !inGroup.has(item.href));

  return (
    <nav
      aria-label={title}
      data-slot="desk-side-nav"
      className="glass-side-rail relative hidden w-56 lg:w-60 shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-background/70 dark:bg-zinc-950/70 backdrop-blur-2xl px-2.5 py-3 md:flex print:hidden shadow-[4px_0_30px_rgba(0,0,0,0.03)]"
    >
      <div className="px-2 mb-2 pb-1 border-b border-border/40 flex items-center justify-between">
        <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
          {title}
        </span>
        <span className="size-1.5 rounded-full bg-primary/40" />
      </div>

      {topLinks.length ? (
        <div className="mb-2 flex flex-col gap-1">
          {topLinks.map((item) => (
            <SideLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={menuItemActive(pathname, search, item.href)}
              onClick={() => pushErpRecent({ href: item.href, title: item.label })}
            />
          ))}
          <div className="my-1.5 h-px bg-border/40" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        {activeGroup.items.map((item) => (
          <SideLink
            key={item.href}
            href={item.href}
            label={ribbonLabel(item.href, item.title)}
            icon={item.icon}
            active={menuItemActive(pathname, search, item.href)}
            onClick={() => pushErpRecent({ href: item.href, title: item.title })}
          />
        ))}
      </div>
    </nav>
  );
}

function sideIconTone(href: string): string {
  const tones: Array<[string, string]> = [
    ["/erp/day", "text-amber-600"],
    ["/erp/reservations", "text-sky-600"],
    ["/erp/calendar", "text-emerald-600"],
    ["/erp/housekeeping", "text-teal-600"],
    ["/erp/laundry", "text-cyan-600"],
    ["/erp/maintenance", "text-orange-600"],
    ["/erp/lost-found", "text-rose-600"],
    ["/erp/rooms", "text-emerald-700"],
    ["/erp/finance", "text-violet-700"],
    ["/erp/payments", "text-emerald-700"],
    ["/erp/pos", "text-orange-600"],
    ["/erp/kitchen", "text-red-600"],
    ["/erp/menu", "text-amber-700"],
    ["/erp/night-audit", "text-indigo-600"],
    ["/erp/settings", "text-stone-600"],
    ["/erp/hr", "text-sky-700"],
    ["/erp/agents", "text-fuchsia-700"],
    ["/erp/reports", "text-indigo-700"],
    ["/erp/inventory", "text-lime-700"],
  ];
  return tones.find(([prefix]) => href === prefix || href.startsWith(`${prefix}/`))?.[1] ?? "text-sky-700";
}

function SideLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-xs font-semibold transition-all duration-200 select-none",
        active
          ? "bg-white/95 dark:bg-zinc-900/90 text-foreground font-black border border-black/10 dark:border-white/15 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.08),inset_0_1px_1px_#fff] dark:shadow-[0_4px_18px_-2px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] translate-x-0.5"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:translate-x-1",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
        />
      )}
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
          active
            ? "bg-primary/10 text-primary dark:bg-primary/20 shadow-sm"
            : "bg-muted/40 text-muted-foreground group-hover:bg-muted/80",
        )}
      >
        <Icon className={cn("size-3.5 shrink-0", active ? "text-primary" : sideIconTone(href))} />
      </div>
      <span className="truncate">{label}</span>
    </Link>
  );
}
