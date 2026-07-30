import type { MenuItem } from "@/lib/menu";
import type {
  DiningTable,
  ModifierGroup,
  OpenPosTicket,
  PosStaffOption,
  PosTenderMethod,
  PosVoidReasonCode,
} from "@/lib/pos";

export type PosBookingOption = {
  id: string;
  contact_name: string | null;
  check_in: string;
  check_out: string;
  status: string;
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
};

/** Wire shape for the hidden `cart` JSON input consumed by `createDeskOrder`. */
export type CartLineInput = {
  menuItemId: string;
  qty: number;
  modifiers?: { groupId: string; optionId: string; qty?: number }[];
  courseNo?: number;
  seatNo?: number;
  lineNotes?: string;
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
    | "room_charge";
  amountBtn: number;
  reference?: string;
  bookingId?: string;
};

export type PosLayoutProps = {
  items: MenuItem[];
  modifierGroups: ModifierGroup[];
  tables: DiningTable[];
  staff: PosStaffOption[];
  openTickets: OpenPosTicket[];
  bookings: PosBookingOption[];
  gstRate: number;
  serviceChargeRate: number;
  serviceChargeDefaultOn: boolean;
  runtimeConfig: PosRuntimeConfig;
  /** Guest-service panel rendered by the server page into the sub-tab. */
  guestServiceSlot?: React.ReactNode;
};

export type OutletCode = "cafe" | "pastry" | "restaurant" | "bar";

export const POS_OUTLETS: { value: OutletCode; label: string }[] = [
  { value: "cafe", label: "Cafe" },
  { value: "pastry", label: "Pastry" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar" },
];

/** Sub-tabs shown inside every outlet. */
export type PosSection = "menu" | "floor" | "service";

/** Outlets that seat guests at tables — floor plan is primary for these. */
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
