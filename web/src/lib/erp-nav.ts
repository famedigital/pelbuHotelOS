import {
  BedDoubleIcon,
  BoxesIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  CreditCardIcon,
  Globe2Icon,
  HotelIcon,
  ImageIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShirtIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SoupIcon,
  SparklesIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
  TagsIcon,
  type LucideIcon,
} from "lucide-react";

export type ErpNavLeaf = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type ErpModule = {
  key: string;
  title: string;
  icon: LucideIcon;
  /** Landing route for the module — always the first tab. */
  href: string;
  tabs: ErpNavLeaf[];
};

/**
 * Desk information architecture: ten modules, each opening on its first tab.
 * Sub-pages are tabs rather than sidebar entries so the shift path stays short
 * and related screens sit next to each other.
 *
 * Routes are unchanged — this is navigation only, so deep links and
 * revalidatePath calls elsewhere keep working.
 */
export const ERP_MODULES: ErpModule[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboardIcon,
    href: "/erp",
    tabs: [{ title: "Dashboard", href: "/erp", icon: LayoutDashboardIcon }],
  },
  {
    key: "calendar",
    title: "Calendar",
    icon: CalendarClockIcon,
    href: "/erp/calendar",
    tabs: [
      { title: "Room rack", href: "/erp/calendar", icon: CalendarClockIcon },
      {
        title: "Day sheet",
        href: "/erp/calendar/day-sheet",
        icon: ScrollTextIcon,
      },
    ],
  },
  {
    key: "front-desk",
    title: "Front desk",
    icon: UsersIcon,
    href: "/erp/arrivals",
    tabs: [
      { title: "Arrivals", href: "/erp/arrivals", icon: ClipboardListIcon },
      { title: "In-house", href: "/erp/in-house", icon: BedDoubleIcon },
      { title: "Departures", href: "/erp/departures", icon: ScrollTextIcon },
      { title: "Check-in", href: "/erp/check-in", icon: UsersIcon },
      { title: "Check-out", href: "/erp/check-out", icon: WalletIcon },
      { title: "Fast book", href: "/erp/fast-book", icon: SparklesIcon },
      {
        title: "Reservations",
        href: "/erp/reservations",
        icon: ReceiptTextIcon,
      },
      { title: "Guests", href: "/erp/guests", icon: UsersIcon },
      { title: "Loyalty", href: "/erp/loyalty", icon: SparklesIcon },
      {
        title: "Groups",
        href: "/erp/group",
        icon: HotelIcon,
      },
    ],
  },
  {
    key: "rooms",
    title: "Rooms",
    icon: HotelIcon,
    href: "/erp/rooms",
    tabs: [
      { title: "Rooms", href: "/erp/rooms", icon: HotelIcon },
      {
        title: "Housekeeping",
        href: "/erp/housekeeping",
        icon: SparklesIcon,
      },
      { title: "Lost & found", href: "/erp/lost-found", icon: ClipboardListIcon },
      { title: "Maintenance", href: "/erp/maintenance", icon: WrenchIcon },
      { title: "Laundry", href: "/erp/laundry", icon: ShirtIcon },
    ],
  },
  {
    key: "pos",
    title: "POS",
    icon: ShoppingCartIcon,
    href: "/erp/pos",
    tabs: [
      { title: "Register", href: "/erp/pos", icon: ShoppingCartIcon },
      { title: "Menu", href: "/erp/menu", icon: SoupIcon },
      {
        title: "Recipe cost",
        href: "/erp/pos/recipe-cost",
        icon: ReceiptTextIcon,
      },
      { title: "Kitchen board", href: "/erp/kitchen", icon: SoupIcon },
      {
        title: "Food cost",
        href: "/erp/kitchen/food-cost",
        icon: ReceiptTextIcon,
      },
      { title: "Kitchen TV", href: "/erp/kds", icon: MonitorIcon },
    ],
  },
  {
    key: "money",
    title: "Money",
    icon: WalletIcon,
    href: "/erp/payments",
    tabs: [
      { title: "Payments", href: "/erp/payments", icon: CreditCardIcon },
      { title: "Invoices", href: "/erp/invoices", icon: ReceiptTextIcon },
      { title: "City ledger", href: "/erp/folios", icon: WalletIcon },
      { title: "Night audit", href: "/erp/night-audit", icon: ScrollTextIcon },
      { title: "GST", href: "/erp/gst", icon: ScrollTextIcon },
      { title: "Finance", href: "/erp/finance", icon: WalletIcon },
      { title: "Reports", href: "/erp/reports", icon: ScrollTextIcon },
      {
        title: "Owner performance",
        href: "/erp/reports/performance",
        icon: ScrollTextIcon,
      },
    ],
  },
  {
    key: "channels",
    title: "Channels",
    icon: TruckIcon,
    href: "/erp/agents",
    tabs: [
      { title: "Agents", href: "/erp/agents", icon: UsersIcon },
      { title: "Rate plans", href: "/erp/rate-plans", icon: ReceiptTextIcon },
      { title: "Partners", href: "/erp/partners", icon: UsersIcon },
      { title: "Allotments", href: "/erp/allotments", icon: ClipboardListIcon },
      { title: "Channel", href: "/erp/channel", icon: TruckIcon },
    ],
  },
  {
    key: "team",
    title: "Team",
    icon: UsersIcon,
    href: "/erp/hr",
    tabs: [
      { title: "Staff", href: "/erp/hr", icon: UsersIcon },
      { title: "Rota", href: "/erp/hr/rota", icon: CalendarClockIcon },
      {
        title: "Attendance",
        href: "/erp/hr/attendance",
        icon: ClipboardListIcon,
      },
      { title: "Leave", href: "/erp/hr/leave", icon: ScrollTextIcon },
      { title: "Payroll", href: "/erp/hr/payroll", icon: WalletIcon },
    ],
  },
  {
    key: "inventory",
    title: "Inventory",
    icon: BoxesIcon,
    href: "/erp/inventory",
    tabs: [
      { title: "Items", href: "/erp/inventory", icon: BoxesIcon },
      {
        title: "Locations",
        href: "/erp/inventory/locations",
        icon: HotelIcon,
      },
      {
        title: "Moves",
        href: "/erp/inventory/moves",
        icon: ScrollTextIcon,
      },
      {
        title: "Assessment",
        href: "/erp/inventory/audits",
        icon: ClipboardListIcon,
      },
      {
        title: "POs",
        href: "/erp/inventory/purchase-orders",
        icon: ReceiptTextIcon,
      },
      { title: "Assets", href: "/erp/inventory/assets", icon: WrenchIcon },
    ],
  },
  {
    key: "hotel",
    title: "Hotel",
    icon: Globe2Icon,
    href: "/erp/settings",
    tabs: [
      { title: "Settings", href: "/erp/settings", icon: SettingsIcon },
      { title: "Room rates", href: "/erp/rates", icon: TagsIcon },
      { title: "Website CMS", href: "/erp/front-public", icon: Globe2Icon },
      {
        title: "Media",
        href: "/erp/front-public/media",
        icon: ImageIcon,
      },
      {
        title: "Phone upload",
        href: "/erp/front-public/media/upload",
        icon: SmartphoneIcon,
      },
      { title: "Add hotel", href: "/erp/properties/new", icon: HotelIcon },
      { title: "Training", href: "/erp/training", icon: ScrollTextIcon },
    ],
  },
];

