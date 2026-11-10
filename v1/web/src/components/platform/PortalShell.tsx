"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type PortalNavItem = {
  href: string;
  label: string;
  /** One-line teaching copy when this section is active */
  description?: string;
};

export function PortalShell({
  brand,
  subtitle,
  nav,
  userEmail,
  children,
}: {
  brand: string;
  subtitle: string;
  nav: PortalNavItem[];
  userEmail?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeNav =
    nav
      .filter(
        (item) =>
          pathname === item.href ||
          (item.href !== "/admin" &&
            item.href !== "/partner" &&
            pathname.startsWith(item.href)),
      )
      .sort((a, b) => b.href.length - a.href.length)[0] ?? nav[0];

  return (
    <div className="erp min-h-svh">
    <SidebarProvider defaultOpen defaultState="expanded" defaultAutoCollapse={false}>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="gap-1 px-3 py-4">
          <p className="truncate text-sm font-semibold tracking-tight">{brand}</p>
          <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      item.href !== "/partner" &&
                      pathname.startsWith(item.href));
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link href={item.href}>{item.label}</Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 py-3 text-[11px] text-muted-foreground">
          {userEmail ?? "Signed in"}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex h-11 items-center gap-2 px-3 md:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {activeNav?.label ?? brand}
              </p>
              {activeNav?.description ? (
                <p className="truncate text-xs text-muted-foreground">
                  {activeNav.description}
                </p>
              ) : (
                <p className={cn("truncate text-xs text-muted-foreground")}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <nav
            aria-label="Sections"
            className="flex max-w-full items-center gap-0.5 overflow-x-auto border-t border-border/60 bg-muted/30 px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-3"
          >
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "/partner" &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center rounded-[5px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="flex flex-1 flex-col gap-3 p-3 md:gap-4 md:p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
    </div>
  );
}
