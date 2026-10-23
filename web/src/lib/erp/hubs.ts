import type { HubTab } from "@/components/erp/HubShell";

/** Server-safe parse of ?tab= against allowed ids. */
export function parseHubTab(
  raw: string | null | undefined,
  tabs: readonly HubTab[],
  fallback?: string,
): string {
  const id = (raw ?? "").trim();
  if (id && tabs.some((t) => t.id === id)) return id;
  return fallback ?? tabs[0]?.id ?? "";
}

/** Cashier: bill first, invoice only after it is issued. */
export const BILLS_TABS: HubTab[] = [
  {
    id: "collect",
    label: "To collect",
    description: "Agent by agent: the room bill, what is paid, and what Pelbu still has to collect",
  },
  {
    id: "stay",
    label: "Bills",
    description:
      "The stay bill: rooms, charges, paid, and what is still due",
  },
  {
    id: "owes",
    label: "Who owes",
    description: "Guests or agents who still have a balance to collect",
  },
  {
    id: "payments",
    label: "Payments",
    description: "Cash, bank, and QR money taken today",
  },
  {
    id: "agents",
    label: "Agents",
    description: "Agent credit — what tour companies owe the hotel",
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "Issued tax invoices, INV-…",
  },
];

/** Phase 2 — FO Stays (link-mode tabs to existing list routes) */
export const STAYS_TABS: HubTab[] = [
  {
    id: "stays",
    label: "Stays",
    description: "Today’s arrivals, in-house guests, and departures",
    href: "/erp/stays",
  },
  {
    id: "arrivals",
    label: "Arrivals",
    description: "Guests due in today",
    href: "/erp/arrivals",
  },
  {
    id: "in-house",
    label: "In-house",
    description: "Guests in rooms now",
    href: "/erp/in-house",
  },
  {
    id: "departures",
    label: "Departures",
    description: "Guests leaving today",
    href: "/erp/departures",
  },
  {
    id: "reservations",
    label: "Reservations",
    description: "All bookings list",
    href: "/erp/reservations",
  },
  {
    id: "guests",
    label: "Guests",
    description: "Guest profiles",
    href: "/erp/guests",
  },
];

export function hubTabIdFromPath(
  pathname: string,
  tabs: readonly HubTab[],
): string {
  const matches = tabs
    .filter(
      (t) =>
        t.href &&
        (pathname === t.href || pathname.startsWith(`${t.href}/`)),
    )
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0));
  return matches[0]?.id ?? tabs[0]?.id ?? "";
}

/** Phase 3 — Rooms */
export const ROOMS_TABS: HubTab[] = [
  {
    id: "rooms",
    label: "Rooms",
    description: "Room units and status",
    href: "/erp/rooms",
  },
  {
    id: "map",
    label: "Floor map",
    description: "Visual floor layout",
    href: "/erp/rooms/layout",
  },
  {
    id: "hk",
    label: "Housekeeping",
    description: "Clean / dirty / inspect board",
    href: "/erp/housekeeping",
  },
  {
    id: "lost",
    label: "Lost & found",
    description: "Guest belongings log",
    href: "/erp/lost-found",
  },
  {
    id: "maint",
    label: "Maintenance",
    description: "Work orders and room blocks",
    href: "/erp/maintenance",
  },
  {
    id: "laundry",
    label: "Laundry",
    description: "Bags and laundry orders",
    href: "/erp/laundry",
  },
];

/** Phase 3 — POS */
export const POS_TABS: HubTab[] = [
  {
    id: "register",
    label: "Register",
    description: "Sell food and drink",
    href: "/erp/pos",
  },
  {
    id: "bills",
    label: "Tickets",
    description: "Open and closed POS tickets",
    href: "/erp/pos/bills",
  },
  {
    id: "menu",
    label: "Menu",
    description: "Items and prices",
    href: "/erp/menu",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    description: "KOT board",
    href: "/erp/kitchen",
  },
  {
    id: "day-pack",
    label: "Day pack",
    description: "Prep list for the day",
    href: "/erp/kitchen/day-pack",
  },
  {
    id: "kds",
    label: "KDS",
    description: "Kitchen display screens",
    href: "/erp/kds",
  },
  {
    id: "reports",
    label: "Reports",
    description: "POS sales reports",
    href: "/erp/pos/reports",
  },
];

