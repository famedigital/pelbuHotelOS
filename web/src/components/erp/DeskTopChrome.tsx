"use client";

import { deskLogout } from "@/app/actions/desk";
import { deskShiftChange } from "@/app/actions/staff-auth";
import { DeskSearchHint } from "@/components/erp/DeskSearchHint";
import { useDeskWorkspace } from "@/components/erp/DeskWorkspaceProvider";
import { DeskWorkspaceToggle } from "@/components/erp/DeskWorkspaceToggle";
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
  FO_TOOLBAR_LINKS,
  pathMatchesHref,
  resolveMenuItems,
} from "@/lib/erp/desk-menu";
import { tabVisibleFromGrants } from "@/lib/erp/desk-modules";
import { filterModulesForWorkspace } from "@/lib/erp/desk-workspace";
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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

function useAllowedHrefs(allowedModuleKeys?: readonly string[]) {
  const { workspace } = useDeskWorkspace();
  return useMemo(() => {
    const grants =
      !allowedModuleKeys || allowedModuleKeys.length === 0
        ? null
        : allowedModuleKeys;
    let modules = filterModulesForWorkspace(ERP_MODULES, workspace, grants);
    modules = filterModulesForProductPack(modules, "hotel");
    if (!grants) {
      const set = new Set<string>();
      for (const m of modules) for (const t of m.tabs) set.add(t.href);
      return set;
    }
    const set = new Set<string>();
    for (const m of modules) {
      for (const t of m.tabs) {
        if (tabVisibleFromGrants(m.key, t.href, grants)) set.add(t.href);
      }
    }
    return set;
  }, [allowedModuleKeys, workspace]);
}

/**
 * Google Sheets–style top chrome: menubar + icon toolbar (md+).
 * Phone: compact logo · date · Menu · search.
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

  const groups = useMemo(() => {
    return DESK_MENU_GROUPS.map((g) => ({
      ...g,
      items: resolveMenuItems(g, allowedHrefs),
    })).filter((g) => g.items.length > 0);
  }, [allowedHrefs]);

  const toolbarLinks = FO_TOOLBAR_LINKS.filter((l) => allowedHrefs.has(l.href));

  return (
    <div
      data-slot="desk-top-chrome"
      className="z-30 shrink-0 border-b border-border bg-background print:hidden"
    >
      {/* Menubar row */}
      <div className="flex h-9 min-w-0 items-center gap-1 px-2 sm:px-3">
        <Link
          href="/erp/stayview"
          className="mr-1 flex shrink-0 items-center gap-1.5"
          title={brandName}
        >
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt=""
              width={22}
              height={22}
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
          <span className="hidden max-w-[9rem] truncate text-sm font-semibold tracking-tight sm:inline">
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
              className="font-mono text-[10px] tracking-tight tabular-nums"
            >
              {bizLabel.slice(5)}
            </Badge>
          </Link>
        ) : null}

        {/* Desktop menubar */}
        <nav
          aria-label="Desk menus"
          className="ml-1 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex [scrollbar-width:none]"
        >
          {groups.map((group) => {
            const active = group.items.some((i) =>
              pathMatchesHref(pathname, i.href),
            );
            return (
              <DropdownMenu key={group.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "h-7 shrink-0 rounded px-2 text-[13px] font-medium text-foreground/80 outline-none hover:bg-muted",
                      active && "bg-muted text-foreground",
                    )}
                  >
                    {group.label}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {group.label}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isOn = pathMatchesHref(pathname, item.href);
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          href={item.href}
                          onClick={() =>
                            pushErpRecent({
                              href: item.href,
                              title: item.title,
                            })
                          }
                          className={cn(isOn && "bg-accent/10 font-medium")}
                        >
                          <Icon className="size-3.5 opacity-70" />
                          {item.title}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        {/* Phone Menu */}
        <div className="ml-auto flex items-center gap-1 md:ml-0 md:hidden">
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
              <div className="space-y-4 px-3 py-3">
                <DeskWorkspaceToggle className="w-full justify-stretch [&>button]:flex-1" />
                {groups.map((group) => (
                  <section key={group.id}>
                    <h2 className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
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
                                  pathMatchesHref(pathname, item.href) &&
                                    "bg-muted font-medium",
                                )}
                              >
                                <Icon className="size-4 shrink-0 opacity-70" />
                                {item.title}
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

        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          <DeskWorkspaceToggle />
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

      {/* Icon toolbar — md+ */}
      <div className="hidden h-9 items-center gap-1 border-t border-border/70 px-2 sm:px-3 md:flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => openErpCommandPalette()}
        >
          <SearchIcon className="size-3.5" />
          Search
        </Button>
        {bizLabel ? (
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Link
              href={`/erp/calendar/day-sheet?date=${bizLabel}`}
              title="Print day sheet"
            >
              <PrinterIcon className="size-3.5" />
              Day sheet
            </Link>
          </Button>
        ) : null}
        {toolbarLinks.map((l) => (
          <Button
            key={l.href}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              pathMatchesHref(pathname, l.href) && "bg-muted font-medium",
            )}
          >
            <Link href={l.href}>{l.title}</Link>
          </Button>
        ))}
        {/* POS register portals Sell | Floor */}
        <div
          data-slot="erp-header-pos-modes"
          className="flex shrink-0 items-center empty:hidden"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <div
            data-slot="erp-header-pos-actions"
            className="flex shrink-0 items-center gap-1.5 empty:hidden"
          />
        </div>
      </div>
    </div>
  );
}
