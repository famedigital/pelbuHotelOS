"use client";

import { deskLogout } from "@/app/actions/desk";
import { deskShiftChange } from "@/app/actions/staff-auth";
import { ErpBreadcrumb } from "@/components/erp/ErpBreadcrumb";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { DeskSearchHint } from "@/components/erp/DeskSearchHint";
import { openErpCommandPalette } from "@/components/erp/ErpCommandPalette";
import { PropertySwitcher } from "@/components/erp/PropertySwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  MenuIcon,
  PrinterIcon,
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

function deskCrumbs(
  groups: DeskMenuGroupView[],
  pathname: string,
  search: string,
): { label: string; href?: string }[] {
  let best: {
    group: DeskMenuGroupView;
    item: DeskMenuGroupView["items"][number];
  } | null = null;
  let bestLen = -1;
  for (const group of groups) {
    for (const item of group.items) {
      const matches = item.href.includes("?")
        ? menuItemActive(pathname, search, item.href)
        : pathMatchesHref(pathname, item.href);
      if (matches && item.href.length > bestLen) {
        best = { group, item };
        bestLen = item.href.length;
      }
    }
  }
  if (!best) return [];
  const groupLabel = MENU_TITLE[best.group.id] ?? best.group.label;
  const pageLabel = ribbonLabel(best.item.href, best.item.title);
  const groupHref = best.group.items[0]?.href;
  if (!groupHref || groupHref === best.item.href) {
    return [{ label: pageLabel }];
  }
  return [
    { label: groupLabel, href: groupHref },
    { label: pageLabel },
  ];
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
}: {
  brandName?: string;
  logoSrc?: string | null;
  businessDate?: string | null;
  properties?: PropertySwitcherOption[];
  activePropertyId?: string;
  allowedModuleKeys?: readonly string[];
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const allowedHrefs = useAllowedHrefs(allowedModuleKeys);
  const bizLabel = businessDate?.slice(0, 10) ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const { groups, activeMenuId, setPickedMenu } = useDeskMenu();
  const crumbs = useMemo(
    () => deskCrumbs(groups, pathname, search),
    [groups, pathname, search],
  );

  const daySheetHref = bizLabel
    ? `/erp/calendar/day-sheet?date=${bizLabel}`
    : "/erp/calendar/day-sheet";
  const showDaySheet = allowedHrefs.has("/erp/calendar/day-sheet");

  return (
    <div
      data-slot="desk-top-chrome"
      className="z-30 shrink-0 border-b border-border bg-background print:hidden"
    >
      <div className="flex h-10 min-w-0 items-center gap-1 px-2 sm:px-3">
        <Link
          href="/erp/stayview"
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

        {crumbs.length > 0 ? (
          <div className="hidden min-w-0 items-center md:flex">
            <span aria-hidden className="mx-2 h-4 w-px shrink-0 bg-border" />
            <ErpBreadcrumb
              items={crumbs}
              className="min-w-0 [&_ol]:flex-nowrap"
            />
          </div>
        ) : null}

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
          {showDaySheet ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            >
              <Link href={daySheetHref} title="Day sheet">
                <PrinterIcon className="size-3.5" />
                Day sheet
              </Link>
            </Button>
          ) : null}
          <DeskSearchHint />
          {properties && properties.length > 0 && activePropertyId ? (
            <PropertySwitcher
              properties={properties}
              activePropertyId={activePropertyId}
            />
          ) : null}
          <form action={deskShiftChange}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              title="End shift for next login"
            >
              Login +
            </Button>
          </form>
          <form action={deskLogout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              Log out
            </Button>
          </form>
        </div>
      </div>

      {crumbs.length > 0 ? (
        <div className="flex h-8 min-w-0 items-center border-t border-border px-3 md:hidden">
          <ErpBreadcrumb
            items={crumbs}
            className="min-w-0 [&_ol]:flex-nowrap"
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
  const topLinks = railTopLinks();

  return (
    <nav
      aria-label={title}
      data-slot="desk-side-nav"
      className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-background px-3 py-4 md:flex print:hidden"
    >
      <div className="flex flex-col gap-1">
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
      <p className="mt-4 border-b border-border px-2.5 pb-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </p>
      <div className="mt-3 flex flex-col gap-1">
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
        "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted/80 hover:text-foreground",
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
      <Icon className="size-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}