/** Mobile "More" sheet groups: one section per module, listing its tabs. */
export const NAV_SECTIONS = ERP_MODULES.map((m) => ({
  label: m.title,
  items: m.tabs,
}));

/** Frequent desk jumps for Ctrl+K — subset of module tabs, no duplicate nav source. */
export const ERP_QUICK_ACTIONS: ErpNavLeaf[] = [
  { title: "Check-in", href: "/erp/check-in", icon: UsersIcon },
  { title: "Check-out", href: "/erp/check-out", icon: WalletIcon },
  { title: "POS register", href: "/erp/pos", icon: ShoppingCartIcon },
  { title: "Night audit", href: "/erp/night-audit", icon: ScrollTextIcon },
  { title: "Settings", href: "/erp/settings", icon: SettingsIcon },
  { title: "Training", href: "/erp/training", icon: ScrollTextIcon },
];

export function isNavActive(
  pathname: string | null,
  href: string,
): boolean {
  if (!pathname) return false;
  if (href === "/erp") return pathname === "/erp";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Longest-prefix match so `/erp/calendar/day-sheet` resolves to the day sheet
 * tab rather than the rack it sits under.
 */
export function resolveModule(pathname: string | null): {
  module: ErpModule;
  tab: ErpNavLeaf;
} | null {
  if (!pathname) return null;
  let best: { module: ErpModule; tab: ErpNavLeaf } | null = null;
  for (const module of ERP_MODULES) {
    for (const tab of module.tabs) {
      if (!isNavActive(pathname, tab.href)) continue;
      if (!best || tab.href.length > best.tab.href.length) {
        best = { module, tab };
      }
    }
  }
  return best;
}
