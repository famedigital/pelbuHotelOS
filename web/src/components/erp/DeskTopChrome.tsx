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
      className="z-30 shrink-0 border-b border-border bg-background print:hidden"
    >
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
          className="ml-1 hidden min-w-0 items-center gap-0.5 md:flex"
        >
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setPickedMenu(group.id)}
              className={cn(
                "h-8 shrink-0 rounded-md px-2.5 text-[13px]",
                activeMenuId === group.id
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {MENU_TITLE[group.id] ?? group.label}
            </button>
          ))}
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

        <div className="ml-auto hidden items-center gap-1 md:flex">
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
      className="hidden w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-background px-2 py-2 md:flex print:hidden"
    >
      {topLinks.length ? (
        <div className="mb-1 flex flex-col gap-1">
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
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">
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
        "relative flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted/80 hover:text-foreground",
        active && "bg-muted font-medium text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-transparent",
          active && "bg-[var(--gold)]",
        )}
      />
      <Icon className={cn("size-4 shrink-0", sideIconTone(href))} />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}
