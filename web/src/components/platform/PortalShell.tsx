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

  return (
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
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className={cn("text-sm text-muted-foreground")}>{brand}</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
