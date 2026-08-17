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
  /** Ops slang for Ctrl+K / mobile More search (hk, billing, walk-in, …). */
  keywords?: string[];
};

export type ErpModule = {
  key: string;
  title: string;
  icon: LucideIcon;
  /** Landing route for the module — always the first tab. */
  href: string;
  tabs: ErpNavLeaf[];
};

/** Extra search aliases keyed by tab href (merged into palette / mobile search). */
export const ERP_NAV_KEYWORDS: Record<string, string[]> = {
  "/erp": ["home", "dashboard", "desk"],
  "/erp/calendar": ["rack", "room rack", "grid", "availability"],
  "/erp/calendar/day-sheet": ["day sheet", "daily", "occupancy"],
  "/erp/arrivals": ["ci", "checkin", "check-in", "arrival", "walk-in", "walkin"],
  "/erp/in-house": ["inhouse", "in house", "stay", "guests in house"],
  "/erp/departures": ["co", "checkout", "check-out", "departure", "leave"],
  "/erp/reservations": ["booking", "book", "reservation", "hold"],
  "/erp/sales-claims": ["sales", "claim", "commission"],
  "/erp/rate-approvals": ["rate", "approval", "gm", "custom rate"],
  "/erp/guests": ["guest", "directory", "passport", "sdf", "profile"],
  "/erp/loyalty": ["loyalty", "points", "repeat"],
  "/erp/group": ["group", "group hotel", "block", "tour group"],
  "/erp/rooms": ["room", "inventory", "units"],
  "/erp/rooms/layout": ["floor", "map", "layout"],
  "/erp/housekeeping": ["hk", "housekeeping", "clean", "dirty", "maid"],
  "/erp/lost-found": ["lost", "found", "left behind"],
  "/erp/maintenance": ["maintenance", "repair", "ooo", "oos"],
  "/erp/laundry": ["laundry", "wash", "press"],
  "/erp/pos": ["pos", "register", "sell", "fnb", "food"],
  "/erp/menu": ["menu", "fnb", "food", "items"],
  "/erp/menu/print": ["print menu", "menu pdf", "a4 menu", "brochure"],
  "/erp/pos/recipe-cost": ["recipe", "cost", "food cost"],
  "/erp/kitchen": ["kitchen", "kds", "kot", "cook", "chef"],
  "/erp/kitchen/food-cost": ["food cost", "cogs"],
  "/erp/kitchen/day-pack": ["day pack", "flash", "xz", "z report"],
  "/erp/kitchen/compliance": ["bfda", "waste", "temp", "cleaning"],
  "/erp/kitchen/shopping": ["shopping", "market", "reorder"],
  "/erp/kitchen/labor": ["labor", "covers", "wages"],
  "/erp/pos/reservations": ["table reservation", "waitlist"],
  "/erp/pos/menu-engineering": ["menu engineering", "stars"],
  "/erp/pos/loyalty": ["stamp", "fnb loyalty"],
  "/erp/kds": ["kds", "kitchen tv", "pass", "expo"],
  "/erp/payments": ["payment", "pay", "cash", "collect", "money"],
  "/erp/invoices": ["invoice", "tax", "billing", "gst invoice"],
  "/erp/folios": ["folio", "city ledger", "billing", "balance", "ledger"],
  "/erp/night-audit": ["night audit", "close day", "na", "roll"],
  "/erp/finance": ["finance", "vault", "accounting", "books"],
  "/erp/finance/banking": ["bank", "banking", "recon", "statement"],
  "/erp/finance/expenses": ["expense", "expenses", "bills", "payables"],
  "/erp/finance/gst": ["gst", "tax", "vat"],
  "/erp/reports": ["report", "flash", "performance"],
  "/erp/agents": ["agent", "dmc", "tour operator", "b2b"],
  "/erp/agents/confirmed": ["confirmed", "call list", "phone list"],
  "/erp/agents/call-tasks": ["call task", "callback", "phone task"],
  "/erp/agents/rate-downloads": ["rate sheet", "download rates"],
  "/erp/marketing": ["marketing", "campaign", "promo"],
  "/erp/rate-plans": ["rate plan", "pricing", "season"],
  "/erp/partners": ["partner", "supplier"],
  "/erp/allotments": ["allotment", "block release"],
  "/erp/channel": ["channel", "ota", "channex"],
  "/erp/hr": ["hr", "staff", "team", "employee"],
  "/erp/hr/access": ["access", "permissions", "modules"],
  "/erp/hr/positions": ["position", "job title"],
  "/erp/hr/vacancies": ["vacancy", "hiring"],
  "/erp/hr/recruitment": ["recruitment", "applicant"],
  "/erp/hr/rota": ["rota", "roster", "schedule", "shift"],
  "/erp/hr/attendance": ["attendance", "clock in", "punch"],
  "/erp/hr/leave": ["leave", "holiday", "time off"],
  "/erp/hr/isr": ["isr", "labour", "labour bureau"],
  "/erp/hr/payroll": ["payroll", "salary", "wages"],
  "/erp/inventory": ["inventory", "stock", "store"],
  "/erp/settings": ["settings", "config", "property"],
  "/erp/rates": ["rates", "room rate", "pricing"],
  "/erp/training": ["training", "help", "how to"],
  "/erp/dot-assessment": ["dot", "assessment", "tourism"],
};

