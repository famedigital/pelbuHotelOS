"use client";

import {
  agentLogout,
  setAgentActiveProperty,
} from "@/app/actions/agent-auth";
import { Button } from "@/components/ui/button";
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { BRAND_ICONS } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  BedDoubleIcon,
  Building2Icon,
  CalendarDaysIcon,
  CircleDollarSignIcon,
  DoorOpenIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlusCircleIcon,
  ScrollTextIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BedDoubleIcon;
  exact?: boolean;
};

const DASH_NAV: NavItem[] = [
  {
    href: "/agents/app",
    label: "Living dashboard",
    icon: LayoutDashboardIcon,
    exact: true,
  },
];

const WORK_NAV: NavItem[] = [
  { href: "/agents/app/stays", label: "Stays", icon: BedDoubleIcon },
  { href: "/agents/app/book", label: "Book / hold", icon: PlusCircleIcon },
  {
    href: "/agents/app/calendar",
    label: "Availability",
    icon: CalendarDaysIcon,
  },
  { href: "/agents/app/guests", label: "Guest register", icon: UserRoundIcon },
  {
    href: "/agents/app/checkouts",
    label: "Checkouts",
    icon: DoorOpenIcon,
  },
];

const MONEY_NAV: NavItem[] = [
  { href: "/agents/app/invoices", label: "Invoices", icon: FileTextIcon },
  { href: "/agents/app/payments", label: "Payments", icon: WalletIcon },
  {
    href: "/agents/app/money",
    label: "Money & dues",
    icon: CircleDollarSignIcon,
  },
  {
    href: "/agents/app/money/statement",
    label: "Statement",
    icon: ScrollTextIcon,
  },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={`${item.href}-${item.label}`}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={cn(
                    active && "bg-sky-100/90 font-medium text-sky-950",
                  )}
                >
                  <Link href={item.href} onClick={onNavigate}>
                    <Icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AgentAppSidebar({
  companyName,
  links = [],
  activePropertyId = null,
  activePropertyName = null,
}: {
  companyName: string;
  links?: { propertyId: string; propertyName: string }[];
  activePropertyId?: string | null;
  activePropertyName?: string | null;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/70">
      <SidebarHeader className="gap-3 border-b border-border/60 p-3">
        <div className="flex items-center gap-2.5 px-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg object-contain ring-1 ring-border/60"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-sky-700 uppercase">
              Innora Partner
            </p>
            <p className="truncate text-sm font-semibold tracking-tight">
              {companyName}
            </p>
            {activePropertyName ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {activePropertyName}
              </p>
            ) : null}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <NavGroup
          label="Dashboard"
          items={DASH_NAV}
          pathname={pathname}
          onNavigate={closeMobile}
        />
        <NavGroup
          label="Operations"
          items={WORK_NAV}
          pathname={pathname}
          onNavigate={closeMobile}
        />
        <NavGroup
          label="Money"
          items={MONEY_NAV}
          pathname={pathname}
          onNavigate={closeMobile}
        />

        {links.length > 1 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Hotels</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {links.map((link) => {
                  const active = activePropertyId === link.propertyId;
                  return (
                    <SidebarMenuItem key={link.propertyId}>
                      <form action={setAgentActiveProperty} className="w-full">
                        <input
                          type="hidden"
                          name="property_id"
                          value={link.propertyId}
                        />
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={link.propertyName}
                          className={cn(active && "bg-sky-100/90 text-sky-950")}
                        >
                          <button
                            type="submit"
                            className="w-full"
                            onClick={closeMobile}
                          >
                            <Building2Icon />
                            <span>{link.propertyName}</span>
                          </button>
                        </SidebarMenuButton>
                      </form>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="All hotels">
                    <Link
                      href="/agents/app/select-property"
                      onClick={closeMobile}
                    >
                      <Building2Icon />
                      <span>Switch hotel…</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-2">
        <form action={agentLogout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-start gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <LogOutIcon className="size-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">
              Sign out
            </span>
          </Button>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
