"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClockIcon,
  ClipboardListIcon,
  CreditCardIcon,
  Globe2Icon,
  HotelIcon,
  ImageIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  SmartphoneIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  SoupIcon,
  SparklesIcon,
  TruckIcon,
  WalletIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

type NavLeaf = {
  title: string;
  href: string;
  icon: LucideIcon;
};
type NavSection = { label: string; items: NavLeaf[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Front desk",
    items: [
      // Daily shift path — keep the top of this list tight.
      { title: "Dashboard", href: "/erp", icon: LayoutDashboardIcon },
      { title: "Calendar", href: "/erp/calendar", icon: CalendarClockIcon },
      { title: "Check-in", href: "/erp/check-in", icon: UsersIcon },
      { title: "Arrivals", href: "/erp/arrivals", icon: ClipboardListIcon },
      { title: "In-house", href: "/erp/in-house", icon: HotelIcon },
      { title: "Departures", href: "/erp/departures", icon: ScrollTextIcon },
      { title: "Fast book", href: "/erp/fast-book", icon: SparklesIcon },
      { title: "Rooms", href: "/erp/rooms", icon: HotelIcon },
      { title: "Housekeeping", href: "/erp/housekeeping", icon: SparklesIcon },
      // Lookup / less frequent during the shift
      { title: "Reservations", href: "/erp/reservations", icon: ReceiptTextIcon },
      { title: "Guests", href: "/erp/guests", icon: UsersIcon },
      { title: "Maintenance", href: "/erp/maintenance", icon: WrenchIcon },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Payments", href: "/erp/payments", icon: CreditCardIcon },
      { title: "POS / Folio board", href: "/erp/pos", icon: ShoppingCartIcon },
      { title: "Kitchen TV", href: "/erp/kds", icon: MonitorIcon },
      { title: "Invoices", href: "/erp/invoices", icon: ReceiptTextIcon },
      { title: "Night audit", href: "/erp/night-audit", icon: ScrollTextIcon },
      { title: "Finance", href: "/erp/finance", icon: ReceiptTextIcon },
      { title: "GST", href: "/erp/gst", icon: ScrollTextIcon },
    ],
  },
  {
    label: "FRONT PUBLIC",
    items: [
      {
        title: "Website CMS",
        href: "/erp/front-public",
        icon: Globe2Icon,
      },
      {
        title: "Media library",
        href: "/erp/front-public/media",
        icon: ImageIcon,
      },
      {
        title: "Phone upload",
        href: "/erp/front-public/media/upload",
        icon: SmartphoneIcon,
      },
      { title: "Menus & prices", href: "/erp/menu", icon: SoupIcon },
    ],
  },
  {
    label: "Channels",
    items: [
      { title: "Agents", href: "/erp/agents", icon: UsersIcon },
      { title: "Partners", href: "/erp/partners", icon: UsersIcon },
      { title: "Allotments", href: "/erp/allotments", icon: ClipboardListIcon },
      { title: "Channel", href: "/erp/channel", icon: TruckIcon },
    ],
  },
  {
    label: "Inventory & people",
    items: [
      { title: "Stock", href: "/erp/inventory", icon: ShoppingCartIcon },
      { title: "HR", href: "/erp/hr", icon: UsersIcon },
      { title: "Rota", href: "/erp/hr/rota", icon: CalendarClockIcon },
      { title: "Attendance", href: "/erp/hr/attendance", icon: ClipboardListIcon },
      { title: "Leave", href: "/erp/hr/leave", icon: ScrollTextIcon },
      { title: "Payroll", href: "/erp/hr/payroll", icon: WalletIcon },
    ],
  },
  {
    label: "Group",
    items: [
      { title: "Group overview", href: "/erp/group", icon: HotelIcon },
      { title: "Add hotel", href: "/erp/properties/new", icon: HotelIcon },
      { title: "Reports", href: "/erp/reports", icon: ScrollTextIcon },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/erp") return pathname === "/erp";
  return pathname === href || pathname.startsWith(href + "/");
}

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
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
