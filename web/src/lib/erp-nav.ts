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
  MapIcon,
  MonitorIcon,
  PhoneIcon,
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
 * Desk information architecture: modules in the sidebar; section links for the
 * active module sit **inline in the single sticky header** (ModuleHeaderTabs),
 * never a second full-width menu row under it.
 *
 * F&B is not a separate sidebar module. Cafe/bar/restaurant lives under `pos`
 * (register, menu, recipe cost, kitchen board, food cost, KDS). Chef/F&B
 * ops home is `/erp/kitchen`; FO/GM property home stays `dashboard` (`/erp`).
 * Do not add a parallel `fnb` root that only re-links these routes.
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
      {
        title: "Reservations",
        href: "/erp/reservations",
        icon: ReceiptTextIcon,
      },
      {
        title: "Sales claims",
        href: "/erp/sales-claims",
        icon: ReceiptTextIcon,
      },
      { title: "Guests", href: "/erp/guests", icon: UsersIcon },
      { title: "Loyalty", href: "/erp/loyalty", icon: SparklesIcon },
      {
        title: "Groups",
        href: "/erp/group",
        icon: HotelIcon,
      },
      {
        title: "Agent call tasks",
        href: "/erp/agents/call-tasks",
        icon: PhoneIcon,
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
        title: "Floor map",
        href: "/erp/rooms/layout",
        icon: MapIcon,
      },
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
    /** F&B sell + kitchen ops (not a separate `fnb` module). */
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
      { title: "Finance", href: "/erp/finance", icon: WalletIcon },
      { title: "Flash reports", href: "/erp/reports", icon: ScrollTextIcon },
    ],
  },
  {
    key: "channels",
    title: "Channels",
    icon: TruckIcon,
    href: "/erp/agents",
    tabs: [
      { title: "Agents", href: "/erp/agents", icon: UsersIcon },
      {
        title: "Confirmed call list",
        href: "/erp/agents/confirmed",
        icon: PhoneIcon,
      },
      {
        title: "Agent call tasks",
        href: "/erp/agents/call-tasks",
        icon: PhoneIcon,
      },
      {
        title: "Rate downloads",
        href: "/erp/agents/rate-downloads",
        icon: ReceiptTextIcon,
      },
      { title: "Marketing", href: "/erp/marketing", icon: TagsIcon },
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
      {
        title: "Module access",
        href: "/erp/hr/access",
        icon: SettingsIcon,
      },
      {
        title: "Positions",
        href: "/erp/hr/positions",
        icon: ClipboardListIcon,
      },
      {
        title: "Vacancies",
        href: "/erp/hr/vacancies",
        icon: ReceiptTextIcon,
      },
      {
        title: "Recruitment",
        href: "/erp/hr/recruitment",
        icon: ClipboardListIcon,
      },
      { title: "Rota", href: "/erp/hr/rota", icon: CalendarClockIcon },
      {
        title: "Attendance",
        href: "/erp/hr/attendance",
        icon: ClipboardListIcon,
      },
      { title: "Leave", href: "/erp/hr/leave", icon: ScrollTextIcon },
      {
        title: "ISR / Labour",
        href: "/erp/hr/isr",
        icon: ScrollTextIcon,
      },
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
      {
        title: "DOT assessment",
        href: "/erp/dot-assessment",
        icon: ClipboardListIcon,
      },
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
  {
    title: "DOT assessment",
    href: "/erp/dot-assessment",
    icon: ClipboardListIcon,
  },
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
