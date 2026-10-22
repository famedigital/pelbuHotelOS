"use client";

import { deskLogout } from "@/app/actions/desk";
import { deskShiftChange } from "@/app/actions/staff-auth";
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
  BedDouble,
  DoorOpen,
  LayoutDashboard,
  LogIn,
  LogOut,
  MenuIcon,
  PlaneLanding,
  PrinterIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const MENU_TITLE: Record<string, string> = {
  stay: "Front office",
  book: "Booking",
  money: "Money",
  rooms: "Rooms",
  fnb: "Restaurant",
  tools: "Tools",
  hotel: "Hotel",
};

const RIBBON_LABEL: Record<string, string> = {
  "/erp/stayview": "Dashboard",
  "/erp/arrivals": "Arrivals",
  "/erp/in-house": "In house",
  "/erp/departures": "Checkout",
  "/erp/reservations": "Reservations",
  "/erp/guests": "Guests",
  "/erp/stays": "All stays",
  "/erp": "Home",
  "/erp/reserve": "New booking",
  "/erp/ask": "Free rooms",
  "/erp/calendar": "Room rack",
  "/erp/calendar/day-sheet": "Day sheet",
  "/erp/bills": "Bills",
  "/erp/folios": "Folios",
  "/erp/invoices": "Invoices",
  "/erp/payments": "Payments",
  "/erp/night-audit": "Night close",
  "/erp/housekeeping": "Housekeeping",
  "/erp/pos": "Restaurant bill",
  "/erp/kitchen": "Kitchen",
};

const STAY_LIST_HREFS = new Set([
  "/erp/stayview",
  "/erp/arrivals",
  "/erp/in-house",
  "/erp/departures",
]);

const STAY_RIBBON: {
  href: string;
  label: string;
  icon: LucideIcon;
  tab: string | null;
  emphasis?: boolean;
}[] = [
  { href: "/erp/stayview", label: "Dashboard", icon: LayoutDashboard, tab: null },
  {
    href: "/erp/stayview?tab=checkout",
    label: "Checkout",
    icon: LogOut,
    tab: "checkout",
  },
  {
    href: "/erp/stayview?tab=inhouse",
    label: "In house",
    icon: BedDouble,
    tab: "inhouse",
  },
  {
    href: "/erp/stayview?tab=arrival",
    label: "Arrival",
    icon: PlaneLanding,
    tab: "arrival",
  },
  {
    href: "/erp/stayview?tab=empty",
    label: "Empty rooms",
    icon: DoorOpen,
    tab: "empty",
  },
  {
    href: "/erp/stayview?tab=arrival",
    label: "Check in",
    icon: LogIn,
    tab: "check-in",
    emphasis: true,
  },
];

function ribbonLabel(href: string, title: string) {
  return RIBBON_LABEL[href] ?? title;
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

/**
 * Word-style desk chrome: menu titles, then a ribbon of icon + label.
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
  const allowedHrefs = useAllowedHrefs(allowedModuleKeys);
  const bizLabel = businessDate?.slice(0, 10) ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickedMenu, setPickedMenu] = useState<string | null>(null);

  const groups = useMemo(() => {
    return DESK_MENU_GROUPS.map((g) => ({
      ...g,
      items: resolveMenuItems(g, allowedHrefs),
    })).filter((g) => g.items.length > 0);
  }, [allowedHrefs]);

  const pathGroupId =
    groups.find((group) =>
      group.items.some((item) => pathMatchesHref(pathname, item.href)),
    )?.id ??
    groups[0]?.id ??
    null;
  const activeMenuId = pickedMenu ?? pathGroupId;
  const activeGroup =
    groups.find((group) => group.id === activeMenuId) ?? groups[0];

  useEffect(() => {
    setPickedMenu(null);
  }, [pathname]);

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

        <nav
          aria-label="Desk menus"
          className="ml-1 hidden min-w-0 flex-1 items-center gap-0.5 md:flex"
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
                {groups.map((group) => (
                  <section key={group.id}>
                    <h2 className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {MENU_TITLE[group.id] ?? group.label}
                    </h2>
                    <ul className="space-y-0.5">
                      {group.id === "stay"
                        ? STAY_RIBBON.filter((item) => !item.emphasis).map(
                            (item) => {
                              const Icon = item.icon;
                              return (
                                <li key={item.label}>
                                  <SheetClose asChild>
                                    <Link
                                      href={item.href}
                                      className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"
                                    >
                                      <Icon className="size-4 shrink-0 opacity-70" />
                                      {item.label}
                                    </Link>
                                  </SheetClose>
                                </li>
                              );
                            },
                          )
                        : null}
                      {group.id === "stay" ? (
                        <li>
                          <SheetClose asChild>
                            <Link
                              href="/erp/stayview?tab=arrival"
                              className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-muted"
                            >
                              <LogIn className="size-4 shrink-0" />
                              Check in
                            </Link>
                          </SheetClose>
                        </li>
                      ) : null}
                      {group.items
                        .filter(
                          (item) =>
                            group.id !== "stay" ||
                            !STAY_LIST_HREFS.has(item.href),
                        )
                        .map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <SheetClose asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  "flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted",
                                  pathMatchesHref(pathname, item.href) &&
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

      {activeGroup ? (
        <Suspense fallback={<div className="hidden h-16 border-t md:block" />}>
          <DeskRibbon group={activeGroup} pathname={pathname} />
        </Suspense>
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

function DeskRibbon({
  group,
  pathname,
}: {
  group: {
    id: string;
    items: { href: string; title: string; icon: LucideIcon }[];
  };
  pathname: string;
}) {
  const tab = useSearchParams().get("tab");
  const stay = group.id === "stay";
  const rest = stay
    ? group.items.filter((item) => !STAY_LIST_HREFS.has(item.href))
    : group.items;

  return (
    <div className="hidden min-h-16 items-stretch gap-1 overflow-x-auto border-t bg-muted/30 px-2 py-1 md:flex">
      {stay
        ? STAY_RIBBON.map((item) => {
            const on =
              !item.emphasis &&
              pathname === "/erp/stayview" &&
              (tab ?? "home") === (item.tab ?? "home");
            return (
              <RibbonButton
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={on}
                emphasis={item.emphasis}
              />
            );
          })
        : null}
      {stay && rest.length > 0 ? (
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
      ) : null}
      {rest.map((item) => (
        <RibbonButton
          key={item.href}
          href={item.href}
          label={ribbonLabel(item.href, item.title)}
          icon={item.icon}
          active={pathMatchesHref(pathname, item.href)}
          onClick={() =>
            pushErpRecent({ href: item.href, title: item.title })
          }
        />
      ))}
    </div>
  );
}

function RibbonButton({
  href,
  label,
  icon: Icon,
  active,
  emphasis,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  emphasis?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-16 max-w-24 flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1 text-center text-[11px] leading-tight hover:bg-background",
        active && "bg-background font-medium shadow-sm",
        emphasis && "border border-primary/40 bg-primary/10 font-medium",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
