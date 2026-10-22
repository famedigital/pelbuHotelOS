"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  activeSheetHref,
  DESK_PINNABLE_SHEETS,
  DESK_SHEET_TABS,
  loadPinnedSheetHrefs,
  savePinnedSheetHrefs,
  type DeskSheetTab,
} from "@/lib/erp/desk-menu";
import {
  filterErpNavByGrants,
  tabVisibleFromGrants,
} from "@/lib/erp/desk-modules";
import { ERP_MODULES } from "@/lib/erp-nav";
import { filterModulesForProductPack } from "@/lib/product-pack";
import { pushErpRecent } from "@/lib/erp-recents";
import { cn } from "@/lib/utils";
import { ListIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Google Sheets–style bottom sheet tabs (md+ only).
 * RBAC-filtered — no FO/BO workspace split. Phone uses DeskMobileNav.
 */
export function DeskSheetTabs({
  allowedModuleKeys,
}: {
  allowedModuleKeys?: readonly string[];
} = {}) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    setPinned(loadPinnedSheetHrefs());
  }, []);

  const grants = useMemo(() => {
    if (!allowedModuleKeys || allowedModuleKeys.length === 0) return null;
    return allowedModuleKeys;
  }, [allowedModuleKeys]);

  const filterTab = useCallback(
    (t: DeskSheetTab) => {
      if (!grants) return true;
      return tabVisibleFromGrants(t.moduleKey, t.href, grants);
    },
    [grants],
  );

  const defaults = DESK_SHEET_TABS;

  const pinnedTabs: DeskSheetTab[] = useMemo(() => {
    const pool = [...DESK_PINNABLE_SHEETS, ...DESK_SHEET_TABS];
    return pinned
      .map((href) => pool.find((t) => t.href === href))
      .filter((t): t is DeskSheetTab => !!t && filterTab(t))
      .filter((t) => !defaults.some((d) => d.href === t.href));
  }, [pinned, filterTab, defaults]);

  const tabs = useMemo(
    () => [...defaults.filter(filterTab), ...pinnedTabs],
    [defaults, filterTab, pinnedTabs],
  );

  const active = activeSheetHref(pathname, tabs);

  const allSheets = useMemo(() => {
    let modules = filterErpNavByGrants(ERP_MODULES, grants);
    modules = filterModulesForProductPack(modules, "hotel");
    return modules.flatMap((m) =>
      m.tabs
        .filter(
          (t) => !grants || tabVisibleFromGrants(m.key, t.href, grants),
        )
        .map((t) => ({
          title: t.title,
          href: t.href,
          group: m.title,
        })),
    );
  }, [grants]);

  const addPin = (href: string) => {
    setPinned((prev) => {
      if (prev.includes(href) || defaults.some((d) => d.href === href)) {
        return prev;
      }
      const next = [...prev, href];
      savePinnedSheetHrefs(next);
      return next;
    });
  };

  const pinnable = DESK_PINNABLE_SHEETS.filter(
    (t) => filterTab(t) && !tabs.some((x) => x.href === t.href),
  );

  return (
    <nav
      aria-label="Desk sheets"
      data-slot="desk-sheet-tabs"
      className="hidden h-8 shrink-0 items-stretch border-t border-border bg-muted/30 print:hidden md:flex"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-8 items-center justify-center border-r border-border text-muted-foreground hover:bg-muted"
            title="Add sheet tab"
            aria-label="Add sheet tab"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-xs">Pin for this shift</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {pinnable.length === 0 ? (
            <DropdownMenuItem disabled>All pinned</DropdownMenuItem>
          ) : (
            pinnable.map((t) => (
              <DropdownMenuItem key={t.href} onClick={() => addPin(t.href)}>
                {t.title}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-8 items-center justify-center border-r border-border text-muted-foreground hover:bg-muted"
            title="All sheets"
            aria-label="All sheets"
          >
            <ListIcon className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[min(24rem,70vh)] w-56 overflow-y-auto"
        >
          <DropdownMenuLabel className="text-xs">All sheets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allSheets.map((t) => (
            <DropdownMenuItem key={`${t.group}-${t.href}`} asChild>
              <Link
                href={t.href}
                onClick={() =>
                  pushErpRecent({ href: t.href, title: t.title })
                }
              >
                <span className="truncate">{t.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {t.group}
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t) => {
          const isActive = active === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() =>
                pushErpRecent({ href: t.href, title: t.title })
              }
              className={cn(
                "flex shrink-0 items-center border-r border-border px-3 text-[12px] font-medium text-muted-foreground hover:bg-background",
                isActive &&
                  "bg-background text-foreground shadow-[inset_0_2px_0_0] shadow-primary",
              )}
            >
              {t.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
