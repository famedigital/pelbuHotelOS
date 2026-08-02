import type { DeskRole } from "@/lib/desk-auth";

export type TrainingAudience =
  | "owner"
  | "gm"
  | "front_desk"
  | "hk"
  | "kitchen"
  | "finance";

export type TrainingStep = {
  id: string;
  title: string;
  body: string;
  href?: string;
};

export type TrainingManual = {
  key: string;
  title: string;
  summary: string;
  audiences: TrainingAudience[];
  steps: TrainingStep[];
};

/** Role-filtered in-app manuals — deep links to real desk routes. */
export const TRAINING_MANUALS: TrainingManual[] = [
  {
    key: "owner-go-live",
    title: "Owner go-live checklist",
    summary: "Before first guest: settings, training, then optional data wipe.",
    audiences: ["owner", "gm"],
    steps: [
      {
        id: "identity",
        title: "Verify hotel identity & bank details",
        body: "Legal name, GST ID, bank QR/NEFT details for deposit links.",
        href: "/erp/settings",
      },
      {
        id: "commercial",
        title: "Rates, meals & policies",
        body: "Meal plan Nu amounts, cancel policy, damage catalog.",
        href: "/erp/settings",
      },
      {
        id: "compliance",
        title: "Upload lease & compliance vault",
        body: "Lease agreement refs, deposit slip, handover inventory snapshot.",
        href: "/erp/settings",
      },
      {
        id: "training",
        title: "Complete role manuals below",
        body: "Each department lead reads their manual and ticks steps.",
        href: "/erp/training",
      },
      {
        id: "wipe",
        title: "Danger zone wipe (test data only)",
        body: "After UAT, owner types WIPE to clear bookings/folios/orders — keeps rooms, rates, staff.",
        href: "/erp/settings",
      },
      {
        id: "performance",
        title: "Set season targets",
        body: "Daily/season income & OpEx targets for owner dashboard.",
        href: "/erp/reports/performance",
      },
    ],
  },
  {
    key: "front-desk-daily",
    title: "Front desk daily flow",
    summary: "Arrivals, check-in, folio, departures.",
    audiences: ["owner", "gm", "front_desk"],
    steps: [
      {
        id: "arrivals",
        title: "Review arrivals board",
        body: "Click a row to open the booking dossier.",
        href: "/erp/arrivals",
      },
      {
        id: "checkin",
        title: "Check in with nationality & room",
        body: "Assign physical room, capture SDF/guide/driver as needed.",
        href: "/erp/check-in",
      },
      {
        id: "fastbook",
        title: "Walk-in fast book",
        body: "30-second express book with meal plan default.",
        href: "/erp/fast-book",
      },
      {
        id: "folio",
        title: "Post charges & payments",
        body: "Room, meals, damage, bank proof → pending bank queue.",
        href: "/erp/folios",
      },
      {
        id: "checkout",
        title: "Check out & dirty room",
        body: "Settle folio, release room to housekeeping.",
        href: "/erp/check-out",
      },
      {
        id: "calendar",
        title: "Room rack",
        body: "Drag stays, blocks, and colour-coded HK status.",
        href: "/erp/calendar",
      },
    ],
  },
  {
    key: "housekeeping",
    title: "Housekeeping board",
    summary: "Assign attendants, checklist, lost & found.",
    audiences: ["owner", "gm", "hk"],
    steps: [
      {
        id: "rooms",
        title: "Rooms table / card view",
        body: "Bulk select rooms for status updates.",
        href: "/erp/rooms",
      },
      {
        id: "hk",
        title: "HK board & inline assign",
        body: "Assign attendant, mandatory checklist, stock deduct.",
        href: "/erp/housekeeping",
      },
      {
        id: "service",
        title: "FO service requests",
        body: "Teabag/milk/towel requests from front desk.",
        href: "/erp/rooms",
      },
      {
        id: "lostfound",
        title: "Lost & found",
        body: "Log items, guest contact, disposition.",
        href: "/erp/lost-found",
      },
      {
        id: "laundry",
        title: "Laundry custody",
        body: "Bag QR labels, maid confirm, folio post.",
        href: "/erp/laundry",
      },
    ],
  },
  {
    key: "kitchen-fnb",
    title: "Kitchen & F&B",
    summary: "POS, kitchen board, food cost.",
    audiences: ["owner", "gm", "kitchen"],
    steps: [
      {
        id: "pos",
        title: "POS register",
        body: "Cafe/bar/restaurant tickets → folio or settle.",
        href: "/erp/pos",
      },
      {
        id: "kitchen",
        title: "Kitchen ops board",
        body: "Gas, covers, expiry, events, shift handover.",
        href: "/erp/kitchen",
      },
      {
        id: "foodcost",
        title: "Food cost worksheet",
        body: "COGS % from recipes × covers.",
        href: "/erp/kitchen/food-cost",
      },
      {
        id: "kds",
        title: "Kitchen display (TV)",
        body: "Fullscreen KOT board for pass.",
        href: "/erp/kds",
      },
    ],
  },
  {
    key: "finance-gst",
    title: "Finance & GST",
    summary: "Expenses, bank proofs, BITS pack.",
    audiences: ["owner", "gm", "finance"],
    steps: [
      {
        id: "expenses",
        title: "Record expenses & vendors",
        body: "Vendor TPN, rent category, receipt photos.",
        href: "/erp/finance/expenses",
      },
      {
        id: "bankproofs",
        title: "Confirm bank proofs",
        body: "Guest QR/NEFT screenshot → pending → confirm → receipt.",
        href: "/erp/finance/bank-proofs",
      },
      {
        id: "gst",
        title: "GST BITS A–E pack",
        body: "Monthly portal fields, copy totals, mark filed.",
        href: "/erp/finance/gst",
      },
      {
        id: "nightaudit",
        title: "Night audit",
        body: "Close business date, variance pack, hotel backup.",
        href: "/erp/night-audit",
      },
      {
        id: "reports",
        title: "Finance reports",
        body: "P&L, trial balance, Excel exports.",
        href: "/erp/finance/reports",
      },
    ],
  },
  {
    key: "hr-team",
    title: "HR & rota",
    summary: "Staff records, notices, weekly schedule.",
    audiences: ["owner", "gm"],
    steps: [
      {
        id: "staff",
        title: "Add staff (Form or Sheet)",
        body: "Single form or CSV bulk import.",
        href: "/erp/hr",
      },
      {
        id: "rota",
        title: "Weekly rota",
        body: "Draft shifts, copy last week, publish & alert staff.",
        href: "/erp/hr/rota",
      },
      {
        id: "leave",
        title: "Leave requests",
        body: "Review and approve leave stages.",
        href: "/erp/hr/leave",
      },
      {
        id: "notices",
        title: "Staff bulletin",
        body: "Publish notice — Copy for WhatsApp group (no API).",
        href: "/erp/hr",
      },
    ],
  },
];

const AUDIENCE_FOR_DESK_ROLE: Record<DeskRole, TrainingAudience[]> = {
  owner: ["owner", "gm", "front_desk", "hk", "kitchen", "finance"],
  gm: ["owner", "gm", "front_desk", "hk", "kitchen", "finance"],
  front_desk: ["front_desk"],
  cashier: ["front_desk", "finance"],
  hk: ["hk"],
  fnb: ["kitchen", "front_desk"],
  kitchen: ["kitchen"],
  laundry: ["hk", "front_desk"],
};

export function manualsForDeskRole(role: DeskRole | null): TrainingManual[] {
  const audiences = role ? AUDIENCE_FOR_DESK_ROLE[role] : ["front_desk"];
  return TRAINING_MANUALS.filter((manual) =>
    manual.audiences.some((a) => audiences.includes(a)),
  );
}

export function allTrainingStepIds(manuals: TrainingManual[]): string[] {
  return manuals.flatMap((m) => m.steps.map((s) => `${m.key}:${s.id}`));
}
