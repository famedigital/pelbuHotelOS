import type { MealPlanCode } from "@hotel-os/rates";

export type RoomHousekeepingStatus =
  | "clean"
  | "dirty"
  | "inspected"
  | "maintenance";
export type StayStatus =
  | "expected"
  | "confirmed"
  | "in_house"
  | "checked_out"
  | "cancelled"
  | "no_show"
  | "held";
export type EngineSyncState =
  | "synced"
  | "syncing"
  | "offline_buffered"
  | "conflict";

export type SyncOpType =
  | "check_in"
  | "check_out"
  | "shift_room"
  | "post_charge"
  | "record_expense"
  | "record_payment"
  | "housekeeping"
  | "night_audit"
  | "create_reservation"
  | "cancel_reservation"
  | "create_pos_order"
  | "fire_kot"
  | "update_kot"
  | "assign_room";

/** Ops that must never park in Dexie WAL while offline (desk money law). */
export const MONEY_SYNC_OPS: ReadonlySet<SyncOpType> = new Set([
  "post_charge",
  "record_payment",
  "record_expense",
  "night_audit",
  "check_out",
  "create_pos_order",
  "fire_kot",
]);

export function isMoneySyncOp(op: SyncOpType): boolean {
  return MONEY_SYNC_OPS.has(op);
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export class OfflineMoneyError extends Error {
  readonly code = "OFFLINE_MONEY_BLOCKED" as const;
  constructor(opType: SyncOpType) {
    super(
      `Cannot queue ${opType} while offline — money ops require a live server`,
    );
    this.name = "OfflineMoneyError";
  }
}

export interface EngineRoom {
  id: string;
  roomNumber: string;
  floor: number;
  category: string;
  status: RoomHousekeepingStatus;
  occupiedStayId?: string | null;
  assignedGuideBed?: boolean;
}

export interface EngineFolioCharge {
  id: string;
  stayId: string;
  description: string;
  category: "room" | "fnb" | "bar" | "laundry" | "extra" | "tour_voucher";
  quantity: number;
  rateBtn: number;
  serviceChargeBtn: number;
  bstTaxBtn: number;
  totalBtn: number;
  postedAt: string;
  postedByStaffId: string;
  idempotencyKey?: string;
}

export interface EngineStay {
  id: string;
  bookingRef: string;
  guestName: string;
  guestCidPassport?: string;
  guestPhone?: string;
  roomId?: string | null;
  roomNumber?: string;
  status: StayStatus;
  arrivalDate: string;
  departureDate: string;
  mealPlan: MealPlanCode;
  paxAdults: number;
  paxChildren: number;
  agencyName?: string | null;
  agencyId?: string | null;
  voucherNumber?: string | null;
  guideName?: string | null;
  vehiclePlate?: string | null;
  folioCharges: EngineFolioCharge[];
  totalBilledBtn: number;
  totalPaidBtn: number;
  balanceDueBtn: number;
}

export interface EngineExpense {
  id: string;
  category:
    | "veg_dairy"
    | "meat"
    | "grocery"
    | "bar"
    | "gas_lpg"
    | "utilities"
    | "payroll"
    | "repairs"
    | "office";
  description: string;
  amountBtn: number;
  paidVia: "front_till" | "mbob_wire" | "cheque" | "credit_unpaid";
  supplierName?: string;
  recordedByStaffId: string;
  timestamp: string;
  idempotencyKey?: string;
}

export interface EngineCashTill {
  openingBalanceBtn: number;
  collectedCashBtn: number;
  pettyCashOutflowBtn: number;
  activeShiftStaffName: string;
  shiftStartedAt: string;
  shiftId?: string | null;
}

export interface WalLogEntry {
  opId: string;
  opType: SyncOpType;
  payload: Record<string, unknown>;
  timestamp: string;
  idempotencyKey: string;
  status: "pending" | "syncing" | "acked" | "failed";
  lastError?: string;
}

export interface DeskSnapshot {
  propertyId: string;
  propertyName: string;
  rooms: EngineRoom[];
  stays: EngineStay[];
  cashTill: EngineCashTill;
  expenses: EngineExpense[];
  syncedAt: string;
}

export function expectedCashTillBtn(till: EngineCashTill): number {
  return (
    Number(till.openingBalanceBtn) +
    Number(till.collectedCashBtn) -
    Number(till.pettyCashOutflowBtn)
  );
}
