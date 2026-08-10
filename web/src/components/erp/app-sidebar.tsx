"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, SettingsIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { BRAND_ICONS } from "@/lib/brand";
import {
  ERP_MODULES,
  type ErpModule,
  resolveModule,
} from "@/lib/erp-nav";
import {
  filterErpNavByGrants,
  firstAllowedHrefForModule,
} from "@/lib/erp/desk-modules";
import { filterModulesForProductPack } from "@/lib/product-pack";
import { pushErpRecent } from "@/lib/erp-recents";
import { cn } from "@/lib/utils";

export { NAV_SECTIONS } from "@/lib/erp-nav";

export function AppSidebar({
  brandName = "Pelbu desk",
  logoSrc,
  allowedModuleKeys,
  productPack = "hotel",
}: {
  /** Active hotel name — falls back to the Pelbu label. */
  brandName?: string;
  /** Cloudinary logo from settings; falls back to the local knot mark. */
  logoSrc?: string | null;
  /**
   * Desk grants: module keys and/or tab hrefs the session may open.
   * Omit / empty = all (legacy full access).
   */
  allowedModuleKeys?: readonly string[];
  productPack?: "hotel" | "restaurant";
} = {}) {
  const pathname = usePathname();
  const activeMatch = resolveModule(pathname);
  const modules = React.useMemo(() => {
    let list =
      !allowedModuleKeys || allowedModuleKeys.length === 0
        ? ERP_MODULES
        : filterErpNavByGrants(ERP_MODULES, allowedModuleKeys);
    list = filterModulesForProductPack(list, productPack);
    return list;
  }, [allowedModuleKeys, productPack]);
  const showSettings =
    !allowedModuleKeys ||
    allowedModuleKeys.length === 0 ||
    modules.some((m) => m.key === "hotel");

  const [browseExpanded, setBrowseExpanded] = React.useState<Set<string>>(
    () => new Set(),
  );

  const isModuleExpanded = React.useCallback(
    (key: string) =>
      activeMatch?.module.key === key || browseExpanded.has(key),
    [activeMatch?.module.key, browseExpanded],
  );

  const toggleExpanded = React.useCallback((key: string) => {
    if (activeMatch?.module.key === key) return;
    setBrowseExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [activeMatch?.module.key]);

  return (
    <Sidebar collapsible="icon" className="erp print:hidden">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              isActive={pathname === "/erp"}
              tooltip={brandName}
              className="gap-2.5"
            >
              <Link href="/erp">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoSrc || BRAND_ICONS.mark}
                  alt={brandName}
                  className="size-8 rounded-md object-contain ring-1 ring-sidebar-border/80"
                  width={32}
                  height={32}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-tight">
                    {brandName}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    Desk operations
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="text-[10px] tracking-[0.14em]">
            Modules
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {modules.map((module) => (
                <SidebarModuleItem
                  key={module.key}
                  module={module}
                  activeMatch={activeMatch}
                  expanded={isModuleExpanded(module.key)}
                  onToggle={() => toggleExpanded(module.key)}
                  landingHref={
                    allowedModuleKeys && allowedModuleKeys.length > 0
                      ? firstAllowedHrefForModule(module, allowedModuleKeys)
                      : module.href
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {showSettings ? (
        <SidebarFooter className="border-t border-sidebar-border/60">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Settings"
                isActive={pathname?.startsWith("/erp/settings") ?? false}
              >
                <Link href="/erp/settings">
                  <SettingsIcon />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  );
}

function SidebarModuleItem({
  module,
  activeMatch,
  expanded: clickExpanded,
  onToggle,
  landingHref,
}: {
  module: ErpModule;
  activeMatch: ReturnType<typeof resolveModule>;
  expanded: boolean;
  onToggle: () => void;
  landingHref: string;
}) {
  const moduleActive = activeMatch?.module.key === module.key;
  const Icon = module.icon;
  const hasSubmenu = module.tabs.length > 1;
  const [hoverOpen, setHoverOpen] = React.useState(false);
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearLeaveTimer = React.useCallback(() => {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const openSubmenu = React.useCallback(() => {
    clearLeaveTimer();
    setHoverOpen(true);
  }, [clearLeaveTimer]);

  const scheduleCloseSubmenu = React.useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setHoverOpen(false);
      leaveTimerRef.current = null;
    }, 140);
  }, [clearLeaveTimer]);

  // Active route stays open; hover peeks; click locks open while browsing.
  const expanded = moduleActive || clickExpanded || hoverOpen;

  if (!hasSubmenu) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={moduleActive}
          tooltip={module.title}
        >
          <Link href={landingHref}>
            <Icon />
            <span>{module.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem
      onMouseEnter={openSubmenu}
      onMouseLeave={scheduleCloseSubmenu}
      onFocusCapture={openSubmenu}
      onBlurCapture={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        scheduleCloseSubmenu();
      }}
    >
      <div className="flex w-full items-center gap-0.5">
        <SidebarMenuButton
          asChild
          isActive={moduleActive}
          tooltip={module.title}
          className="min-w-0 flex-1"
        >
          <Link href={landingHref}>
            <Icon />
            <span>{module.title}</span>
          </Link>
        </SidebarMenuButton>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle();
          }}
          aria-expanded={expanded}
          aria-controls={`sidebar-sub-${module.key}`}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${module.title} sections`}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[collapsible=icon]:hidden",
            moduleActive && "text-sidebar-accent-foreground",
          )}
        >
          <ChevronRightIcon
            className={cn(
              "size-4 transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        </button>
      </div>
      {expanded ? (
        <SidebarMenuSub
          id={`sidebar-sub-${module.key}`}
          className="mx-0 border-l-sidebar-border/70 px-0 group-data-[collapsible=icon]:hidden"
        >
          {module.tabs.map((tab) => {
            const tabActive = activeMatch?.tab.href === tab.href;
            return (
              <SidebarMenuSubItem key={tab.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={tabActive}
                  className="relative w-full pl-6 text-[13px]"
                >
                  <Link
                    href={tab.href}
                    onClick={() =>
                      pushErpRecent({ href: tab.href, title: tab.title })
                    }
                  >
                    <span>{tab.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

/** Pin/auto-collapse toggle for the sidebar footer or header. */
export function SidebarAutoCollapseToggle() {
  const ctx = useSidebar() as SidebarContextProps & {
    autoCollapse?: boolean;
    setAutoCollapse?: (v: boolean) => void;
  };
  const [pinned, setPinned] = React.useState<boolean>(!ctx.autoCollapse);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !pinned;
        setPinned(next);
        // Pinned = autoCollapse off (always expanded on desktop).
        ctx.setAutoCollapse?.(!next);
        if (next) ctx.setOpen(true);
      }}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium tracking-[0.16em] uppercase transition-colors",
        pinned
          ? "bg-accent/10 text-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-pressed={pinned}
      title={
        pinned
          ? "Sidebar pinned open (will not auto-collapse on narrow screens)"
          : "Sidebar auto-collapses on narrow screens"
      }
    >
      {pinned ? "Pinned" : "Auto"}
    </button>
  );
}

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  isHoverExpanded: boolean;
  setIsHoverExpanded: (value: boolean) => void;
};
