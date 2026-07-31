"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsIcon } from "lucide-react";

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
  useSidebar,
} from "@/components/ui/sidebar";
import { BRAND_ICONS } from "@/lib/brand";
import { ERP_MODULES, resolveModule } from "@/lib/erp-nav";
import { cn } from "@/lib/utils";

export { NAV_SECTIONS } from "@/lib/erp-nav";

export function AppSidebar({
  brandName = "Pelbu desk",
  logoSrc,
}: {
  /** Active hotel name — falls back to the Pelbu label. */
  brandName?: string;
  /** Cloudinary logo from settings; falls back to the local knot mark. */
  logoSrc?: string | null;
} = {}) {
  const pathname = usePathname();
  const activeModule = resolveModule(pathname);

  return (
    <Sidebar collapsible="icon" className="erp">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              isActive={pathname === "/erp"}
              tooltip={brandName}
            >
              <Link href="/erp">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoSrc || BRAND_ICONS.mark}
                  alt={brandName}
                  className="size-8 rounded-md object-contain"
                  width={32}
                  height={32}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{brandName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Operations
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ERP_MODULES.map((module) => {
                const active =
                  activeModule?.module.key === module.key &&
                  module.key !== "dashboard";
                const Icon = module.icon;
                return (
                  <SidebarMenuItem key={module.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={module.title}
                    >
                      <Link href={module.href}>
                        <Icon />
                        <span>{module.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
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
    </Sidebar>
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
};