/** Phase 4 — Finance BO */
export const FINANCE_TABS: HubTab[] = [
  {
    id: "home",
    label: "Finance",
    description: "Hotel money home",
    href: "/erp/finance",
  },
  {
    id: "night",
    label: "Night close",
    description: "End the hotel business day",
    href: "/erp/night-audit",
  },
  {
    id: "banking",
    label: "Banking",
    description: "Bank uploads and proof",
    href: "/erp/finance/banking",
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Hotel spend",
    href: "/erp/finance/expenses",
  },
  {
    id: "gst",
    label: "GST",
    description: "Tax returns / GST books",
    href: "/erp/finance/gst",
  },
  {
    id: "rrco",
    label: "RRCO",
    description: "RRCO filing packs for the accountant",
    href: "/erp/finance/rrco",
  },
  {
    id: "statement",
    label: "Statement",
    description: "Hotel books and cash position — not a guest bill",
    href: "/erp/finance/statement",
  },
  {
    id: "vendors",
    label: "Vendors",
    description: "Supplier payables",
    href: "/erp/finance/vendors",
  },
];

/** Phase 5 — HR */
export const HR_TABS: HubTab[] = [
  {
    id: "staff",
    label: "Staff",
    description: "Team directory",
    href: "/erp/hr",
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Clock-in and presence",
    href: "/erp/hr/attendance",
  },
  {
    id: "leave",
    label: "Leave",
    description: "Leave requests",
    href: "/erp/hr/leave",
  },
  {
    id: "rota",
    label: "Rota",
    description: "Shift schedule",
    href: "/erp/hr/rota",
  },
  {
    id: "payroll",
    label: "Payroll",
    description: "Pay runs and slips",
    href: "/erp/hr/payroll",
  },
  {
    id: "recruitment",
    label: "Recruitment",
    description: "Hiring pipeline",
    href: "/erp/hr/recruitment",
  },
];

/** Phase 6 — Agents app */
export const AGENTS_TABS: HubTab[] = [
  {
    id: "stays",
    label: "Stays",
    description: "Your bookings at this hotel",
    href: "/agents/app/stays",
  },
  {
    id: "book",
    label: "Book",
    description: "Hold or confirm rooms",
    href: "/agents/app/book",
  },
  {
    id: "money",
    label: "Money",
    description:
      "Your agent credit and dues to the hotel — not the hotel’s finance statement",
    href: "/agents/app/money",
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "Tax invoices INV-… from the hotel (not PS confirmation)",
    href: "/agents/app/invoices",
  },
  {
    id: "guests",
    label: "Guests",
    description: "Guest names on your stays",
    href: "/agents/app/guests",
  },
];

/** Phase 6 — Staff app */
export const STAFF_TABS: HubTab[] = [
  {
    id: "home",
    label: "Home",
    description: "Your shift home",
    href: "/staff",
  },
  {
    id: "leave",
    label: "Leave",
    description: "Request and track leave",
    href: "/staff/leave",
  },
  {
    id: "payslips",
    label: "Payslips",
    description: "Your pay slips",
    href: "/staff/payslips",
  },
  {
    id: "laundry",
    label: "Laundry",
    description: "Laundry orders you work",
    href: "/staff/laundry",
  },
];

/** Phase 5 — Inventory */
export const INVENTORY_TABS: HubTab[] = [
  {
    id: "items",
    label: "Stock",
    description: "Items on hand",
    href: "/erp/inventory",
  },
  {
    id: "locations",
    label: "Locations",
    description: "Stores and outlets",
    href: "/erp/inventory/locations",
  },
  {
    id: "moves",
    label: "Moves",
    description: "Stock ledger trail",
    href: "/erp/inventory/moves",
  },
  {
    id: "pos",
    label: "POs",
    description: "Purchase orders",
    href: "/erp/inventory/purchase-orders",
  },
  {
    id: "audits",
    label: "Audits",
    description: "Stock counts",
    href: "/erp/inventory/audits",
  },
  {
    id: "assets",
    label: "Assets",
    description: "Fixed assets",
    href: "/erp/inventory/assets",
  },
];