function leaf(
  title: string,
  href: string,
  icon: LucideIcon,
  extraKeywords?: string[],
): ErpNavLeaf {
  const merged = [
    ...(ERP_NAV_KEYWORDS[href] ?? []),
    ...(extraKeywords ?? []),
  ];
  return {
    title,
    href,
    icon,
    keywords: merged.length > 0 ? merged : undefined,
  };
}

/**
 * Desk information architecture: modules in the sidebar; section links for the
 * active module sit **inline in the single sticky header** (ModuleHeaderTabs),
 * never a second full-width menu row under it.
 */
export const ERP_MODULES: ErpModule[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboardIcon,
    href: "/erp",
    tabs: [leaf("Dashboard", "/erp", LayoutDashboardIcon)],
  },
  {
    key: "calendar",
    title: "Calendar",
    icon: CalendarClockIcon,
    href: "/erp/calendar",
    tabs: [
      leaf("Room rack", "/erp/calendar", CalendarClockIcon),
      leaf("Day sheet", "/erp/calendar/day-sheet", ScrollTextIcon),
    ],
  },
  {
    key: "front-desk",
    title: "Front desk",
    icon: UsersIcon,
    href: "/erp/arrivals",
    tabs: [
      leaf("Arrivals", "/erp/arrivals", ClipboardListIcon),
      leaf("In-house", "/erp/in-house", BedDoubleIcon),
      leaf("Departures", "/erp/departures", ScrollTextIcon),
      leaf("Reservations", "/erp/reservations", ReceiptTextIcon),
      leaf("Sales claims", "/erp/sales-claims", ReceiptTextIcon),
      leaf("Rate approvals", "/erp/rate-approvals", TagsIcon),
      leaf("Guests", "/erp/guests", UsersIcon),
      leaf("Loyalty", "/erp/loyalty", SparklesIcon),
      leaf("Group hotels", "/erp/group", HotelIcon),
    ],
  },
  {
    key: "rooms",
    title: "Rooms",
    icon: HotelIcon,
    href: "/erp/rooms",
    tabs: [
      leaf("Rooms", "/erp/rooms", HotelIcon),
      leaf("Floor map", "/erp/rooms/layout", MapIcon),
      leaf("Housekeeping", "/erp/housekeeping", SparklesIcon),
      leaf("Lost & found", "/erp/lost-found", ClipboardListIcon),
      leaf("Maintenance", "/erp/maintenance", WrenchIcon),
      leaf("Laundry", "/erp/laundry", ShirtIcon),
    ],
  },
  {
    key: "pos",
    title: "POS",
    icon: ShoppingCartIcon,
    href: "/erp/pos",
    tabs: [
      leaf("Register", "/erp/pos", ShoppingCartIcon),
      leaf("Menu", "/erp/menu", SoupIcon),
      leaf("Print menu", "/erp/menu/print", ScrollTextIcon),
      leaf("Reservations", "/erp/pos/reservations", CalendarClockIcon),
      leaf("Recipe cost", "/erp/pos/recipe-cost", ReceiptTextIcon),
      leaf("Menu engineering", "/erp/pos/menu-engineering", TagsIcon),
      leaf("Loyalty stamps", "/erp/pos/loyalty", SparklesIcon),
      leaf("Kitchen board", "/erp/kitchen", SoupIcon),
      leaf("Day pack", "/erp/kitchen/day-pack", ScrollTextIcon),
      leaf("Outlet rollup", "/erp/kitchen/outlets", BoxesIcon),
      leaf("Compliance", "/erp/kitchen/compliance", ClipboardListIcon),
      leaf("Shopping list", "/erp/kitchen/shopping", BoxesIcon),
      leaf("Labor / covers", "/erp/kitchen/labor", UsersIcon),
      leaf("Food cost", "/erp/kitchen/food-cost", ReceiptTextIcon),
      leaf("Kitchen TV", "/erp/kds", MonitorIcon),
    ],
  },
  {
    key: "money",
    title: "Money",
    icon: WalletIcon,
    href: "/erp/payments",
    tabs: [
      leaf("Payments", "/erp/payments", CreditCardIcon),
      leaf("Invoices", "/erp/invoices", ReceiptTextIcon),
      leaf("City ledger", "/erp/folios", WalletIcon),
      leaf("Night audit", "/erp/night-audit", ScrollTextIcon),
      leaf("Banking", "/erp/finance/banking", CreditCardIcon),
      leaf("Expenses", "/erp/finance/expenses", ReceiptTextIcon),
      leaf("GST", "/erp/finance/gst", ScrollTextIcon),
      leaf("Finance", "/erp/finance", WalletIcon),
      leaf("Flash reports", "/erp/reports", ScrollTextIcon),
    ],
  },
  {
    key: "channels",
    title: "Channels",
    icon: TruckIcon,
    href: "/erp/agents",
    tabs: [
      leaf("Agents", "/erp/agents", UsersIcon),
      leaf("Confirmed call list", "/erp/agents/confirmed", PhoneIcon),
      leaf("Agent call tasks", "/erp/agents/call-tasks", PhoneIcon),
      leaf("Rate downloads", "/erp/agents/rate-downloads", ReceiptTextIcon),
      leaf("Marketing", "/erp/marketing", TagsIcon),
      leaf("Rate plans", "/erp/rate-plans", ReceiptTextIcon),
      leaf("Partners", "/erp/partners", UsersIcon),
      leaf("Allotments", "/erp/allotments", ClipboardListIcon),
      leaf("Channel", "/erp/channel", TruckIcon),
    ],
  },
  {
    key: "team",
    title: "Team",
    icon: UsersIcon,
    href: "/erp/hr",
    tabs: [
      leaf("Staff", "/erp/hr", UsersIcon),
      leaf("Module access", "/erp/hr/access", SettingsIcon),
      leaf("Positions", "/erp/hr/positions", ClipboardListIcon),
      leaf("Vacancies", "/erp/hr/vacancies", ReceiptTextIcon),
      leaf("Recruitment", "/erp/hr/recruitment", ClipboardListIcon),
      leaf("Rota", "/erp/hr/rota", CalendarClockIcon),
      leaf("Attendance", "/erp/hr/attendance", ClipboardListIcon),
      leaf("Leave", "/erp/hr/leave", ScrollTextIcon),
      leaf("ISR / Labour", "/erp/hr/isr", ScrollTextIcon),
      leaf("Payroll", "/erp/hr/payroll", WalletIcon),
    ],
  },
  {
    key: "inventory",
    title: "Inventory",
    icon: BoxesIcon,
    href: "/erp/inventory",
    tabs: [
      leaf("Items", "/erp/inventory", BoxesIcon),
      leaf("Locations", "/erp/inventory/locations", HotelIcon),
      leaf("Moves", "/erp/inventory/moves", ScrollTextIcon),
      leaf("Assessment", "/erp/inventory/audits", ClipboardListIcon),
      leaf("POs", "/erp/inventory/purchase-orders", ReceiptTextIcon),
      leaf("Assets", "/erp/inventory/assets", WrenchIcon),
    ],
  },
  {
    key: "hotel",
    title: "Hotel",
    icon: Globe2Icon,
    href: "/erp/settings",
    tabs: [
      leaf("Settings", "/erp/settings", SettingsIcon),
      leaf("Room rates", "/erp/rates", TagsIcon),
      leaf("Website CMS", "/erp/front-public", Globe2Icon),
      leaf("Media", "/erp/front-public/media", ImageIcon),
      leaf("Phone upload", "/erp/front-public/media/upload", SmartphoneIcon),
      leaf("Add hotel", "/erp/properties/new", HotelIcon),
      leaf("DOT assessment", "/erp/dot-assessment", ClipboardListIcon),
      leaf("Training", "/erp/training", ScrollTextIcon),
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
  leaf("Check-in", "/erp/arrivals", UsersIcon, ["ci", "arrival", "walk-in"]),
  leaf("Check-out", "/erp/departures", WalletIcon, ["co", "departure"]),
  leaf("POS register", "/erp/pos", ShoppingCartIcon, ["pos", "fnb"]),
  leaf("Night audit", "/erp/night-audit", ScrollTextIcon, ["na", "close day"]),
  leaf("Settings", "/erp/settings", SettingsIcon),
  leaf("Training", "/erp/training", ScrollTextIcon),
  leaf("DOT assessment", "/erp/dot-assessment", ClipboardListIcon),
];

/** Deep detail routes → parent module tab when longest-prefix tab match fails. */
const DEEP_ROUTE_RULES: ReadonlyArray<{
  test: (pathname: string) => boolean;
  moduleKey: string;
  tabHref: string;
}> = [
  {
    test: (p) => /^\/erp\/guests\/[^/]+/.test(p),
    moduleKey: "front-desk",
    tabHref: "/erp/guests",
  },
  {
    test: (p) => p.startsWith("/erp/folios/"),
    moduleKey: "money",
    tabHref: "/erp/folios",
  },
  {
    test: (p) => /^\/erp\/agents\/call-tasks\/[^/]+/.test(p),
    moduleKey: "channels",
    tabHref: "/erp/agents/call-tasks",
  },
  {
    test: (p) =>
      /^\/erp\/agents\/[^/]+/.test(p) &&
      !p.startsWith("/erp/agents/call-tasks") &&
      !p.startsWith("/erp/agents/confirmed") &&
      !p.startsWith("/erp/agents/rate-downloads"),
    moduleKey: "channels",
    tabHref: "/erp/agents",
  },
  {
    test: (p) => p.startsWith("/erp/finance/"),
    moduleKey: "money",
    tabHref: "/erp/finance",
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
 * tab rather than the rack it sits under. Deep detail routes fall back to
 * parent module tabs (guest profile, folio, agent dossier, finance children).
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
  if (best) return best;

  for (const rule of DEEP_ROUTE_RULES) {
    if (!rule.test(pathname)) continue;
    const module = ERP_MODULES.find((m) => m.key === rule.moduleKey);
    if (!module) continue;
    const tab =
      module.tabs.find((t) => t.href === rule.tabHref) ?? module.tabs[0];
    if (!tab) continue;
    return { module, tab };
  }

  return null;
}

/** Haystack string for Ctrl+K / mobile search on a nav leaf. */
export function erpNavLeafHaystack(
  tab: ErpNavLeaf,
  moduleTitle?: string,
): string {
  return [tab.title, moduleTitle, tab.href, ...(tab.keywords ?? [])]
    .filter(Boolean)
    .join(" ");
}
