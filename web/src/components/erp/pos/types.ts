import type { MenuItem } from "@/lib/menu";
import type {
  DiningTable,
  ModifierGroup,
  OpenPosTicket,
  PosStaffOption,
  PosShift,
  PosShiftCloseSummary,
  PosTenderMethod,
  PosVoidReasonCode,
} from "@/lib/pos";

export type PosBookingOption = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  source: string | null;
  agent_name: string | null;
  rooms: { id: string; label: string }[];
  guests: { id: string | null; full_name: string; phone: string | null }[];
};

/** Legacy alias kept so older imports of `DeskBookingOption` still resolve. */
export type DeskBookingOption = PosBookingOption;

/** A cart line in client state. Mirrors the shape `createDeskOrder` expects. */
export type CartLine = {
  /** Stable key combining menuItemId + modifiers + course/seat so identical lines can stack. */
  key: string;
  menuItemId: string;
  name: string;
  unitPriceBtn: number;
  gstApplicable: boolean;
  qty: number;
  modifiers: { groupId: string; optionId: string; qty: number }[];
  /** Modifier display snapshots (groupId, optionId, name, priceBtn, qty) for totals + UI. */
  modifierSnapshots: {
    groupId: string;
    optionId: string;
    name: string;
    priceBtn: number;
    gstApplicable: boolean;
    qty: number;
  }[];
  courseNo: number;
  seatNo?: number;
  lineNotes?: string;
  /** Non-chargeable — still served; Nu 0 on bill. */
  isNc?: boolean;
  ncReasonCode?: string;
  /** Where the line is prepared — drives "Send to bar" vs kitchen CTA. */
  prepStation?: string;
};

/** Wire shape for the hidden `cart` JSON input consumed by `createDeskOrder`. */
export type CartLineInput = {
  menuItemId: string;
  qty: number;
  modifiers?: { groupId: string; optionId: string; qty?: number }[];
  courseNo?: number;
  seatNo?: number;
  lineNotes?: string;
  isNc?: boolean;
  ncReasonCode?: string;
};

export type TenderDraft = {
  key: string;
  method:
    | "cash"
    | "bank"
    | "card"
    | "agent_credit"
    | "bank_qr"
    | "pay_bt"
    | "deposit"
    | "room_charge"
    | "nc";
  amountBtn: number;
  reference?: string;
  bookingId?: string;
};

export type PosLayoutProps = {
  items: MenuItem[];
  /** Active property outlets for filters and table forms. */
  outlets: { code: string; name: string }[];
  modifierGroups: ModifierGroup[];
  tables: DiningTable[];
  staff: PosStaffOption[];
  openTickets: OpenPosTicket[];
  /** Settled today — Closed today lane in open-tickets drawer. */
  settledTickets?: OpenPosTicket[];
  bookings: PosBookingOption[];
  shift: PosShift | null;
  /** Live tender/open-ticket summary for the open shift close tab. */
  shiftCloseSummary?: PosShiftCloseSummary | null;
  gstRate: number;
  serviceChargeRate: number;
  serviceChargeDefaultOn: boolean;
  runtimeConfig: PosRuntimeConfig;
  /** Guest-service panel rendered by the server page into the sub-tab. */
  guestServiceSlot?: React.ReactNode;
  /** Active NC reason codes for POS. */
  ncReasons?: { code: string; label: string }[];
};

/** Outlet code is property-scoped text (cafe, rooftop, …). */
export type OutletCode = string;

/** @deprecated Prefer outlets loaded from property_outlets. */
export const POS_OUTLETS: { value: OutletCode; label: string }[] = [
  { value: "cafe", label: "Cafe" },
  { value: "pastry", label: "Pastry" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar" },
];

/** Sub-tabs shown inside every outlet. */
export type PosSection = "menu" | "floor" | "stock" | "closing" | "service";

/** Outlets that typically seat guests at tables (legacy pastry is counter-only). */
export const TABLE_SERVICE_OUTLETS: OutletCode[] = ["cafe", "restaurant", "bar"];

/**
 * Server-derived runtime values from @/lib/pos. Imported by the server page
 * (where next/headers is allowed) and passed down to client components, so
 * the client bundle never touches @/lib/pos directly.
 */
export type PosRuntimeConfig = {
  voidReasonCodes: readonly PosVoidReasonCode[];
  tenderMethods: readonly PosTenderMethod[];
  voidManagerThresholdBtn: number;
};
