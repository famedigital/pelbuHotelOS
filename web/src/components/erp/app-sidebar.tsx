"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, SettingsIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useDeskWorkspace } from "@/components/erp/DeskWorkspaceProvider";
import {
  ERP_MODULES,
  type ErpModule,
  resolveModule,
} from "@/lib/erp-nav";
import { firstAllowedHrefForModule, moduleVisibleFromGrants } from "@/lib/erp/desk-modules";
import { filterModulesForWorkspace, foSidebarModules } from "@/lib/erp/desk-workspace";
import { filterModulesForProductPack } from "@/lib/product-pack";
import { pushErpRecent } from "@/lib/erp-recents";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

export { NAV_SECTIONS } from "@/lib/erp-nav";

/**
 * Standard shadcn sidebar menus:
 * - Icon rail stays icons; no hover-grow of the shell.
 * - Nested modules open on chevron **click** only (not mouseenter).
 * - When the rail is collapsed, sub-items open as a right flyout (click).
 */
export function AppSidebar({
  brandName = SITE_NAME,
  logoSrc,
  allowedModuleKeys,
  productPack = "hotel",
}: {
  brandName?: string;
  logoSrc?: string | null;
  allowedModuleKeys?: readonly string[];
  productPack?: "hotel" | "restaurant";
} = {}) {
  const pathname = usePathname();
  const activeMatch = resolveModule(pathname);
  const { workspace } = useDeskWorkspace();
  const modules = React.useMemo(() => {
    const grants =
      !allowedModuleKeys || allowedModuleKeys.length === 0
        ? null
        : allowedModuleKeys;
    let list = filterModulesForWorkspace(ERP_MODULES, workspace, grants);
    list = filterModulesForProductPack(list, productPack);
    if (workspace === "front_desk") {
      list = foSidebarModules(list);
    }
    return list;
  }, [allowedModuleKeys, productPack, workspace]);
  const showSettings =
    !allowedModuleKeys ||
    allowedModuleKeys.length === 0 ||
    moduleVisibleFromGrants("hotel", allowedModuleKeys);

  // User-opened modules (independent of route). Active module always shows.
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    const key = activeMatch?.module.key;
    if (!key) return;
    setOpenKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [activeMatch?.module.key]);

  const isModuleOpen = React.useCallback(
    (key: string) => openKeys.has(key) || activeMatch?.module.key === key,
    [openKeys, activeMatch?.module.key],
  );

  const toggleModule = React.useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
                    {workspace === "back_office"
                      ? "Back office"
                      : "Front desk"}
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
            {workspace === "back_office" ? "Back office" : "Front desk"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {modules.map((module) => (
                <SidebarModuleItem
                  key={module.key}
                  module={module}
                  activeMatch={activeMatch}
                  open={isModuleOpen(module.key)}
                  onToggle={() => toggleModule(module.key)}
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
  open,
  onToggle,
  landingHref,
}: {
  module: ErpModule;
  activeMatch: ReturnType<typeof resolveModule>;
  open: boolean;
  onToggle: () => void;
  landingHref: string;
}) {
  const { state, isMobile } = useSidebar();
  const iconCollapsed = state === "collapsed" && !isMobile;
  const moduleActive = activeMatch?.module.key === module.key;
  const Icon = module.icon;
  const hasSubmenu = module.tabs.length > 1;

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

  // Icon rail: stable hit targets — flyout sub-nav on click (shadcn pattern).
  if (iconCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              isActive={moduleActive}
              tooltip={module.title}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Icon />
              <span>{module.title}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={8}
            className="min-w-48"
          >
            <DropdownMenuLabel className="text-xs font-semibold tracking-wide">
              {module.title}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={landingHref}
                onClick={() =>
                  pushErpRecent({ href: landingHref, title: module.title })
                }
              >
                Overview
              </Link>
            </DropdownMenuItem>
            {module.tabs.map((tab) => (
              <DropdownMenuItem key={tab.href} asChild>
                <Link
                  href={tab.href}
                  onClick={() =>
                    pushErpRecent({ href: tab.href, title: tab.title })
                  }
                >
                  {tab.title}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  // Expanded rail: nested list toggled by chevron click only.
  return (
    <SidebarMenuItem>
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
          aria-expanded={open}
          aria-controls={`sidebar-sub-${module.key}`}
          aria-label={`${open ? "Collapse" : "Expand"} ${module.title} sections`}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
            moduleActive && "text-sidebar-accent-foreground",
          )}
        >
          <ChevronRightIcon
            className={cn(
              "size-4 transition-transform duration-200",
              open && "rotate-90",
            )}
          />
        </button>
      </div>
      {open ? (
        <SidebarMenuSub id={`sidebar-sub-${module.key}`}>
          {module.tabs.map((tab) => {
            const tabActive = activeMatch?.tab.href === tab.href;
            return (
              <SidebarMenuSubItem key={tab.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={tabActive}
                  className="w-full pl-2 text-[13px]"
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
