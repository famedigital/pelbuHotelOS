/**
 * Front-office Zustand board — cache only; ledger authority is API finance.* /
 * reservations.* commands. Money + lifecycle are fail-closed (ACK then cache).
 */
import { create } from "zustand";
import { assertGuestIdDocument } from "@hos-v2/domain";
import { newIdempotencyKey } from "./api";
import { verifyDeskManagerPin } from "./desk-pin";
import {
  apiIdToDeskRoomId,
  commandIdempotencyKey,
  ensureInventoryRemote,
  folioNightIdempotencyKey,
  hydrateFrontOfficeRemote,
  isApiUuid,
  mapApiBookingToStay,
  syncAssignRoomRemote,
  syncBlockRoomRemote,
  syncCancelRemote,
  syncChangeDatesRemote,
  syncCheckInRemote,
  syncCheckoutGateRemote,
  syncCheckOutRemote,
  syncConfirmHoldRemote,
  syncCreateReservationRemote,
  syncEnsureAgencyFolioRemote,
  syncGuestIdentityRemote,
  syncHkStatusRemote,
  syncNightAuditRemote,
  syncPostChargeRemote,
  syncPostPaymentRemote,
  syncReleaseRoomBlockRemote,
  syncRevertCheckInRemote,
  syncUpdateGuestRosterRemote,
  syncUpdateStayNotesRemote,
  syncVoidLineRemote,
} from "./fo-remote";
import { allocateFolioNo, allocateReceiptNo } from "./doc-numbers";
import { propertyTaxBreakdown } from "./property-tax-policy";
import { deskCan } from "./desk-auth";

export type MealPlan = "EP" | "CP" | "MAP" | "AP";
export type BookingStatus =
  | "held"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";
export type HkStatus = "clean" | "dirty" | "inspected" | "ooo" | "occupied";
export type BookingSource = "direct" | "ota" | "agent" | "walk_in";
export type TenderMethod = "cash" | "card" | "rma_qr" | "city_ledger";
export type FolioLineKind =
  | "room"
  | "fb"
  | "laundry"
  | "minibar"
  | "sc"
  | "bst"
  | "payment"
  | "adjustment";

export type FolioStream = "master" | "personal";

/** Rate-sheet codes (Pelbu) + any wizard/tenant type code. */
export type RoomTypeCode =
  | "deluxe_queen"
  | "deluxe_king"
  | "deluxe_twin"
  | "suite"
  | "driver_guide"
  | (string & {});

export type Room = {
  id: string;
  number: string;
  floor: number;
  typeCode: RoomTypeCode;
  typeName: string;
  hkStatus: HkStatus;
};

export type FolioLine = {
  id: string;
  postedAt: string;
  kind: FolioLineKind;
  description: string;
  netAmount: number;
  scAmount: number;
  bstAmount: number;
  totalAmount: number;
  voided: boolean;
  stream: FolioStream;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  message: string;
};

export type DailyStayPlan = {
  date: string;
  nightlyNet: number;
  mealPlan: MealPlan;
  extraBed?: boolean;
};

/** Desk billing intent — tax INV is never auto-issued; desk must create it. */
export type StayBillingMode = "standard" | "complementary" | "no_bill";

/** Sharing guest on the same room (max 3 companions in roster UI). */
export type StayCompanion = {
  name: string;
  passportOrCid?: string;
  nationality?: string;
};

/** Paro coach / desk luggage tag — ops only, not a folio charge. */
export type StayLuggage = {
  count: number;
  color: string;
  description: string;
};

/** True when ID was deferred at party check-in (still needs real CID later). */
export function isDeferredPartyId(passportOrCid: string | null | undefined): boolean {
  const raw = (passportOrCid ?? "").trim();
  return /^PARTY:/i.test(raw) || /^PARTY-PENDING/i.test(raw) || /^pending$/i.test(raw);
}

export type Stay = {
  id: string;
  confirmationNo: string;
  status: BookingStatus;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  nationality: string;
  passportOrCid: string;
  vip: boolean;
  roomId: string | null;
  roomNumber: string | null;
  typeCode: RoomTypeCode;
  checkIn: string;
  checkOut: string;
  mealPlan: MealPlan;
  source: BookingSource;
  nightlyNet: number;
  /** Stable tour-group key — links StayView / StayHub / Groups. */
  groupId: string | null;
  groupName: string | null;
  agencyName: string | null;
  folioLines: FolioLine[];
  audit: AuditEntry[];
  holdExpiresAt: string | null;
  depositPaid: number;
  adults?: number;
  children?: number;
  roomsCount?: number;
  dailyPlans?: DailyStayPlan[];
  /** Extra named guests sharing the room. */
  companions?: StayCompanion[];
  /** Bags recorded at desk / partner rooming. */
  luggage?: StayLuggage;
  /** Kitchen / HK alerts — prefer over guest-name heuristics in print passes. */
  stayFlags?: string[];
  /** Desk / partner operational note shown on StayView ribbon + hover. */
  notes?: string;
  /** Fastify booking id after create sync (memory or Postgres). */
  apiBookingId?: string;
  /** Fastify booking line id — required for stayview.assignRooms. */
  apiBookingLineId?: string;
  /** Guest / agency folio UUIDs when hydrated from API (finance.postCharge). */
  apiFolioId?: string;
  apiAgencyFolioId?: string;
  /** API guest row id — passport/CID upserts. */
  apiGuestId?: string;
  /** Offline create awaiting API ACK — kept across hydrate; seed stays are not. */
  syncPending?: boolean;
  /**
   * Billing intent for fiscal paper.
   * - standard: may issue tax INV / PSBN when desk chooses
   * - complementary: house / FOC — folio OK, no tax invoice
   * - no_bill: operational stay without guest bill — no tax invoice
   */
  billingMode?: StayBillingMode;
  /** Linked gapless fiscal tax doc after desk issues it. */
  taxInvoiceId?: string | null;
  taxInvoiceNo?: string | null;
  taxInvoiceKind?: "PSBN" | "INV" | null;
  taxInvoiceAt?: string | null;
  /** Working folio number · HotelINITIAL + FN + serial (assigned on first folio print). */
  folioNo?: string | null;
};

export function stayBillingMode(stay: Pick<Stay, "billingMode">): StayBillingMode {
  return stay.billingMode ?? "standard";
}

export function canIssueTaxInvoice(
  stay: Stay,
): { ok: true } | { ok: false; error: string } {
  const mode = stayBillingMode(stay);
  if (mode === "complementary") {
    return { ok: false, error: "Complementary stay — tax invoice not allowed" };
  }
  if (mode === "no_bill") {
    return { ok: false, error: "No-bill stay — tax invoice not allowed" };
  }
  if (stay.taxInvoiceId && stay.taxInvoiceNo) {
    return { ok: false, error: `Tax invoice already issued · ${stay.taxInvoiceNo}` };
  }
  if (["cancelled", "no_show"].includes(stay.status)) {
    return { ok: false, error: "Cannot invoice a cancelled / no-show stay" };
  }
  return { ok: true };
}

export const BILLING_MODE_LABEL: Record<StayBillingMode, string> = {
  standard: "Billable",
  complementary: "Complementary",
  no_bill: "No bill",
};

/** One physical room in a Fast Book party — type may differ per line. */
export type FastBookRoomLine = {
  typeCode: RoomTypeCode;
  roomId?: string | null;
};

type FastBookInput = {
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  /** Lead / default type when `roomLines` omitted. */
  typeCode: RoomTypeCode;
  checkIn: string;
  checkOut: string;
  mealPlan: MealPlan;
  source: BookingSource;
  asHold?: boolean;
  depositAmount?: number;
  roomId?: string | null;
  nationality?: string;
  passportOrCid?: string;
  groupId?: string | null;
  groupName?: string | null;
  agencyName?: string | null;
  vip?: boolean;
  roomsCount?: number;
  /** Mixed-type party — one entry per room. Overrides flat roomsCount×typeCode. */
  roomLines?: FastBookRoomLine[];
  /**
   * When set (≥ 0), stamp this EP room net on every peer despite typeCode.
   * Meal plan stays separate (MAP/CP/… via mealPlan).
   */
  uniformNightlyNet?: number | null;
  adults?: number;
  children?: number;
  extraBed?: boolean;
};

type MoveRoomInput = {
  stayId: string;
  toRoomId: string;
  reason: "maintenance" | "upgrade" | "guest_request" | "operations";
  actor?: string;
};

type ExtendStayInput = {
  stayId: string;
  newCheckOut: string;
  actor?: string;
};

type AssignRoomOpts = {
  /** Manager PIN — required when target room is dirty. */
  dirtyOverridePin?: string;
  /** Cross-type assign that keeps commercial nightly rate. */
  allowUpgrade?: boolean;
  /** Server audit reason when mode is move. */
  moveReason?: MoveRoomInput["reason"];
};

export type RoomBlock = {
  id: string;
  roomId: string;
  blockKind: "ooo" | "oos" | "hold";
  fromDate: string;
  toDate: string;
  reason: string;
};

type SettleInput = {
  stayId: string;
  method: TenderMethod;
  amount: number;
  actor?: string;
  pinConfirmed?: boolean;
};

type UiState = {
  selectedStayId: string | null;
  /**
   * Epoch ms — StayHub ignores Vaul onOpenChange(false) until this time.
   * Needed because Fast Book Radix/Vaul focus-restore fires a dismiss right after
   * Create → Open Stay (fastBookOpen is already false by then).
   */
  stayHubDismissGuardUntil: number;
  fastBookOpen: boolean;
  fastBookPrefill: Partial<FastBookInput> | null;
  moveModal: { stayId: string; toRoomId: string } | null;
  horizonDays: 7 | 14 | 30;
  rackAnchorDate: string;
};

export type GroupBillingRule = "agency_room_meals" | "guest_all";

/** Party commercial rate: per typeCode card vs one EP net for all rooms. */
export type GroupRateMode = "by_category" | "uniform";

export type GroupMeta = {
  id: string;
  code: string;
  name: string;
  agencyName: string;
  agencyContact: string;
  guideName: string;
  guideLicense: string;
  guidePhone: string;
  driverName: string;
  vehicleNo: string;
  driverDormBed: string;
  mealPlan: MealPlan;
  depositPaid: number;
  billingRule: GroupBillingRule;
  /** StayView / rack tint */
  color: string;
  /** Default by_category when omitted (legacy seed). */
  rateMode?: GroupRateMode;
  /** EP room net when rateMode === "uniform" — applied despite typeCode. */
  uniformNightlyNet?: number | null;
};

export type TourGroupSummary = GroupMeta & {
  members: Stay[];
  checkIn: string;
  checkOut: string;
  nights: number;
  status: "in_house" | "confirmed" | "quote" | "departed";
  totalPax: number;
  roomsBooked: number;
  roomsAssigned: number;
  masterBalance: number;
  personalBalance: number;
  masterFolioCharges: number;
};

type FrontOfficeState = UiState & {
  businessDate: string;
  rooms: Room[];
  stays: Stay[];
  /** Logistics + billing defaults keyed by groupId (desk Zustand; Postgres later). */
  groupMeta: Record<string, GroupMeta>;
  /** Bumped on FO mutations — drives live badges / deferred UI without deep compares. */
  liveRevision: number;
  bumpLiveRevision: () => void;
  /** Pull desk/day + reservations from API; merge by apiBookingId. */
  hydrateFromApi: () => Promise<{ ok: true; merged: number } | { ok: false; error: string }>;
  /** Close business date via API night_audit.run then advance local date. */
  runNightAuditRemote: () => Promise<
    | { ok: true; nextDate: string; postedNights: number; noShows: number }
    | { ok: false; error: string }
  >;
  openStay: (id: string | null) => void;
  setHorizonDays: (days: 7 | 14 | 30) => void;
  setRackAnchorDate: (ymd: string) => void;
  openFastBook: (prefill?: Partial<FastBookInput> | null) => void;
  closeFastBook: () => void;
  createBooking: (
    input: FastBookInput,
  ) => Promise<
    | {
        ok: true;
        stay: Stay;
        stays: Stay[];
        groupId: string | null;
        assignWarning?: string;
      }
    | { ok: false; error: string }
  >;
  /** True when last hydrate failed — money mutations that need API are blocked. */
  apiOffline: boolean;
  setStayNotes: (
    stayId: string,
    notes: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Capture passport / CID before check-in (FIT document scan gate). */
  updateGuestIdentity: (
    stayId: string,
    input: { passportOrCid: string; nationality?: string },
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Soft roster / luggage save — CID validated only when a real document is provided. */
  updateStayGuestRoster: (
    stayId: string,
    input: {
      guestName?: string;
      passportOrCid?: string;
      nationality?: string;
      companions?: StayCompanion[];
      luggage?: StayLuggage | null;
    },
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  setBillingMode: (
    stayId: string,
    mode: StayBillingMode,
    actor?: string,
  ) => { ok: true } | { ok: false; error: string };
  /** Links a gapless fiscal tax doc after desk explicitly creates it. */
  attachTaxInvoice: (
    stayId: string,
    doc: {
      id: string;
      docNo: string;
      kind: "PSBN" | "INV";
      at: string;
    },
    actor?: string,
  ) => { ok: true } | { ok: false; error: string };
  /** Assign gapless FN once (HotelINITIAL + FN + serial). Idempotent if already set. */
  ensureFolioNo: (
    stayId: string,
    actor?: string,
  ) => { ok: true; folioNo: string } | { ok: false; error: string };
  roomBlocks: RoomBlock[];
  assignRoom: (
    stayId: string,
    roomId: string,
    actor?: string,
    opts?: AssignRoomOpts,
  ) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  upgradeRoom: (
    stayId: string,
    roomId: string,
    actor?: string,
    opts?: { dirtyOverridePin?: string },
  ) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  moveRoom: (
    input: MoveRoomInput & { dirtyOverridePin?: string },
  ) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  extendStay: (
    input: ExtendStayInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  shortenStay: (
    input: ExtendStayInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  ensureStaySynced: (
    stayId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  blockRoom: (input: {
    roomId: string;
    fromDate: string;
    toDate: string;
    blockKind?: "ooo" | "oos" | "hold";
    reason: string;
  }) => Promise<{ ok: true; block: RoomBlock } | { ok: false; error: string }>;
  releaseRoomBlock: (
    blockId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  checkIn: (
    stayId: string,
    actor?: string,
    opts?: { dirtyOverridePin?: string },
  ) => Promise<
    | { ok: true }
    | { ok: false; error: string; code?: "DIRTY_PIN_REQUIRED" }
  >;
  /**
   * Post missing room+meal package to agency/guest folio (CI repair + hydrate gaps).
   * Idempotent by description on the API folio.
   */
  ensurePackageChargesPosted: (
    stayId: string,
    actor?: string,
  ) => Promise<{ ok: true; posted: number } | { ok: false; error: string }>;
  /** Undo check-in: void CI package lines then restore confirmed via API. */
  revertCheckIn: (
    stayId: string,
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  checkOut: (
    stayId: string,
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  cancelStay: (
    stayId: string,
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Cancel every held/confirmed peer in a tour group (skips in-house / departed). */
  cancelGroup: (
    groupId: string,
    actor?: string,
  ) => Promise<
    | { ok: true; cancelled: number; blocked: string[] }
    | { ok: false; error: string }
  >;
  confirmHold: (
    stayId: string,
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  settleFolio: (
    input: SettleInput & { stream?: FolioStream },
  ) => Promise<{ ok: true; receiptNo: string } | { ok: false; error: string }>;
  postCharge: (
    stayId: string,
    description: string,
    netAmount: number,
    kind: FolioLineKind,
    actor?: string,
    stream?: FolioStream,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  voidFolioLine: (
    stayId: string,
    lineId: string,
    pinConfirmed: boolean,
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateStayRate: (
    stayId: string,
    patch: { mealPlan?: MealPlan; nightlyNet?: number; dailyPlans?: DailyStayPlan[] },
    actor?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  upsertGroupMeta: (meta: GroupMeta) => void;
  applyGroupMealPlan: (
    groupId: string,
    mealPlan: MealPlan,
    actor?: string,
  ) => Promise<{ ok: true; updated: number } | { ok: false; error: string }>;
  applyGroupNightlyNet: (
    groupId: string,
    nightlyNet: number,
    actor?: string,
  ) => Promise<{ ok: true; updated: number } | { ok: false; error: string }>;
  applyGroupDailyPlans: (
    groupId: string,
    dailyPlans: DailyStayPlan[],
    actor?: string,
  ) => Promise<{ ok: true; updated: number } | { ok: false; error: string }>;
  checkInGroup: (
    groupId: string,
    actor?: string,
    opts?: { leadStayId?: string; dirtyOverridePin?: string },
  ) => Promise<
    | { ok: true; checkedIn: number; blocked: string[] }
    | {
        ok: false;
        error: string;
        code?: string;
        dirtyRooms?: string[];
      }
  >;
  /** Settle agency/master balances across all group peers. */
  settleGroupMaster: (
    groupId: string,
    input: {
      method: TenderMethod;
      actor?: string;
      pinConfirmed?: boolean;
    },
  ) => Promise<
    | { ok: true; settled: number; totalAmount: number; blocked: string[] }
    | { ok: false; error: string }
  >;
  /**
   * After GST is turned OFF: API-void charge lines that still carry BST/GST and
   * re-post the same net under current tax policy (SC only). Payments untouched.
   */
  stripGstFromOpenBills: (
    actor?: string,
  ) => Promise<
    | { ok: true; stays: number; linesReposted: number }
    | { ok: false; error: string }
  >;
  setMoveModal: (v: UiState["moveModal"]) => void;
  /** First-time commissioning — rebuild FO room inventory from wizard room types. */
  commissionInventory: (input: {
    floors: number;
    roomTypes: Array<{
      code: string;
      name: string;
      count: number;
      nightlyNet: number;
    }>;
  }) => { ok: true; roomCount: number } | { ok: false; error: string };
  setRoomHkStatus: (
    roomId: string,
    hkStatus: HkStatus,
    actor?: string,
  ) => { ok: true } | { ok: false; error: string };
  advanceBusinessDate: (toDate: string) => void;
  /** Tetris auto-assign — group cluster, VIP floor 3, orphan-gap avoidance */
  smartAutoAssign: (
    stayIds?: string[],
  ) => Promise<{ assigned: number; conflicts: string[] }>;
};

const ACTOR_DEFAULT = "Karma Dorji (FD-1)";

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(ymdStr: string, days: number): string {
  const d = new Date(`${ymdStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`).getTime();
  const b = new Date(`${checkOut}T12:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Calendar month helpers for StayView jump + monthly KPIs. */
export function parseYearMonth(ymdStr: string): { year: number; month: number } {
  const [y, m] = ymdStr.split("-").map((p) => Number(p));
  return { year: y || 1970, month: m || 1 };
}

export function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function daysInCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

export type MonthStayviewStats = {
  year: number;
  month: number;
  label: string;
  start: string;
  endExclusive: string;
  daysInMonth: number;
  totalRooms: number;
  roomNightsAvailable: number;
  roomNightsSold: number;
  occPct: number;
  /** Projected room + meal net for nights overlapping the month (pre-tax). */
  projectedRevenue: number;
  bookings: number;
};

/**
 * Monthly rack KPIs for the viewed calendar month.
 * Occ = booked room-nights / (inventory rooms × days). Over 100% = overbooking signal.
 * Revenue = nightlyNet + meal plan net × overlapping nights (forward-looking for future months).
 */
export function computeMonthStayviewStats(
  rooms: Room[],
  stays: Stay[],
  year: number,
  month: number,
): MonthStayviewStats {
  const start = firstOfMonth(year, month);
  const dim = daysInCalendarMonth(year, month);
  const endExclusive = addDays(start, dim);
  const totalRooms = rooms.length;
  const roomNightsAvailable = totalRooms * dim;
  let roomNightsSold = 0;
  let projectedRevenue = 0;
  let bookings = 0;

  for (const stay of stays) {
    if (["cancelled", "no_show"].includes(stay.status)) continue;
    const overlapStart = stay.checkIn > start ? stay.checkIn : start;
    const overlapEnd = stay.checkOut < endExclusive ? stay.checkOut : endExclusive;
    if (overlapStart >= overlapEnd) continue;
    const nights = nightsBetween(overlapStart, overlapEnd);
    if (nights <= 0) continue;
    bookings += 1;
    roomNightsSold += nights;
    const meal = mealPlanNightlyNet(stay.mealPlan);
    projectedRevenue += nights * (stay.nightlyNet + meal);
  }

  const occPct =
    roomNightsAvailable > 0
      ? Math.round((roomNightsSold / roomNightsAvailable) * 100)
      : 0;

  return {
    year,
    month,
    label: monthLabel(year, month),
    start,
    endExclusive,
    daysInMonth: dim,
    totalRooms,
    roomNightsAvailable,
    roomNightsSold,
    occPct,
    projectedRevenue: Math.round(projectedRevenue),
    bookings,
  };
}

export function datesBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  let cur = checkIn;
  while (cur < checkOut) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function taxBreakdown(net: number): {
  netAmount: number;
  scAmount: number;
  bstAmount: number;
  totalAmount: number;
} {
  return propertyTaxBreakdown(net);
}

export function folioBalance(stay: Stay, stream?: FolioStream): number {
  return stay.folioLines
    .filter((l) => !l.voided && (stream == null || l.stream === stream))
    .reduce((sum, l) => sum + l.totalAmount, 0);
}

export function folioTotals(stay: Stay, stream?: FolioStream) {
  const open = stay.folioLines.filter(
    (l) => !l.voided && (stream == null || l.stream === stream),
  );
  const charges = open.filter((l) => l.kind !== "payment");
  const payments = open.filter((l) => l.kind === "payment");
  return {
    net: charges.reduce((s, l) => s + l.netAmount, 0),
    sc: charges.reduce((s, l) => s + l.scAmount, 0),
    bst: charges.reduce((s, l) => s + l.bstAmount, 0),
    charged: charges.reduce((s, l) => s + l.totalAmount, 0),
    paid: Math.abs(payments.reduce((s, l) => s + l.totalAmount, 0)),
    balance: folioBalance(stay, stream),
  };
}

export function defaultStreamForKind(kind: FolioLineKind): FolioStream {
  return kind === "room" ? "master" : "personal";
}

const ROOM_SEED: Room[] = [
  { id: "rm-101", number: "101", floor: 1, typeCode: "DLX-K", typeName: "Deluxe King", hkStatus: "occupied" },
  { id: "rm-102", number: "102", floor: 1, typeCode: "DLX-T", typeName: "Deluxe Twin", hkStatus: "occupied" },
  { id: "rm-103", number: "103", floor: 1, typeCode: "DLX-K", typeName: "Deluxe King", hkStatus: "occupied" },
  { id: "rm-104", number: "104", floor: 1, typeCode: "DLX-T", typeName: "Deluxe Twin", hkStatus: "occupied" },
  { id: "rm-105", number: "105", floor: 1, typeCode: "DLX-K", typeName: "Deluxe King", hkStatus: "occupied" },
  { id: "rm-106", number: "106", floor: 1, typeCode: "DLX-T", typeName: "Deluxe Twin", hkStatus: "clean" },
  { id: "rm-107", number: "107", floor: 1, typeCode: "DLX-K", typeName: "Deluxe King", hkStatus: "dirty" },
  { id: "rm-108", number: "108", floor: 1, typeCode: "DLX-T", typeName: "Deluxe Twin", hkStatus: "inspected" },
  { id: "rm-201", number: "201", floor: 2, typeCode: "VAL-K", typeName: "Valley View King", hkStatus: "occupied" },
  { id: "rm-202", number: "202", floor: 2, typeCode: "DLX-T", typeName: "Deluxe Twin", hkStatus: "occupied" },
  { id: "rm-203", number: "203", floor: 2, typeCode: "VAL-T", typeName: "Valley View Twin", hkStatus: "clean" },
  { id: "rm-204", number: "204", floor: 2, typeCode: "VAL-T", typeName: "Valley View Twin", hkStatus: "clean" },
  { id: "rm-205", number: "205", floor: 2, typeCode: "VAL-K", typeName: "Valley View King", hkStatus: "inspected" },
  { id: "rm-206", number: "206", floor: 2, typeCode: "VAL-T", typeName: "Valley View Twin", hkStatus: "dirty" },
  { id: "rm-207", number: "207", floor: 2, typeCode: "VAL-K", typeName: "Valley View King", hkStatus: "ooo" },
  { id: "rm-208", number: "208", floor: 2, typeCode: "VAL-T", typeName: "Valley View Twin", hkStatus: "clean" },
  { id: "rm-301", number: "301", floor: 3, typeCode: "EXE-K", typeName: "Executive King", hkStatus: "clean" },
  { id: "rm-302", number: "302", floor: 3, typeCode: "EXE-K", typeName: "Executive King", hkStatus: "inspected" },
  { id: "rm-303", number: "303", floor: 3, typeCode: "EXE-T", typeName: "Executive Twin", hkStatus: "clean" },
  { id: "rm-304", number: "304", floor: 3, typeCode: "EXE-T", typeName: "Executive Twin", hkStatus: "dirty" },
  { id: "rm-305", number: "305", floor: 3, typeCode: "EXE-K", typeName: "Executive King", hkStatus: "clean" },
  { id: "rm-306", number: "306", floor: 3, typeCode: "EXE-K", typeName: "Executive King", hkStatus: "clean" },
  { id: "rm-307", number: "307", floor: 3, typeCode: "EXE-T", typeName: "Executive Twin", hkStatus: "inspected" },
  { id: "rm-308", number: "308", floor: 3, typeCode: "EXE-K", typeName: "Executive Suite", hkStatus: "clean" },
];

function nowIso(): string {
  return new Date().toISOString();
}

function audit(message: string, actor = ACTOR_DEFAULT): AuditEntry {
  return {
    id: crypto.randomUUID(),
    at: nowIso(),
    actor,
    message,
  };
}

function chargeLine(
  description: string,
  net: number,
  kind: FolioLineKind,
  stream: FolioStream = defaultStreamForKind(kind),
): FolioLine {
  const tax = taxBreakdown(net);
  return {
    id: crypto.randomUUID(),
    postedAt: nowIso(),
    kind,
    description,
    ...tax,
    voided: false,
    stream,
  };
}

function paymentLine(
  description: string,
  amount: number,
  stream: FolioStream = "personal",
): FolioLine {
  return {
    id: crypto.randomUUID(),
    postedAt: nowIso(),
    kind: "payment",
    description,
    netAmount: -amount,
    scAmount: 0,
    bstAmount: 0,
    totalAmount: -amount,
    voided: false,
    stream,
  };
}

/** Desk meal package net per night — keep in sync with StayHub matrix. */
export function mealPlanNightlyNet(plan: MealPlan): number {
  if (plan === "CP") return 450;
  if (plan === "MAP") return 950;
  if (plan === "AP") return 1450;
  return 0;
}

export const EXTRA_BED_NIGHTLY_NET = 1500;

function isMealPlanFolioLine(l: FolioLine): boolean {
  return l.kind === "fb" && /meal plan/i.test(l.description);
}

function isRoomNightFolioLine(l: FolioLine): boolean {
  return l.kind === "room" && /^Room ·/i.test(l.description);
}

function isExtraBedFolioLine(l: FolioLine): boolean {
  return /extra bed/i.test(l.description);
}

function roomTypeNameForStay(staysRooms: Room[], stay: Stay): string {
  const room = stay.roomId
    ? staysRooms.find((r) => r.id === stay.roomId)
    : undefined;
  if (room) return room.typeName;
  return (
    ROOM_TYPE_OPTIONS.find((t) => t.code === stay.typeCode)?.name ?? stay.typeCode
  );
}

/** Agency/tour room+meal → master; FIT walk-in/direct → personal guest folio. */
function packageStreamForStay(
  stay: Pick<Stay, "groupId" | "source">,
): FolioStream {
  return stay.groupId || stay.source === "agent" ? "master" : "personal";
}

function dateFromPackageDesc(desc: string): string | null {
  const m = desc.match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function isPackageFolioLine(l: FolioLine): boolean {
  return (
    !l.voided &&
    (isMealPlanFolioLine(l) || isRoomNightFolioLine(l) || isExtraBedFolioLine(l))
  );
}

/** Build room + meal (+ extra bed) folio lines from stay / daily plans. */
export function buildStayPackageFolioLines(
  stay: Pick<
    Stay,
    | "checkIn"
    | "checkOut"
    | "mealPlan"
    | "nightlyNet"
    | "dailyPlans"
    | "typeCode"
    | "roomId"
    | "groupId"
    | "source"
  >,
  typeName: string,
  plans?: DailyStayPlan[],
): FolioLine[] {
  const stream = packageStreamForStay(stay);
  const dates = datesBetween(stay.checkIn, stay.checkOut);
  const schedule =
    plans ??
    stay.dailyPlans ??
    dates.map((date) => ({
      date,
      nightlyNet: stay.nightlyNet,
      mealPlan: stay.mealPlan,
      extraBed: false,
    }));
  const byDate = new Map(schedule.map((p) => [p.date, p]));
  const lines: FolioLine[] = [];
  for (const d of dates) {
    const plan = byDate.get(d);
    const nightly = plan?.nightlyNet ?? stay.nightlyNet;
    const meal = plan?.mealPlan ?? stay.mealPlan;
    const mealNet = mealPlanNightlyNet(meal);
    lines.push(chargeLine(`Room · ${typeName} · ${d}`, nightly, "room", stream));
    if (mealNet > 0) {
      lines.push(
        chargeLine(`${meal} meal plan · ${d}`, mealNet, "fb", stream),
      );
    }
    if (plan?.extraBed) {
      lines.push(
        chargeLine(`Extra bed · ${d}`, EXTRA_BED_NIGHTLY_NET, "room", stream),
      );
    }
  }
  return lines;
}

/** Void package lines and append rebuilt room/meal/extra-bed charges (append-only). */
function syncPackageFolio(
  stay: Stay,
  rooms: Room[],
  patch: {
    mealPlan?: MealPlan;
    nightlyNet?: number;
    dailyPlans?: DailyStayPlan[];
  },
  actor: string,
): Stay {
  const nextMeal = patch.mealPlan ?? stay.mealPlan;
  const nextNet = patch.nightlyNet ?? stay.nightlyNet;
  const nextPlans =
    patch.dailyPlans ??
    (stay.dailyPlans
      ? stay.dailyPlans.map((d) => ({
          ...d,
          mealPlan: patch.mealPlan ?? d.mealPlan,
          nightlyNet: patch.nightlyNet ?? d.nightlyNet,
        }))
      : undefined);
  const typeName = roomTypeNameForStay(rooms, stay);
  const rebuilt = buildStayPackageFolioLines(
    {
      ...stay,
      mealPlan: nextMeal,
      nightlyNet: nextNet,
      dailyPlans: nextPlans,
    },
    typeName,
    nextPlans,
  );
  const folioLines = [
    ...stay.folioLines.map((l) =>
      !l.voided &&
      (isMealPlanFolioLine(l) || isRoomNightFolioLine(l) || isExtraBedFolioLine(l))
        ? { ...l, voided: true }
        : l,
    ),
    ...rebuilt,
  ];
  return {
    ...stay,
    mealPlan: nextMeal,
    nightlyNet: nextNet,
    dailyPlans: nextPlans,
    folioLines,
    audit: [
      audit(
        patch.dailyPlans
          ? `Daily package → folio (${rebuilt.length} lines · ${nextMeal})`
          : `Rate/meal → folio · ${nextMeal} · ${formatNu(nextNet)}/night`,
        actor,
      ),
      ...stay.audit,
    ],
  };
}

const TODAY = ymd(new Date());

function seedStays(): Stay[] {
  const yangphelRooms = [
    { room: "rm-101", guest: "Jean-Pierre Dubois", cid: "FR-8829104", nat: "French", balFb: 1250, flags: [] as string[] },
    { room: "rm-102", guest: "Marcus Weber", cid: "DE-7719230", nat: "German", balFb: 3400, flags: ["diet_no_pork"] as string[] },
    { room: "rm-103", guest: "Sophie Laurent", cid: "FR-9938217", nat: "French", balFb: 800, flags: ["diet_veg_strict"] as string[] },
    { room: "rm-104", guest: "Lucas Meyer", cid: "CH-1928374", nat: "Swiss", balFb: 0, flags: [] as string[] },
    { room: "rm-105", guest: "Thomas Becker", cid: "DE-6629104", nat: "German", balFb: 2100, flags: [] as string[] },
    { room: "rm-201", guest: "Dr. Henri Martin", cid: "FR-5510294", nat: "French", balFb: 4600, flags: ["diet_gluten_free"] as string[] },
    { room: "rm-202", guest: "Felix Schneider", cid: "DE-4401928", nat: "German", balFb: 950, flags: [] as string[] },
  ] as const;

  const inHouse: Stay[] = yangphelRooms.map((row, i) => {
    const room = ROOM_SEED.find((r) => r.id === row.room)!;
    const checkIn = addDays(TODAY, -1);
    const checkOut = addDays(TODAY, 3);
    const nightlyNet = room.typeCode.startsWith("VAL") ? 8500 : 6500;
    const lines = [
      ...buildStayPackageFolioLines(
        {
          checkIn,
          checkOut,
          mealPlan: "MAP",
          nightlyNet,
          typeCode: room.typeCode,
          roomId: room.id,
          groupId: "grp-yangphel",
          source: "agent",
        },
        room.typeName,
      ),
      ...(row.balFb > 0
        ? [chargeLine("Restaurant · Dinner", Math.round(row.balFb / 1.21), "fb", "personal")]
        : []),
      paymentLine("Deposit · Agent voucher", 8000, "master"),
    ];
    return {
      id: `stay-ih-${i + 1}`,
      confirmationNo: `PS-2026-${1100 + i}`,
      status: "checked_in" as const,
      guestName: row.guest,
      guestPhone: "+975-17" + String(610000 + i),
      guestEmail: `${row.guest.split(" ")[0]!.toLowerCase()}@guest.mail`,
      nationality: row.nat,
      passportOrCid: row.cid,
      vip: i === 5,
      roomId: room.id,
      roomNumber: room.number,
      typeCode: room.typeCode,
      checkIn,
      checkOut,
      mealPlan: "MAP" as const,
      source: "agent" as const,
      nightlyNet,
      groupId: "grp-001",
      groupName: "Yangphel Autumn Cultural Explorer",
      agencyName: "Yangphel Adventure Travel",
      folioLines: lines,
      audit: [
        audit(`Checked in to ${room.number}`, "Pema Choden (FD-2)"),
        audit("Room assigned from group rooming list", "Pema Choden (FD-2)"),
      ],
      holdExpiresAt: null,
      depositPaid: 8000,
      billingMode: "standard",
      stayFlags: row.flags.length ? [...row.flags] : undefined,
      notes:
        i === 0
          ? "Late arrival · driver waiting Paro airport"
          : i === 1
            ? "No pork/beef · early breakfast for trek"
            : undefined,
    };
  });

  const arrivals: Stay[] = [
    {
      id: "stay-arr-1",
      confirmationNo: "PS-2026-1201",
      status: "confirmed",
      guestName: "Christopher Lee",
      guestPhone: "+65-9123-8841",
      guestEmail: "chris.lee@drukasia.com",
      nationality: "Singaporean",
      passportOrCid: "SG-E882910A",
      vip: false,
      roomId: "rm-203",
      roomNumber: "203",
      typeCode: "VAL-T",
      checkIn: TODAY,
      checkOut: addDays(TODAY, 5),
      mealPlan: "AP",
      source: "agent",
      nightlyNet: 9200,
      groupId: "grp-002",
      groupName: "Druk Asia Photography Expedition",
      agencyName: "Druk Asia Tours & Treks",
      folioLines: [
        paymentLine("Advance deposit · MoU", 15000, "master"),
      ],
      audit: [audit("Reservation confirmed via agent MoU")],
      holdExpiresAt: null,
      depositPaid: 15000,
    },
    {
      id: "stay-arr-2",
      confirmationNo: "PS-2026-1202",
      status: "confirmed",
      guestName: "Rachel Tan",
      guestPhone: "+65-9881-2201",
      guestEmail: "rachel.tan@drukasia.com",
      nationality: "Singaporean",
      passportOrCid: "SG-E773918B",
      vip: true,
      roomId: null,
      roomNumber: null,
      typeCode: "VAL-T",
      checkIn: TODAY,
      checkOut: addDays(TODAY, 5),
      mealPlan: "AP",
      source: "agent",
      nightlyNet: 0,
      groupId: "grp-002",
      groupName: "Druk Asia Photography Expedition",
      agencyName: "Druk Asia Tours & Treks",
      folioLines: [],
      audit: [
        audit("Unassigned arrival — needs room before check-in"),
        audit("Billing mode → Complementary (FOC media guest)"),
      ],
      holdExpiresAt: null,
      depositPaid: 0,
      billingMode: "complementary",
      stayFlags: ["diet_jain"],
      notes: "FOC complementary — do not issue tax invoice",
    },
    {
      id: "stay-arr-3",
      confirmationNo: "PS-2026-1208",
      status: "held",
      guestName: "Walk-in Pending",
      guestPhone: "+975-17665544",
      guestEmail: "",
      nationality: "Bhutanese",
      passportOrCid: "CID-11502001999",
      vip: false,
      roomId: null,
      roomNumber: null,
      typeCode: "DLX-K",
      checkIn: TODAY,
      checkOut: addDays(TODAY, 1),
      mealPlan: "CP",
      source: "walk_in",
      nightlyNet: 5500,
      groupId: null,
      groupName: null,
      agencyName: null,
      folioLines: [],
      audit: [audit("Hold created — expires 18:00 if unpaid")],
      holdExpiresAt: `${TODAY}T18:00:00`,
      depositPaid: 0,
    },
  ];

  const future: Stay[] = [
    {
      id: "stay-fut-1",
      confirmationNo: "PS-2026-1301",
      status: "confirmed",
      guestName: "Prof. Ananya Sen",
      guestPhone: "+91-98111-22001",
      guestEmail: "asen@rtc.bt",
      nationality: "Indian",
      passportOrCid: "IN-Z9928104",
      vip: false,
      roomId: "rm-301",
      roomNumber: "301",
      typeCode: "EXE-K",
      checkIn: addDays(TODAY, 3),
      checkOut: addDays(TODAY, 5),
      mealPlan: "CP",
      source: "direct",
      nightlyNet: 11000,
      groupId: "grp-003",
      groupName: "Royal Thimphu College Visiting Faculty",
      agencyName: "Royal Thimphu College (Direct MoA)",
      folioLines: [],
      audit: [audit("Block reserved for RTC faculty")],
      holdExpiresAt: null,
      depositPaid: 0,
    },
    {
      id: "stay-fut-2",
      confirmationNo: "PS-2026-1188",
      status: "checked_out",
      guestName: "Elena Rossi",
      guestPhone: "+39-340-112233",
      guestEmail: "elena.rossi@mail.it",
      nationality: "Italian",
      passportOrCid: "IT-YA88291",
      vip: false,
      roomId: null,
      roomNumber: "108",
      typeCode: "DLX-T",
      checkIn: addDays(TODAY, -4),
      checkOut: addDays(TODAY, -1),
      mealPlan: "MAP",
      source: "ota",
      nightlyNet: 6200,
      groupId: null,
      groupName: null,
      agencyName: null,
      folioLines: [
        ...buildStayPackageFolioLines(
          {
            checkIn: addDays(TODAY, -4),
            checkOut: addDays(TODAY, -1),
            mealPlan: "MAP",
            nightlyNet: 6200,
            typeCode: "DLX-T",
            roomId: null,
            groupId: null,
            source: "ota",
          },
          "Deluxe Twin",
        ),
        paymentLine("Card settlement · VISA", 22506, "master"),
      ],
      audit: [
        audit("Checked out — folio settled", "Karma Dorji (FD-1)"),
      ],
      holdExpiresAt: null,
      depositPaid: 0,
    },
  ];

  return [...inHouse, ...arrivals, ...future];
}

function roomOccupiedOn(
  stays: Stay[],
  roomId: string,
  date: string,
  excludeStayId?: string,
): Stay | undefined {
  return stays.find((s) => {
    if (excludeStayId && s.id === excludeStayId) return false;
    if (s.roomId !== roomId) return false;
    if (["cancelled", "no_show", "checked_out"].includes(s.status)) return false;
    return s.checkIn <= date && date < s.checkOut;
  });
}

function roomFreeForStay(
  stays: Stay[],
  room: Room,
  stay: Stay,
): boolean {
  if (room.hkStatus === "ooo") return false;
  if (room.typeCode !== stay.typeCode) return false;
  for (const d of datesBetween(stay.checkIn, stay.checkOut)) {
    if (roomOccupiedOn(stays, room.id, d, stay.id)) return false;
  }
  return true;
}

/** Count 1-night orphan free gaps on a room after hypothetically placing `stay`. */
function orphanGapPenalty(
  stays: Stay[],
  roomId: string,
  stay: Stay,
  windowStart: string,
  windowEnd: string,
): number {
  const occupied = new Set<string>();
  for (const s of stays) {
    if (s.id === stay.id) continue;
    if (s.roomId !== roomId) continue;
    if (["cancelled", "no_show", "checked_out"].includes(s.status)) continue;
    for (const d of datesBetween(s.checkIn, s.checkOut)) occupied.add(d);
  }
  for (const d of datesBetween(stay.checkIn, stay.checkOut)) occupied.add(d);

  let penalty = 0;
  let cur = windowStart;
  while (cur < windowEnd) {
    if (!occupied.has(cur)) {
      const prev = addDays(cur, -1);
      const next = addDays(cur, 1);
      const prevOcc = occupied.has(prev) || prev < windowStart;
      const nextOcc = occupied.has(next) || next >= windowEnd;
      if (prevOcc && nextOcc) penalty += 100;
    }
    cur = addDays(cur, 1);
  }
  return penalty;
}

function scoreRoomForStay(
  stays: Stay[],
  room: Room,
  stay: Stay,
  groupFloorHint: number | null,
  groupNumbers: number[],
): number {
  let score = 0;
  if (stay.vip) {
    if (room.floor === 3) score += 400;
    else if (room.floor === 2) score += 80;
    else score -= 40;
  }
  if (stay.groupName && groupFloorHint != null) {
    if (room.floor === groupFloorHint) score += 300;
    const num = Number(room.number);
    if (Number.isFinite(num) && groupNumbers.length) {
      const nearest = Math.min(...groupNumbers.map((n) => Math.abs(n - num)));
      score += Math.max(0, 120 - nearest * 25);
    }
  }
  // Prefer clean / inspected inventory
  if (room.hkStatus === "clean" || room.hkStatus === "inspected") score += 40;
  if (room.hkStatus === "dirty") score -= 30;

  const winStart = addDays(stay.checkIn, -3);
  const winEnd = addDays(stay.checkOut, 3);
  score -= orphanGapPenalty(stays, room.id, stay, winStart, winEnd);

  // Prefer abutting previous/next stays (fills contiguous blocks)
  const nightBefore = addDays(stay.checkIn, -1);
  const nightOfCheckout = stay.checkOut;
  if (roomOccupiedOn(stays, room.id, nightBefore, stay.id)) score += 60;
  if (roomOccupiedOn(stays, room.id, nightOfCheckout, stay.id)) score += 60;

  return score;
}

export type RoomSuggestion = {
  room: Room;
  score: number;
  reasons: string[];
  exactType: boolean;
};

function groupHints(stays: Stay[], rooms: Room[], stay: Stay) {
  const groupPeers = stay.groupId
    ? stays.filter(
        (s) =>
          s.groupId === stay.groupId &&
          s.id !== stay.id &&
          Boolean(s.roomId) &&
          !["cancelled", "no_show"].includes(s.status),
      )
    : stay.groupName
      ? stays.filter(
          (s) =>
            s.groupName === stay.groupName &&
            s.id !== stay.id &&
            Boolean(s.roomId) &&
            !["cancelled", "no_show"].includes(s.status),
        )
      : [];
  const groupFloorHint =
    groupPeers.length > 0
      ? (rooms.find((r) => r.id === groupPeers[0]!.roomId)?.floor ?? null)
      : stay.vip
        ? 3
        : null;
  const groupNumbers = groupPeers
    .map((s) => Number(s.roomNumber))
    .filter((n) => Number.isFinite(n));
  return { groupFloorHint, groupNumbers };
}

function reasonList(
  stays: Stay[],
  room: Room,
  stay: Stay,
  groupFloorHint: number | null,
  groupNumbers: number[],
): string[] {
  const reasons: string[] = [];
  if (room.typeCode === stay.typeCode) reasons.push("Exact type");
  else reasons.push(`Upgrade · ${room.typeCode}`);
  if (room.hkStatus === "clean" || room.hkStatus === "inspected") {
    reasons.push(room.hkStatus === "inspected" ? "Inspected" : "Clean");
  } else if (room.hkStatus === "dirty") {
    reasons.push("Dirty — HK first");
  }
  if (stay.vip && room.floor === 3) reasons.push("VIP floor");
  if (stay.groupName && groupFloorHint != null && room.floor === groupFloorHint) {
    reasons.push("Group cluster");
  }
  const num = Number(room.number);
  if (Number.isFinite(num) && groupNumbers.length) {
    const nearest = Math.min(...groupNumbers.map((n) => Math.abs(n - num)));
    if (nearest <= 2) reasons.push("Beside group");
  }
  const nightBefore = addDays(stay.checkIn, -1);
  if (roomOccupiedOn(stays, room.id, nightBefore, stay.id)) {
    reasons.push("Fills gap");
  }
  if (reasons.length === 0) reasons.push(`Floor ${room.floor}`);
  return reasons;
}

/** Rank free rooms for a stay — StayView / StayHub / mobile assign. */
export function rankRoomsForStay(
  stays: Stay[],
  rooms: Room[],
  stay: Stay,
  opts?: { allowUpgrade?: boolean; limit?: number },
): RoomSuggestion[] {
  const allowUpgrade = opts?.allowUpgrade ?? false;
  const limit = opts?.limit ?? 8;
  const { groupFloorHint, groupNumbers } = groupHints(stays, rooms, stay);
  const pool = rooms.filter((r) => {
    if (r.hkStatus === "ooo") return false;
    if (r.id === stay.roomId) return true;
    if (!allowUpgrade && r.typeCode !== stay.typeCode) return false;
    if (allowUpgrade && r.typeCode !== stay.typeCode) {
      /* allow only same family or any when upgrading */
    }
    for (const d of datesBetween(stay.checkIn, stay.checkOut)) {
      if (roomOccupiedOn(stays, r.id, d, stay.id)) return false;
    }
    return true;
  });

  return pool
    .map((room) => {
      let score = scoreRoomForStay(
        stays,
        room,
        stay,
        groupFloorHint,
        groupNumbers,
      );
      const exactType = room.typeCode === stay.typeCode;
      if (!exactType) score -= 80;
      return {
        room,
        score,
        exactType,
        reasons: reasonList(stays, room, stay, groupFloorHint, groupNumbers),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Near-term unassigned arrivals needing a room (StayView queue). */
export function unassignedNearTerm(
  stays: Stay[],
  businessDate: string,
  horizonDays = 2,
): Stay[] {
  const until = addDays(businessDate, horizonDays);
  return stays
    .filter(
      (s) =>
        !s.roomId &&
        ["held", "confirmed"].includes(s.status) &&
        s.checkIn <= until,
    )
    .sort((a, b) => {
      if (a.vip !== b.vip) return a.vip ? -1 : 1;
      return a.checkIn.localeCompare(b.checkIn) || a.guestName.localeCompare(b.guestName);
    });
}

export const GROUP_META_SEED: Record<string, GroupMeta> = {
  "grp-001": {
    id: "grp-001",
    code: "TG-2026-YAP-01",
    name: "Yangphel Autumn Cultural Explorer",
    agencyName: "Yangphel Adventure Travel",
    agencyContact: "+975-2-323293 · ops@yangphel.bt",
    guideName: "Tshering Norbu",
    guideLicense: "TCR-8492",
    guidePhone: "+975-17618293",
    driverName: "Kinley Wangchuk",
    vehicleNo: "BP-1-A8921 (Toyota Coaster)",
    driverDormBed: "Staff Dorm Bed #02",
    mealPlan: "MAP",
    depositPaid: 80000,
    billingRule: "agency_room_meals",
    color: "#1a73e8",
    rateMode: "by_category",
    uniformNightlyNet: null,
  },
  "grp-002": {
    id: "grp-002",
    code: "TG-2026-DA-04",
    name: "Druk Asia Photography Expedition",
    agencyName: "Druk Asia Tours & Treks",
    agencyContact: "+975-2-334411 · ops@drukasia.com",
    guideName: "Sonam Tobgay",
    guideLicense: "TCR-6120",
    guidePhone: "+975-17119922",
    driverName: "Pema Dorji",
    vehicleNo: "BP-2-B3419 (HiAce Commuter)",
    driverDormBed: "Staff Dorm Bed #05",
    mealPlan: "AP",
    depositPaid: 60000,
    billingRule: "agency_room_meals",
    color: "#0d9f6e",
    rateMode: "by_category",
    uniformNightlyNet: null,
  },
  "grp-003": {
    id: "grp-003",
    code: "TG-2026-RTC-02",
    name: "Royal Thimphu College Visiting Faculty",
    agencyName: "Royal Thimphu College (Direct MoA)",
    agencyContact: "+975-2-351801 · admin@rtc.bt",
    guideName: "Campus liaison",
    guideLicense: "N/A",
    guidePhone: "+975-17110000",
    driverName: "RTC van",
    vehicleNo: "BP-1-C2201",
    driverDormBed: "N/A",
    mealPlan: "CP",
    depositPaid: 0,
    billingRule: "agency_room_meals",
    color: "#e37400",
    rateMode: "by_category",
    uniformNightlyNet: null,
  },
};

export function groupMembers(stays: Stay[], groupId: string): Stay[] {
  return stays
    .filter(
      (s) =>
        s.groupId === groupId && !["cancelled", "no_show"].includes(s.status),
    )
    .sort(
      (a, b) =>
        (a.roomNumber ?? "").localeCompare(b.roomNumber ?? "") ||
        a.guestName.localeCompare(b.guestName),
    );
}

export function groupMasterBalance(stays: Stay[], groupId: string): number {
  return groupMembers(stays, groupId).reduce(
    (sum, s) => sum + folioBalance(s, "master"),
    0,
  );
}

export function groupPersonalBalance(stays: Stay[], groupId: string): number {
  return groupMembers(stays, groupId).reduce(
    (sum, s) => sum + folioBalance(s, "personal"),
    0,
  );
}

function deriveGroupStatus(members: Stay[]): TourGroupSummary["status"] {
  if (members.length === 0) return "quote";
  if (members.every((m) => m.status === "checked_out")) return "departed";
  if (members.some((m) => m.status === "checked_in")) return "in_house";
  return "confirmed";
}

export function listTourGroups(
  stays: Stay[],
  groupMeta: Record<string, GroupMeta>,
): TourGroupSummary[] {
  const ids = new Set<string>();
  for (const s of stays) {
    if (s.groupId) ids.add(s.groupId);
  }
  for (const id of Object.keys(groupMeta)) ids.add(id);

  const out: TourGroupSummary[] = [];
  for (const id of ids) {
    const members = groupMembers(stays, id);
    const meta = groupMeta[id];
    const name =
      meta?.name ??
      members[0]?.groupName ??
      id;
    const agencyName =
      meta?.agencyName ?? members[0]?.agencyName ?? "Direct";
    const checkIn =
      members.length > 0
        ? members.reduce((min, m) => (m.checkIn < min ? m.checkIn : min), members[0]!.checkIn)
        : ymd(new Date());
    const checkOut =
      members.length > 0
        ? members.reduce((max, m) => (m.checkOut > max ? m.checkOut : max), members[0]!.checkOut)
        : addDays(checkIn, 1);
    const masterCharges = members.reduce((sum, s) => {
      const t = folioTotals(s, "master");
      return sum + t.charged;
    }, 0);
    out.push({
      id,
      code: meta?.code ?? id.toUpperCase(),
      name,
      agencyName,
      agencyContact: meta?.agencyContact ?? "",
      guideName: meta?.guideName ?? "TBD",
      guideLicense: meta?.guideLicense ?? "TCR-PENDING",
      guidePhone: meta?.guidePhone ?? "",
      driverName: meta?.driverName ?? "TBD",
      vehicleNo: meta?.vehicleNo ?? "",
      driverDormBed: meta?.driverDormBed ?? "",
      mealPlan: meta?.mealPlan ?? members[0]?.mealPlan ?? "MAP",
      depositPaid: meta?.depositPaid ?? 0,
      billingRule: meta?.billingRule ?? "agency_room_meals",
      color: meta?.color ?? "#1a73e8",
      members,
      checkIn,
      checkOut,
      nights: nightsBetween(checkIn, checkOut),
      status: deriveGroupStatus(members),
      totalPax: members.length * 2,
      roomsBooked: Math.max(members.length, 1),
      roomsAssigned: members.filter((m) => Boolean(m.roomId)).length,
      masterBalance: groupMasterBalance(stays, id),
      personalBalance: groupPersonalBalance(stays, id),
      masterFolioCharges: masterCharges,
    });
  }
  return out.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.name.localeCompare(b.name));
}

/** Fallback when FO hydrate has not settled — matches docs/rate-agent.html inventory. */
export const ROOM_TYPE_OPTIONS: { code: RoomTypeCode; name: string; nightlyNet: number }[] = [
  { code: "deluxe_queen", name: "Deluxe Queen", nightlyNet: 5900 },
  { code: "deluxe_king", name: "Deluxe King", nightlyNet: 5900 },
  { code: "deluxe_twin", name: "Deluxe Twin", nightlyNet: 5900 },
  { code: "suite", name: "Suite", nightlyNet: 14350 },
];

let bookingSeq = 1400;

/** Live desk must never paint Yangphel demos. Opt-in local seed via VITE_FO_SEED=1. */
const LIVE_FO_BOOT = !import.meta.env.DEV;
const DEV_FO_SEED =
  import.meta.env.DEV && String(import.meta.env.VITE_FO_SEED ?? "") === "1";

export const useFrontOfficeStore = create<FrontOfficeState>((set, get) => ({
  businessDate: TODAY,
  /* Local rack still needs room rows; guest stays are opt-in seed only. */
  rooms: LIVE_FO_BOOT ? [] : ROOM_SEED,
  stays: DEV_FO_SEED ? seedStays() : [],
  groupMeta: DEV_FO_SEED ? { ...GROUP_META_SEED } : {},
  liveRevision: 0,
  selectedStayId: null,
  stayHubDismissGuardUntil: 0,
  fastBookOpen: false,
  fastBookPrefill: null,
  moveModal: null,
  horizonDays: 14,
  rackAnchorDate: TODAY,
  apiOffline: false,
  roomBlocks: [],

  bumpLiveRevision: () => set((s) => ({ liveRevision: s.liveRevision + 1 })),

  hydrateFromApi: async () => {
    const remote = await hydrateFrontOfficeRemote();
    if (!remote.ok) {
      set({ apiOffline: true });
      return remote;
    }
    /* Tenant inventory comes from API — never keep Yangphel ROOM_SEED on a live property. */
    const rooms =
      remote.rooms.length > 0
        ? remote.rooms
        : LIVE_FO_BOOT
          ? []
          : get().rooms;
    /* Never block FO hydrate on inventory upsert (401 / unauthed desk). */
    if (remote.rooms.length === 0 && !LIVE_FO_BOOT) {
      void ensureInventoryRemote(rooms).then((inv) => {
        if (!inv.ok) {
          console.warn("[fo] ensureInventory deferred (read path still live)", inv.error);
        }
      });
    }
    if (remote.rooms.length === 0 && LIVE_FO_BOOT) {
      console.error(
        "[fo] hydrate returned 0 rooms for live property — check sessionPropertyId / PIN hotel",
      );
    }
    const mapOpts = {
      apiRooms: remote.apiRooms,
      roomTypes: remote.roomTypes,
      groupsById: remote.groupsById,
    };
    const mapped = remote.bookings.map((b) => mapApiBookingToStay(b, rooms, mapOpts));
    const deskBlocks: RoomBlock[] = remote.roomBlocks
      .map((b) => {
        const deskRoomId = apiIdToDeskRoomId(b.roomId, rooms, remote.apiRooms);
        if (!deskRoomId) return null;
        return {
          id: b.id,
          roomId: deskRoomId,
          blockKind: b.blockKind,
          fromDate: b.fromDate,
          toDate: b.toDate,
          reason: b.reason,
        } satisfies RoomBlock;
      })
      .filter((b): b is RoomBlock => b != null);
    set((s) => {
      const byApi = new Map(
        s.stays.filter((st) => st.apiBookingId).map((st) => [st.apiBookingId!, st]),
      );
      const merged: Stay[] = [];
      const seen = new Set<string>();
      for (const apiStay of mapped) {
        const prev = byApi.get(apiStay.id);
        merged.push(
          prev
            ? {
                ...prev,
                ...apiStay,
                // Prefer API folio lines when present — seed/local lines must not gate checkout.
                folioLines:
                  apiStay.folioLines.length > 0 ? apiStay.folioLines : prev.folioLines,
                audit: prev.audit,
                guestPhone: prev.guestPhone || apiStay.guestPhone,
                guestEmail: prev.guestEmail || apiStay.guestEmail,
                notes: apiStay.notes ?? prev.notes,
                vip: prev.vip || apiStay.vip,
                groupId: apiStay.groupId ?? prev.groupId,
                groupName: apiStay.groupName ?? prev.groupName,
                agencyName: apiStay.agencyName ?? prev.agencyName,
                companions:
                  apiStay.companions && apiStay.companions.length > 0
                    ? apiStay.companions
                    : prev.companions,
                luggage: prev.luggage,
                passportOrCid: (() => {
                  const prevId = prev.passportOrCid?.trim() ?? "";
                  const apiId = apiStay.passportOrCid?.trim() ?? "";
                  if (prevId && !/^pending$/i.test(prevId) && !/^PARTY:/i.test(prevId))
                    return prevId;
                  if (apiId && !/^pending$/i.test(apiId)) return apiId;
                  if (prevId && !/^pending$/i.test(prevId)) return prevId;
                  return "";
                })(),
                nationality: prev.nationality || apiStay.nationality,
                guestName: apiStay.guestName || prev.guestName,
                apiFolioId: apiStay.apiFolioId ?? prev.apiFolioId,
                apiAgencyFolioId: apiStay.apiAgencyFolioId ?? prev.apiAgencyFolioId,
                apiGuestId: apiStay.apiGuestId ?? prev.apiGuestId,
                syncPending: false,
              }
            : apiStay,
        );
        seen.add(apiStay.id);
      }
      for (const local of s.stays) {
        if (local.apiBookingId && seen.has(local.apiBookingId)) continue;
        if (local.apiBookingId && seen.has(local.id)) continue;
        // Keep only explicit offline creates awaiting sync — drop seed / unsynced demos.
        if (!local.apiBookingId && local.syncPending) merged.push(local);
      }
      /* Remap open StayHub when local UUID was replaced by API booking id. */
      let selectedStayId = s.selectedStayId;
      if (selectedStayId && !merged.some((st) => st.id === selectedStayId)) {
        const prev = s.stays.find((st) => st.id === selectedStayId);
        const apiKey = prev?.apiBookingId ?? selectedStayId;
        const remapped =
          merged.find((st) => st.id === apiKey || st.apiBookingId === apiKey) ?? null;
        selectedStayId = remapped?.id ?? null;
      }
      return {
        businessDate: remote.businessDate,
        rackAnchorDate: remote.businessDate,
        rooms,
        stays: merged,
        roomBlocks: deskBlocks,
        selectedStayId,
        liveRevision: s.liveRevision + 1,
        apiOffline: false,
      };
    });
    return { ok: true, merged: mapped.length };
  },

  runNightAuditRemote: async () => {
    const remote = await syncNightAuditRemote();
    if (!remote.ok) return remote;
    if (remote.nextDate && remote.nextDate !== get().businessDate) {
      set({
        businessDate: remote.nextDate,
        rackAnchorDate: remote.nextDate,
        liveRevision: get().liveRevision + 1,
      });
    }
    return {
      ok: true,
      nextDate: remote.nextDate,
      postedNights: remote.postedNights,
      noShows: remote.noShows,
    };
  },

  openStay: (id) =>
    set(
      id
        ? {
            selectedStayId: id,
            /* Hold open through Fast Book unmount / focus restore (~Radix exit 200ms). */
            stayHubDismissGuardUntil: Date.now() + 1200,
          }
        : { selectedStayId: null },
    ),
  setHorizonDays: (days) => set({ horizonDays: days }),
  setRackAnchorDate: (ymdStr) => set({ rackAnchorDate: ymdStr }),
  openFastBook: (prefill = null) => set({ fastBookOpen: true, fastBookPrefill: prefill }),
  closeFastBook: () => set({ fastBookOpen: false, fastBookPrefill: null }),
  setMoveModal: (v) => set({ moveModal: v }),

  commissionInventory: (input) => {
    const floors = Math.max(1, Math.min(8, Math.floor(input.floors)));
    const types = input.roomTypes
      .map((t) => ({
        code: t.code.trim().toUpperCase().slice(0, 12) || "STD",
        name: t.name.trim() || "Standard",
        count: Math.max(0, Math.min(120, Math.floor(t.count))),
        nightlyNet: Math.max(0, Math.floor(t.nightlyNet)),
      }))
      .filter((t) => t.count > 0);
    if (types.length === 0) {
      return { ok: false, error: "Add at least one room type with count ≥ 1" };
    }
    const slots = types.flatMap((t) =>
      Array.from({ length: t.count }, () => ({
        code: t.code,
        name: t.name,
        nightlyNet: t.nightlyNet,
      })),
    );
    const total = slots.length;
    if (total < floors) {
      return { ok: false, error: "Room count must be ≥ floor count" };
    }
    if (total > 120) {
      return { ok: false, error: "Max 120 rooms in desk commissioning" };
    }
    const perFloor = Math.ceil(total / floors);
    const next: Room[] = [];
    let n = 0;
    for (let f = 1; f <= floors; f++) {
      for (let i = 1; i <= perFloor && n < total; i++) {
        const slot = slots[n]!;
        n += 1;
        const number = `${f}${String(i).padStart(2, "0")}`;
        next.push({
          id: `rm-${number}`,
          number,
          floor: f,
          typeCode: slot.code,
          typeName: slot.name,
          hkStatus: "clean",
        });
      }
    }
    const rateByCode = new Map(types.map((t) => [t.code, t.nightlyNet]));
    const fallbackRate = types[0]!.nightlyNet;
    const validIds = new Set(next.map((r) => r.id));
    set((s) => ({
      rooms: next,
      stays: s.stays.map((st) => {
        const room = st.roomId ? next.find((r) => r.id === st.roomId) : undefined;
        const nightlyNet = room
          ? (rateByCode.get(room.typeCode) ?? fallbackRate)
          : fallbackRate;
        if (st.roomId && !validIds.has(st.roomId)) {
          return {
            ...st,
            roomId: null,
            roomNumber: null,
            nightlyNet,
            audit: [
              audit(
                `Room inventory recommissioned · unassigned (rack Nu. ${nightlyNet.toLocaleString("en-BT")})`,
              ),
              ...st.audit,
            ],
          };
        }
        return { ...st, nightlyNet };
      }),
    }));
    return { ok: true, roomCount: next.length };
  },

  setRoomHkStatus: (roomId, hkStatus, actor = ACTOR_DEFAULT) => {
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room) return { ok: false, error: "Room not found" };
    const occupied = get().stays.some(
      (s) => s.roomId === roomId && s.status === "checked_in",
    );
    if (hkStatus === "ooo" && occupied) {
      return { ok: false, error: "Cannot mark OOO while guest is in-house — move guest first" };
    }
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, hkStatus } : r)),
      stays: s.stays.map((st) =>
        st.roomId === roomId && st.status === "checked_in"
          ? {
              ...st,
              audit: [
                {
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                  actor,
                  message: `HK status → ${hkStatus}`,
                },
                ...st.audit,
              ],
            }
          : st,
      ),
    }));
    void syncHkStatusRemote({ deskRoomId: roomId, status: hkStatus }).then((remote) => {
      if (!remote.ok) {
        console.error("[fo] housekeeping.setStatus remote failed", remote.error);
      }
    });
    return { ok: true };
  },

  advanceBusinessDate: (toDate) => set({ businessDate: toDate, rackAnchorDate: toDate }),

  smartAutoAssign: async (stayIds) => {
    const state = get();
    const biz = state.businessDate;
    let candidates = state.stays.filter((s) => {
      if (stayIds?.length) return stayIds.includes(s.id);
      return (
        !s.roomId &&
        ["confirmed", "held"].includes(s.status) &&
        s.checkIn === biz
      );
    });
    if (stayIds?.length) {
      candidates = candidates.filter((s) => !s.roomId);
    }

    // VIP first, then larger tour groups, then longer stays (tetris)
    const groupSizes = new Map<string, number>();
    for (const s of state.stays) {
      if (!s.groupName) continue;
      if (!["confirmed", "held", "checked_in"].includes(s.status)) continue;
      groupSizes.set(s.groupName, (groupSizes.get(s.groupName) ?? 0) + 1);
    }
    candidates = [...candidates].sort((a, b) => {
      if (a.vip !== b.vip) return a.vip ? -1 : 1;
      const ga = a.groupName ? (groupSizes.get(a.groupName) ?? 0) : 0;
      const gb = b.groupName ? (groupSizes.get(b.groupName) ?? 0) : 0;
      if (ga !== gb) return gb - ga;
      return (
        nightsBetween(b.checkIn, b.checkOut) - nightsBetween(a.checkIn, a.checkOut)
      );
    });

    let assigned = 0;
    const conflicts: string[] = [];
    // Working copy of stays for sequential scoring
    let workingStays = [...state.stays];

    for (const stay of candidates) {
      const groupPeers = stay.groupId
        ? workingStays.filter(
            (s) =>
              s.groupId === stay.groupId &&
              s.roomId &&
              !["cancelled", "no_show"].includes(s.status),
          )
        : stay.groupName
          ? workingStays.filter(
              (s) =>
                s.groupName === stay.groupName &&
                s.roomId &&
                !["cancelled", "no_show"].includes(s.status),
            )
          : [];
      const groupFloorHint =
        groupPeers.length > 0
          ? (state.rooms.find((r) => r.id === groupPeers[0]!.roomId)?.floor ?? null)
          : stay.vip
            ? 3
            : null;
      const groupNumbers = groupPeers
        .map((s) => Number(s.roomNumber))
        .filter((n) => Number.isFinite(n));

      const freeRooms = state.rooms.filter((r) =>
        roomFreeForStay(workingStays, r, stay),
      );
      if (freeRooms.length === 0) {
        conflicts.push(`${stay.guestName}: no free ${stay.typeCode}`);
        continue;
      }

      freeRooms.sort(
        (a, b) =>
          scoreRoomForStay(workingStays, b, stay, groupFloorHint, groupNumbers) -
          scoreRoomForStay(workingStays, a, stay, groupFloorHint, groupNumbers),
      );
      const best = freeRooms[0]!;
      const res = await get().assignRoom(stay.id, best.id, "Smart Auto-Assign");
      if (!res.ok) {
        conflicts.push(`${stay.guestName}: ${res.error}`);
        continue;
      }
      assigned += 1;
      workingStays = get().stays;
    }

    return { assigned, conflicts };
  },

  setStayNotes: async (stayId, notes) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    const trimmed = notes.trim();
    if (isApiUuid(stay.apiBookingId)) {
      const remote = await syncUpdateStayNotesRemote(stay.apiBookingId, trimmed);
      if (!remote.ok) return { ok: false, error: remote.error };
    }
    set((s) => ({
      stays: s.stays.map((x) =>
        x.id === stayId
          ? {
              ...x,
              notes: trimmed || undefined,
              audit: [audit("Stay note updated"), ...x.audit],
            }
          : x,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  updateGuestIdentity: async (stayId, input, actor = ACTOR_DEFAULT) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    const gate = assertGuestIdDocument(input.passportOrCid);
    if (!gate.ok) {
      return { ok: false, error: "Enter passport or CID (min 4 characters)" };
    }
    const nationality = input.nationality?.trim();
    let apiGuestId = stay.apiGuestId;
    if (!get().apiOffline) {
      const remote = await syncGuestIdentityRemote({
        guestId: stay.apiGuestId,
        fullName: stay.guestName,
        passportOrCid: gate.documentRef,
        nationality: nationality || stay.nationality,
      });
      if (!remote.ok) return { ok: false, error: remote.error };
      apiGuestId = remote.guestId;
    }
    set((s) => ({
      stays: s.stays.map((x) =>
        x.id === stayId
          ? {
              ...x,
              passportOrCid: gate.documentRef,
              nationality: nationality || x.nationality,
              apiGuestId,
              audit: [
                audit(`Guest ID captured · ${gate.documentRef}`, actor),
                ...x.audit,
              ],
            }
          : x,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  updateStayGuestRoster: async (stayId, input, actor = ACTOR_DEFAULT) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    const guestName = input.guestName?.trim();
    if (guestName !== undefined && guestName.length < 1) {
      return { ok: false, error: "Guest name is required" };
    }
    let nextPassport = stay.passportOrCid;
    if (input.passportOrCid !== undefined) {
      const raw = input.passportOrCid.trim();
      if (!raw || /^pending$/i.test(raw)) {
        nextPassport = "Pending";
      } else if (/^PARTY:/i.test(raw)) {
        nextPassport = raw;
      } else {
        const gate = assertGuestIdDocument(raw);
        if (!gate.ok) {
          return { ok: false, error: "Passport / CID must be at least 4 characters" };
        }
        nextPassport = gate.documentRef;
      }
    }
    const companions = (input.companions ?? stay.companions ?? [])
      .map((c) => ({
        name: c.name.trim(),
        passportOrCid: c.passportOrCid?.trim() || undefined,
        nationality: c.nationality?.trim() || undefined,
      }))
      .filter((c) => c.name.length > 0)
      .slice(0, 1);
    let luggage: StayLuggage | undefined = stay.luggage;
    if (input.luggage === null) {
      luggage = undefined;
    } else if (input.luggage) {
      luggage = {
        count: Math.max(0, Math.min(20, Math.floor(input.luggage.count))),
        color: input.luggage.color.trim().slice(0, 40),
        description: input.luggage.description.trim().slice(0, 160),
      };
    }
    const nationality = input.nationality?.trim();
    const resolvedName = guestName ?? stay.guestName;
    const resolvedNat = nationality || stay.nationality;
    let apiGuestId = stay.apiGuestId;

    const bookingKey = stay.apiBookingId ?? stayId;
    if (!get().apiOffline && isApiUuid(bookingKey)) {
      const companion = companions[0];
      const remote = await syncUpdateGuestRosterRemote({
        apiBookingId: bookingKey,
        guestName: resolvedName,
        passportOrCid:
          input.passportOrCid !== undefined ? nextPassport : undefined,
        nationality: nationality || undefined,
        companionName: input.companions !== undefined ? companion?.name ?? null : undefined,
        companionPassportOrCid:
          input.companions !== undefined
            ? companion?.passportOrCid ?? null
            : undefined,
        companionNationality:
          input.companions !== undefined
            ? companion?.nationality ?? null
            : undefined,
      });
      if (!remote.ok) return { ok: false, error: remote.error };
      apiGuestId = remote.data.guestId;
      if (remote.data.passportOrCid != null && remote.data.passportOrCid.trim()) {
        nextPassport = remote.data.passportOrCid.trim();
      }
    }

    set((s) => ({
      stays: s.stays.map((x) =>
        x.id !== stayId
          ? x
          : {
              ...x,
              guestName: resolvedName,
              passportOrCid: nextPassport,
              nationality: resolvedNat,
              companions,
              luggage,
              apiGuestId,
              audit: [audit("Guest roster / luggage updated", actor), ...x.audit],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  setBillingMode: (stayId, mode, actor = ACTOR_DEFAULT) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (stay.taxInvoiceId && mode !== "standard") {
      return {
        ok: false,
        error: `Tax invoice ${stay.taxInvoiceNo} already issued — cannot switch to ${BILLING_MODE_LABEL[mode]}`,
      };
    }
    if (stayBillingMode(stay) === mode) return { ok: true };
    set((s) => ({
      stays: s.stays.map((x) =>
        x.id === stayId
          ? {
              ...x,
              billingMode: mode,
              audit: [
                audit(
                  `Billing mode → ${BILLING_MODE_LABEL[mode]}`,
                  actor,
                ),
                ...x.audit,
              ],
            }
          : x,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  attachTaxInvoice: (stayId, doc, actor = ACTOR_DEFAULT) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    const gate = canIssueTaxInvoice(stay);
    if (!gate.ok) return gate;
    set((s) => ({
      stays: s.stays.map((x) =>
        x.id === stayId
          ? {
              ...x,
              billingMode: "standard",
              taxInvoiceId: doc.id,
              taxInvoiceNo: doc.docNo,
              taxInvoiceKind: doc.kind,
              taxInvoiceAt: doc.at,
              audit: [
                audit(`Tax invoice issued · ${doc.docNo}`, actor),
                ...x.audit,
              ],
            }
          : x,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  ensureFolioNo: (stayId, actor = ACTOR_DEFAULT) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (stay.folioNo) return { ok: true, folioNo: stay.folioNo };
    const folioNo = allocateFolioNo();
    set((s) => ({
      stays: s.stays.map((x) =>
        x.id === stayId
          ? {
              ...x,
              folioNo,
              audit: [audit(`Folio opened · ${folioNo}`, actor), ...x.audit],
            }
          : x,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true, folioNo };
  },

  createBooking: async (input) => {
    if (get().apiOffline) {
      return { ok: false, error: "API offline — cannot create booking" };
    }
    const status: BookingStatus = input.asHold ? "held" : "confirmed";
    const roomLines: FastBookRoomLine[] =
      input.roomLines && input.roomLines.length > 0
        ? input.roomLines.slice(0, 8)
        : Array.from(
            {
              length: Math.max(1, Math.min(8, Math.floor(input.roomsCount ?? 1))),
            },
            (_, i) => ({
              typeCode: input.typeCode,
              roomId: i === 0 ? input.roomId ?? null : null,
            }),
          );
    const roomsCount = roomLines.length;
    const uniformNet =
      input.uniformNightlyNet != null &&
      Number.isFinite(input.uniformNightlyNet) &&
      input.uniformNightlyNet >= 0
        ? input.uniformNightlyNet
        : null;
    const leadName = input.guestName.trim();
    /* Multi-room Fast Book → shared group so StayHub shows Group tab + peers. */
    const needsGroup = roomsCount > 1 || Boolean(input.groupId);
    const groupId = needsGroup
      ? input.groupId && isApiUuid(input.groupId)
        ? input.groupId
        : crypto.randomUUID()
      : null;
    const groupName =
      input.groupName?.trim() ||
      (roomsCount > 1 ? `${leadName} · ${roomsCount} rooms` : null);

    const createdStays: Stay[] = [];
    const claimedRoomIds = new Set<string>();
    let assignWarning: string | undefined;
    for (let i = 0; i < roomsCount; i += 1) {
      const line = roomLines[i]!;
      const type =
        ROOM_TYPE_OPTIONS.find((t) => t.code === line.typeCode) ??
        ROOM_TYPE_OPTIONS.find((t) => t.code === input.typeCode) ??
        ROOM_TYPE_OPTIONS[0]!;
      bookingSeq += 1;
      const stayId = crypto.randomUUID();
      const roomLabel = roomsCount > 1 ? ` · #${i + 1}` : "";
      const guestName = i === 0 ? leadName : `${leadName}${roomLabel}`;
      const remote = await syncCreateReservationRemote({
        stayId,
        guestName,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        typeCode: line.typeCode,
        mealPlan: input.mealPlan,
        source: input.source,
        asHold: status === "held",
        groupId,
        agencyName: input.agencyName ?? null,
      });
      if (!remote.ok) {
        if (remote.error === "API_UNREACHABLE" || remote.error === "ROOM_TYPE_SYNC_FAILED") {
          set({ apiOffline: true });
        }
        if (createdStays.length > 0) {
          /* Compensate partial party — cancel API bookings already ACK'd. */
          for (const partial of createdStays) {
            if (isApiUuid(partial.apiBookingId)) {
              const cancelled = await syncCancelRemote(partial.apiBookingId);
              if (!cancelled.ok) {
                console.error(
                  "[createBooking] compensate cancel failed",
                  partial.apiBookingId,
                  cancelled.error,
                );
              }
            }
          }
          return {
            ok: false,
            error: `Party create aborted after ${createdStays.length}/${roomsCount} — ${remote.error} (rolled back)`,
          };
        }
        return { ok: false, error: remote.error };
      }
      if (get().apiOffline) set({ apiOffline: false });

      const wantRoomId =
        line.roomId && !claimedRoomIds.has(line.roomId) ? line.roomId : null;
      let assignedRoom = wantRoomId
        ? get().rooms.find((r) => r.id === wantRoomId) ?? null
        : null;
      if (assignedRoom && assignedRoom.typeCode !== line.typeCode) {
        /* Desk picked a unit of another type — keep type from line; assign as upgrade. */
      }
      if (assignedRoom) {
        const assigned = await syncAssignRoomRemote({
          bookingLineId: remote.lineId,
          deskRoomId: assignedRoom.id,
          mode:
            assignedRoom.typeCode !== line.typeCode ? "upgrade" : "assign",
        });
        if (!assigned.ok) {
          assignWarning = `Room ${assignedRoom.number} not assigned — ${assigned.error}`;
          console.error(
            "[createBooking] assign failed",
            assignedRoom.number,
            assigned.error,
          );
          assignedRoom = null;
        } else {
          claimedRoomIds.add(assignedRoom.id);
        }
      }

      const stay: Stay = {
        id: remote.bookingId,
        confirmationNo: remote.confirmationNo || `PS-2026-${bookingSeq}`,
        status,
        guestName,
        guestPhone: i === 0 ? (input.guestPhone?.trim() ?? "") : "",
        guestEmail: i === 0 ? (input.guestEmail?.trim() ?? "") : "",
        nationality: input.nationality?.trim() || "International",
        passportOrCid: input.passportOrCid?.trim() || "",
        vip: Boolean(input.vip),
        roomId: assignedRoom?.id ?? null,
        roomNumber: assignedRoom?.number ?? null,
        typeCode: line.typeCode,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        mealPlan: input.mealPlan,
        source: input.source,
        nightlyNet: uniformNet ?? type.nightlyNet,
        groupId,
        groupName,
        agencyName: input.agencyName ?? null,
        billingMode: "standard",
        taxInvoiceId: null,
        taxInvoiceNo: null,
        taxInvoiceKind: null,
        taxInvoiceAt: null,
        roomsCount: 1,
        folioLines:
          i === 0 && input.depositAmount && input.depositAmount > 0
            ? [
                paymentLine(
                  `Advance deposit · ${input.source}`,
                  input.depositAmount,
                  packageStreamForStay({
                    groupId,
                    source: input.source,
                  }),
                ),
              ]
            : [],
        audit: [
          audit(
            status === "held"
              ? `Hold created (${input.mealPlan}, ${line.typeCode})`
              : `Confirmed booking (${input.mealPlan}, ${line.typeCode})`,
          ),
          audit(`API ACK · ${remote.confirmationNo}`),
          ...(roomsCount > 1
            ? [audit(`Multi-room party ${i + 1}/${roomsCount} · ${line.typeCode}`)]
            : []),
          ...(uniformNet != null && i === 0
            ? [audit(`Uniform party rate · Nu ${uniformNet}/n EP · all types`)]
            : []),
        ],
        holdExpiresAt: status === "held" ? `${input.checkIn}T18:00:00` : null,
        depositPaid: i === 0 ? (input.depositAmount ?? 0) : 0,
        apiBookingId: remote.bookingId,
        apiBookingLineId: remote.lineId,
        apiFolioId: remote.folioId,
        apiAgencyFolioId: remote.agencyFolioId,
        apiGuestId: remote.guestId,
        syncPending: false,
      };
      createdStays.push(stay);
    }

    const primary = createdStays[0]!;
    set((s) => {
      const ids = new Set(createdStays.map((st) => st.id));
      const nextMeta =
        groupId && groupName
          ? {
              ...s.groupMeta,
              [groupId]: {
                ...(s.groupMeta[groupId] ?? {
                  id: groupId,
                  code: `TG-${Date.now().toString().slice(-4)}`,
                  name: groupName,
                  agencyName: input.agencyName ?? "Direct",
                  agencyContact: "",
                  guideName: "TBD",
                  guideLicense: "TCR-PENDING",
                  guidePhone: "",
                  driverName: "",
                  vehicleNo: "",
                  driverDormBed: "",
                  mealPlan: input.mealPlan,
                  depositPaid: input.depositAmount ?? 0,
                  billingRule: "agency_room_meals" as const,
                  color: "#669df6",
                }),
                mealPlan: input.mealPlan,
                rateMode:
                  uniformNet != null
                    ? ("uniform" as const)
                    : ("by_category" as const),
                uniformNightlyNet: uniformNet,
              },
            }
          : s.groupMeta;
      return {
        stays: [
          ...createdStays,
          ...s.stays.filter((st) => !ids.has(st.id) && !ids.has(st.apiBookingId ?? "")),
        ],
        groupMeta: nextMeta,
        /* Leave StayHub closed here — Fast Book Dialog must unmount first or Vaul
         * treats the focus restore as StayHub dismiss (Create → Open Stay looked broken). */
        fastBookOpen: false,
        fastBookPrefill: null,
        liveRevision: s.liveRevision + 1,
      };
    });

    if (input.depositAmount && input.depositAmount > 0) {
      const depositStream = packageStreamForStay({
        groupId: primary.groupId,
        source: primary.source,
      });
      let depositFolioId = primary.apiFolioId;
      let agencyFolioId = primary.apiAgencyFolioId;
      if (depositStream === "master" && isApiUuid(primary.apiBookingId)) {
        if (!isApiUuid(agencyFolioId)) {
          const ensured = await syncEnsureAgencyFolioRemote(primary.apiBookingId);
          if (ensured.ok) {
            agencyFolioId = ensured.agencyFolioId;
            depositFolioId = ensured.agencyFolioId;
          }
        } else {
          depositFolioId = agencyFolioId;
        }
      }
      if (isApiUuid(depositFolioId)) {
        const paid = await syncPostPaymentRemote({
          folioId: depositFolioId,
          amount: input.depositAmount,
          method: "cash",
          idempotencyKey: commandIdempotencyKey(
            "deposit",
            primary.apiBookingId ?? primary.id,
            String(Math.round(input.depositAmount * 100)),
          ),
        });
        if (paid.ok) {
          set((s) => ({
            stays: s.stays.map((st) =>
              st.id !== primary.id
                ? st
                : {
                    ...st,
                    apiAgencyFolioId: agencyFolioId ?? st.apiAgencyFolioId,
                    folioLines: [
                      ...st.folioLines.filter((l) => l.kind !== "payment"),
                      {
                        id: paid.data.paymentId,
                        postedAt: paid.data.postedAt ?? nowIso(),
                        kind: "payment" as const,
                        description: paid.data.description,
                        netAmount: paid.data.netAmount,
                        scAmount: 0,
                        bstAmount: 0,
                        totalAmount: paid.data.totalAmount,
                        voided: false,
                        stream: depositStream,
                      },
                    ],
                    depositPaid: input.depositAmount ?? 0,
                  },
            ),
            liveRevision: s.liveRevision + 1,
          }));
        } else {
          console.error("[createBooking] deposit post failed", paid.error);
        }
      }
    }

    return {
      ok: true,
      stay: get().stays.find((s) => s.id === primary.id) ?? primary,
      stays: createdStays.map(
        (c) => get().stays.find((s) => s.id === c.id) ?? c,
      ),
      groupId,
      assignWarning,
    };
  },

  ensureStaySynced: async (stayId) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (isApiUuid(stay.apiBookingId) && isApiUuid(stay.apiBookingLineId)) {
      return { ok: true };
    }
    const remote = await syncCreateReservationRemote({
      stayId: stay.id,
      guestName: stay.guestName,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      typeCode: stay.typeCode,
      mealPlan: stay.mealPlan,
      source: stay.source,
      asHold: stay.status === "held",
      groupId: stay.groupId,
      agencyName: stay.agencyName,
    });
    if (!remote.ok) {
      if (remote.error === "API_UNREACHABLE") set({ apiOffline: true });
      return { ok: false, error: remote.error };
    }
    set((s) => ({
      apiOffline: false,
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              id: remote.bookingId,
              confirmationNo: remote.confirmationNo || st.confirmationNo,
              apiBookingId: remote.bookingId,
              apiBookingLineId: remote.lineId,
              apiFolioId: remote.folioId,
              apiAgencyFolioId: remote.agencyFolioId ?? st.apiAgencyFolioId,
              groupId: st.groupId,
              groupName: st.groupName,
              agencyName: st.agencyName,
              syncPending: false,
              audit: [audit(`API sync ACK · ${remote.confirmationNo}`), ...st.audit],
            },
      ),
      selectedStayId:
        s.selectedStayId === stayId ? remote.bookingId : s.selectedStayId,
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  assignRoom: async (stayId, roomId, actor = ACTOR_DEFAULT, opts) => {
    if (get().apiOffline) {
      return { ok: false, error: "API offline — cannot assign" };
    }
    if (!deskCan("stayview", "write")) {
      return { ok: false, error: "No StayView write permission" };
    }
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    const room = state.rooms.find((r) => r.id === roomId);
    if (!stay || !room) return { ok: false, error: "Stay or room not found" };
    if (room.hkStatus === "ooo") return { ok: false, error: "Room is out of order" };

    const blockHit = state.roomBlocks.find(
      (b) =>
        b.roomId === roomId &&
        b.fromDate < stay.checkOut &&
        b.toDate > stay.checkIn,
    );
    if (blockHit) {
      return {
        ok: false,
        error: `Room ${room.number} blocked (${blockHit.blockKind}) until ${blockHit.toDate}`,
        code: "BLOCKED",
      };
    }

    if (room.hkStatus === "dirty") {
      if (!opts?.dirtyOverridePin) {
        return {
          ok: false,
          error: "Room is dirty — manager PIN required to assign",
          code: "DIRTY_PIN_REQUIRED",
        };
      }
      const pinGate = verifyDeskManagerPin(opts.dirtyOverridePin);
      if (!pinGate.ok) return { ok: false, error: pinGate.error, code: "DIRTY_PIN_INVALID" };
      actor = `${pinGate.name} (dirty override)`;
    }

    const typeMismatch = room.typeCode !== stay.typeCode;
    if (typeMismatch && !opts?.allowUpgrade) {
      return {
        ok: false,
        error: `Type mismatch: need ${stay.typeCode}, room is ${room.typeCode}`,
        code: "TYPE_MISMATCH",
      };
    }

    for (const d of datesBetween(stay.checkIn, stay.checkOut)) {
      const clash = roomOccupiedOn(state.stays, roomId, d, stayId);
      if (clash) {
        return {
          ok: false,
          error: `Room ${room.number} occupied by ${clash.guestName} on ${d}`,
        };
      }
    }

    if (!isApiUuid(stay.apiBookingLineId)) {
      const synced = await get().ensureStaySynced(stayId);
      if (!synced.ok) return synced;
    }
    const lineId = get().stays.find((s) => s.id === stayId)?.apiBookingLineId;
    if (!isApiUuid(lineId)) {
      return { ok: false, error: "Stay not synced to API — cannot assign room" };
    }

    /* Ensure API knows this physical room (cold start / skipped hydrate). */
    const inv = await ensureInventoryRemote([room]);
    if (!inv.ok) {
      return { ok: false, error: inv.error };
    }

    const mode = opts?.moveReason
      ? "move"
      : opts?.allowUpgrade && typeMismatch
        ? "upgrade"
        : "assign";
    let remote = await syncAssignRoomRemote({
      bookingLineId: lineId,
      deskRoomId: roomId,
      mode,
      reason: opts?.moveReason,
      dirtyOverridePin: opts?.dirtyOverridePin,
    });
    /* Retry once after full inventory push if API never saw the room. */
    if (
      !remote.ok &&
      /room not found|not found/i.test(remote.error)
    ) {
      await ensureInventoryRemote(get().rooms);
      remote = await syncAssignRoomRemote({
        bookingLineId: lineId,
        deskRoomId: roomId,
        mode,
        reason: opts?.moveReason,
        dirtyOverridePin: opts?.dirtyOverridePin,
      });
    }
    if (!remote.ok) return { ok: false, error: remote.error };

    const auditMsg =
      mode === "upgrade"
        ? `Complimentary upgrade → Rm ${room.number} (${stay.typeCode}→${room.typeCode}, rate kept)`
        : mode === "move"
          ? `Room move → ${room.number} (${(opts?.moveReason ?? "operations").replace("_", " ")})`
          : `Assigned room ${room.number}`;

    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              roomId: room.id,
              roomNumber: room.number,
              typeCode: mode === "upgrade" ? room.typeCode : st.typeCode,
              audit: [audit(auditMsg, actor), ...st.audit],
            },
      ),
      rooms: s.rooms.map((r) =>
        r.id === roomId && stay.status === "checked_in"
          ? { ...r, hkStatus: "occupied" as const }
          : r,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  upgradeRoom: async (stayId, roomId, actor = ACTOR_DEFAULT, opts) => {
    return get().assignRoom(stayId, roomId, actor, {
      allowUpgrade: true,
      dirtyOverridePin: opts?.dirtyOverridePin,
    });
  },

  moveRoom: async ({
    stayId,
    toRoomId,
    reason,
    actor = ACTOR_DEFAULT,
    dirtyOverridePin,
  }) => {
    const stay = get().stays.find((s) => s.id === stayId);
    const room = get().rooms.find((r) => r.id === toRoomId);
    if (!stay || !room) return { ok: false, error: "Stay or room not found" };
    const allowUpgrade = reason === "upgrade" || room.typeCode !== stay.typeCode;
    const assigned = await get().assignRoom(stayId, toRoomId, actor, {
      allowUpgrade,
      moveReason: reason,
      dirtyOverridePin,
    });
    if (!assigned.ok) return assigned;
    set({ moveModal: null });
    return { ok: true };
  },

  extendStay: async ({ stayId, newCheckOut, actor = ACTOR_DEFAULT }) => {
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (newCheckOut <= stay.checkOut) {
      return { ok: false, error: "New checkout must be after current checkout" };
    }
    if (stay.roomId) {
      for (const d of datesBetween(stay.checkOut, newCheckOut)) {
        const clash = roomOccupiedOn(state.stays, stay.roomId, d, stayId);
        if (clash) {
          return {
            ok: false,
            error: `Cannot extend — ${clash.guestName} blocks ${d}`,
          };
        }
        const block = state.roomBlocks.find(
          (b) =>
            b.roomId === stay.roomId &&
            b.fromDate <= d &&
            d < b.toDate,
        );
        if (block) {
          return { ok: false, error: `Cannot extend — room blocked on ${d}` };
        }
      }
    }

    if (!isApiUuid(stay.apiBookingId)) {
      const synced = await get().ensureStaySynced(stayId);
      if (!synced.ok) return synced;
    }
    const bookingId = get().stays.find((s) => s.id === stayId)?.apiBookingId;
    if (!isApiUuid(bookingId)) {
      return { ok: false, error: "Stay not synced to API — cannot extend" };
    }

    const remote = await syncChangeDatesRemote({
      bookingId,
      checkOut: newCheckOut,
    });
    if (!remote.ok) return { ok: false, error: remote.error };

    const fresh = get().stays.find((s) => s.id === stayId);
    if (!fresh) return { ok: false, error: "Stay not found" };
    const room = fresh.roomId
      ? get().rooms.find((r) => r.id === fresh.roomId)
      : undefined;
    const typeName = room?.typeName ?? fresh.typeCode;
    const mealNet = mealPlanNightlyNet(fresh.mealPlan);
    const extraNights = remote.data.addedNights;
    const newLines: FolioLine[] = [];

    /* Post folio only for in-house stays — pre-arrival nights wait for CI / night audit. */
    const extStream = packageStreamForStay(fresh);
    const extFolioId =
      extStream === "master" && isApiUuid(fresh.apiAgencyFolioId)
        ? fresh.apiAgencyFolioId
        : fresh.apiFolioId;
    if (fresh.status === "checked_in" && isApiUuid(extFolioId)) {
      for (const d of extraNights) {
        const roomCharge = await syncPostChargeRemote({
          folioId: extFolioId,
          description: `Room · ${typeName} · ${d} (extension)`,
          netAmount: fresh.nightlyNet,
          kind: "room",
          stream: extStream,
          idempotencyKey: folioNightIdempotencyKey(
            bookingId,
            "room",
            d,
            Math.round(fresh.nightlyNet * 100),
          ),
        });
        if (!roomCharge.ok) return { ok: false, error: roomCharge.error };
        newLines.push({
          id: roomCharge.data.id,
          postedAt: roomCharge.data.postedAt ?? nowIso(),
          kind: "room",
          description: roomCharge.data.description,
          netAmount: roomCharge.data.netAmount,
          scAmount: roomCharge.data.scAmount,
          bstAmount: roomCharge.data.gstAmount,
          totalAmount: roomCharge.data.totalAmount,
          voided: false,
          stream: extStream,
        });
        if (mealNet > 0) {
          const mealCharge = await syncPostChargeRemote({
            folioId: extFolioId,
            description: `${fresh.mealPlan} meal plan · ${d} (extension)`,
            netAmount: mealNet,
            kind: "fb",
            stream: extStream,
            idempotencyKey: folioNightIdempotencyKey(
              bookingId,
              "fb",
              d,
              Math.round(mealNet * 100),
            ),
          });
          if (!mealCharge.ok) return { ok: false, error: mealCharge.error };
          newLines.push({
            id: mealCharge.data.id,
            postedAt: mealCharge.data.postedAt ?? nowIso(),
            kind: "fb",
            description: mealCharge.data.description,
            netAmount: mealCharge.data.netAmount,
            scAmount: mealCharge.data.scAmount,
            bstAmount: mealCharge.data.gstAmount,
            totalAmount: mealCharge.data.totalAmount,
            voided: false,
            stream: extStream,
          });
        }
      }
    }

    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              checkOut: newCheckOut,
              folioLines: [...st.folioLines, ...newLines],
              audit: [
                audit(
                  `Stay extended to ${newCheckOut} (+${extraNights.length} night${extraNights.length === 1 ? "" : "s"})${newLines.length ? " · folio ACK" : ""}`,
                  actor,
                ),
                ...st.audit,
              ],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  shortenStay: async ({ stayId, newCheckOut, actor = ACTOR_DEFAULT }) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (newCheckOut >= stay.checkOut) {
      return { ok: false, error: "New checkout must be before current checkout" };
    }
    if (newCheckOut <= stay.checkIn) {
      return { ok: false, error: "checkOut must be after checkIn" };
    }
    if (!isApiUuid(stay.apiBookingId)) {
      const synced = await get().ensureStaySynced(stayId);
      if (!synced.ok) return synced;
    }
    const bookingId = get().stays.find((s) => s.id === stayId)?.apiBookingId;
    if (!isApiUuid(bookingId)) {
      return { ok: false, error: "Stay not synced to API — cannot shorten" };
    }
    const remote = await syncChangeDatesRemote({
      bookingId,
      checkOut: newCheckOut,
    });
    if (!remote.ok) return { ok: false, error: remote.error };

    const removed = new Set(remote.data.removedNights);
    const fresh = get().stays.find((s) => s.id === stayId) ?? stay;
    const reverseLines: FolioLine[] = [];
    const voidedIds = new Set<string>();
    for (const line of fresh.folioLines) {
      if (!isPackageFolioLine(line)) continue;
      const d = dateFromPackageDesc(line.description);
      if (!d || !removed.has(d) || !isApiUuid(line.id)) continue;
      const folioId =
        line.stream === "master" && isApiUuid(fresh.apiAgencyFolioId)
          ? fresh.apiAgencyFolioId
          : fresh.apiFolioId;
      if (!isApiUuid(folioId)) continue;
      const voided = await syncVoidLineRemote({
        folioId,
        lineId: line.id,
        reason: `Shorten stay · drop ${d}`,
      });
      if (!voided.ok) return { ok: false, error: voided.error };
      voidedIds.add(line.id);
      reverseLines.push({
        id: voided.data.reversalId,
        postedAt: voided.data.postedAt ?? nowIso(),
        kind: "adjustment",
        description: voided.data.description,
        netAmount: voided.data.netAmount,
        scAmount: 0,
        bstAmount: 0,
        totalAmount: voided.data.totalAmount,
        voided: false,
        stream: line.stream,
      });
    }

    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              checkOut: newCheckOut,
              folioLines: [
                ...st.folioLines.map((l) =>
                  voidedIds.has(l.id) ? { ...l, voided: true } : l,
                ),
                ...reverseLines,
              ],
              audit: [
                audit(
                  `Stay shortened to ${newCheckOut} (−${remote.data.removedNights.length} night${remote.data.removedNights.length === 1 ? "" : "s"})${reverseLines.length ? ` · ${reverseLines.length} reversal(s)` : ""}`,
                  actor,
                ),
                ...st.audit,
              ],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  blockRoom: async ({ roomId, fromDate, toDate, blockKind = "ooo", reason }) => {
    if (!deskCan("stayview", "write")) {
      return { ok: false, error: "No StayView write permission" };
    }
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room) return { ok: false, error: "Room not found" };
    const remote = await syncBlockRoomRemote({
      deskRoomId: roomId,
      fromDate,
      toDate,
      blockKind,
      reason,
    });
    if (!remote.ok) return { ok: false, error: remote.error };
    const block: RoomBlock = {
      id: remote.data.id,
      roomId,
      blockKind: remote.data.blockKind,
      fromDate: remote.data.fromDate,
      toDate: remote.data.toDate,
      reason: remote.data.reason,
    };
    set((s) => ({
      roomBlocks: [...s.roomBlocks.filter((b) => b.id !== block.id), block],
      rooms: s.rooms.map((r) =>
        r.id === roomId && blockKind === "ooo"
          ? { ...r, hkStatus: "ooo" as const }
          : r,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true, block };
  },

  releaseRoomBlock: async (blockId) => {
    if (!deskCan("stayview", "write")) {
      return { ok: false, error: "No StayView write permission" };
    }
    const remote = await syncReleaseRoomBlockRemote(blockId);
    if (!remote.ok) return { ok: false, error: remote.error };
    set((s) => {
      const block = s.roomBlocks.find((b) => b.id === blockId);
      return {
        roomBlocks: s.roomBlocks.filter((b) => b.id !== blockId),
        rooms: block
          ? s.rooms.map((r) =>
              r.id === block.roomId && r.hkStatus === "ooo"
                ? { ...r, hkStatus: "dirty" as const }
                : r,
            )
          : s.rooms,
        liveRevision: s.liveRevision + 1,
      };
    });
    return { ok: true };
  },

  checkIn: async (stayId, actor = ACTOR_DEFAULT, opts) => {
    if (get().apiOffline) {
      return { ok: false, error: "API offline — cannot check in" };
    }
    if (!deskCan("desk", "write") && !deskCan("stayview", "write")) {
      return { ok: false, error: "No desk write permission" };
    }
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (!["confirmed", "held"].includes(stay.status)) {
      return { ok: false, error: `Cannot check in from status ${stay.status}` };
    }
    if (!stay.roomId) return { ok: false, error: "Assign a room before check-in" };
    const idGate = assertGuestIdDocument(stay.passportOrCid);
    if (!idGate.ok) {
      return {
        ok: false,
        error: "Capture passport / CID before check-in (document scan)",
      };
    }
    const room = state.rooms.find((r) => r.id === stay.roomId);
    if (!room) return { ok: false, error: "Room missing" };
    if (room.hkStatus === "ooo") return { ok: false, error: "Room is out of order" };
    let dirtyOverridePin = opts?.dirtyOverridePin;
    if (room.hkStatus === "dirty") {
      if (!dirtyOverridePin) {
        return {
          ok: false,
          error: `Rm ${room.number} is dirty — manager PIN to check in`,
          code: "DIRTY_PIN_REQUIRED",
        };
      }
      const pinGate = verifyDeskManagerPin(dirtyOverridePin);
      if (!pinGate.ok) {
        return { ok: false, error: pinGate.error };
      }
      set((s) => ({
        rooms: s.rooms.map((r) =>
          r.id === room.id ? { ...r, hkStatus: "inspected" as const } : r,
        ),
        liveRevision: s.liveRevision + 1,
      }));
      await syncHkStatusRemote({ deskRoomId: room.id, status: "inspected" });
    }
    if (!isApiUuid(stay.apiBookingId)) {
      return { ok: false, error: "Stay not synced to API — cannot check in" };
    }
    /* Push desk HK to API before CI — avoids “dirty on API / inspected on desk” drift. */
    if (room.hkStatus === "clean" || room.hkStatus === "inspected") {
      await syncHkStatusRemote({ deskRoomId: room.id, status: room.hkStatus });
    }
    let remote = await syncCheckInRemote(stay.apiBookingId, {
      dirtyOverridePin,
    });
    if (!remote.ok && /dirty/i.test(remote.error) && !dirtyOverridePin) {
      return {
        ok: false,
        error: remote.error,
        code: "DIRTY_PIN_REQUIRED",
      };
    }
    if (!remote.ok) return { ok: false, error: remote.error };

    // Mark in-house locally so package post targets the right status, then
    // fail closed: package error → API revert check-in.
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              status: "checked_in",
              holdExpiresAt: null,
            },
      ),
      rooms: s.rooms.map((r) =>
        r.id === room.id ? { ...r, hkStatus: "occupied" as const } : r,
      ),
      liveRevision: s.liveRevision + 1,
    }));

    const pkg = await get().ensurePackageChargesPosted(stayId, actor);
    if (!pkg.ok) {
      const reverted = await syncRevertCheckInRemote(stay.apiBookingId);
      set((s) => ({
        stays: s.stays.map((st) =>
          st.id !== stayId
            ? st
            : {
                ...st,
                status: "confirmed",
                audit: [
                  audit(
                    `Check-in rolled back — package post failed: ${pkg.error}`,
                    actor,
                  ),
                  ...st.audit,
                ],
              },
        ),
        rooms: s.rooms.map((r) =>
          r.id === room.id ? { ...r, hkStatus: "inspected" as const } : r,
        ),
        liveRevision: s.liveRevision + 1,
      }));
      if (!reverted.ok) {
        return {
          ok: false,
          error: `${pkg.error} (also failed to revert CI: ${reverted.error})`,
        };
      }
      return { ok: false, error: pkg.error };
    }

    void syncHkStatusRemote({ deskRoomId: room.id, status: "inspected" });
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              audit: [audit(`Checked in to ${room.number}`, actor), ...st.audit],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));

    return { ok: true };
  },

  ensurePackageChargesPosted: async (stayId, actor = ACTOR_DEFAULT) => {
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    /* checked_out allowed — desk may rebuild package after departure for bill fixes. */
    if (!["checked_in", "confirmed", "held", "checked_out"].includes(stay.status)) {
      return { ok: false, error: `Cannot post package from status ${stay.status}` };
    }
    const room = stay.roomId
      ? state.rooms.find((r) => r.id === stay.roomId)
      : undefined;
    const typeName = room?.typeName ?? roomTypeNameForStay(state.rooms, stay);
    const packageLines = buildStayPackageFolioLines(stay, typeName);
    if (packageLines.length === 0) return { ok: true, posted: 0 };

    let agencyFolioId = stay.apiAgencyFolioId;
    const needsAgency =
      Boolean(stay.groupId) || stay.source === "agent";
    if (needsAgency && !isApiUuid(agencyFolioId) && isApiUuid(stay.apiBookingId)) {
      const ensured = await syncEnsureAgencyFolioRemote(stay.apiBookingId);
      if (!ensured.ok) return { ok: false, error: ensured.error };
      agencyFolioId = ensured.agencyFolioId;
    }

    const bookingKey = stay.apiBookingId ?? stay.id;
    const ackByDesc = new Map<string, FolioLine>();
    let posted = 0;
    for (const pl of packageLines) {
      const targetFolio =
        pl.stream === "master" && isApiUuid(agencyFolioId)
          ? agencyFolioId
          : stay.apiFolioId;
      if (!isApiUuid(targetFolio)) {
        return { ok: false, error: "API folio missing — cannot post package charges" };
      }
      const d = dateFromPackageDesc(pl.description) ?? stay.checkIn;
      const kindKey: "room" | "fb" | "extra" = isExtraBedFolioLine(pl)
        ? "extra"
        : isMealPlanFolioLine(pl)
          ? "fb"
          : "room";
      const charge = await syncPostChargeRemote({
        folioId: targetFolio,
        description: pl.description,
        netAmount: pl.netAmount,
        kind: pl.kind,
        stream: pl.stream,
        idempotencyKey: folioNightIdempotencyKey(
          bookingKey,
          kindKey,
          d,
          Math.round(pl.netAmount * 100),
        ),
      });
      if (!charge.ok) return { ok: false, error: charge.error };
      posted += 1;
      ackByDesc.set(pl.description, {
        id: charge.data.id,
        postedAt: charge.data.postedAt ?? nowIso(),
        kind: pl.kind,
        description: charge.data.description,
        netAmount: charge.data.netAmount,
        scAmount: charge.data.scAmount,
        bstAmount: charge.data.gstAmount,
        totalAmount: charge.data.totalAmount,
        voided: false,
        stream: pl.stream,
      });
    }

    const ackLines = [...ackByDesc.values()];
    set((s) => ({
      stays: s.stays.map((st) => {
        if (st.id !== stayId) return st;
        const existingIds = new Set(st.folioLines.map((l) => l.id));
        const fresh = ackLines.filter((l) => !existingIds.has(l.id));
        const voidedPkg = st.folioLines.map((l) =>
          isPackageFolioLine(l) &&
          ackByDesc.has(l.description) &&
          !ackLines.some((a) => a.id === l.id)
            ? { ...l, voided: true }
            : l,
        );
        return {
          ...st,
          apiAgencyFolioId: agencyFolioId ?? st.apiAgencyFolioId,
          folioLines: [...voidedPkg, ...fresh],
          audit:
            fresh.length > 0
              ? [
                  audit(
                    `Package posted · ${fresh.length} line(s) → ${
                      isApiUuid(agencyFolioId) ? "agency master" : "guest folio"
                    }`,
                    actor,
                  ),
                  ...st.audit,
                ]
              : st.audit,
        };
      }),
      liveRevision: s.liveRevision + 1,
    }));

    return { ok: true, posted };
  },

  revertCheckIn: async (stayId, actor = ACTOR_DEFAULT) => {
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (stay.status !== "checked_in") {
      return { ok: false, error: "Only in-house stays can undo check-in" };
    }

    /* API voids package lines + restores confirmed; then mirror cache. */
    if (isApiUuid(stay.apiBookingId)) {
      const remote = await syncRevertCheckInRemote(stay.apiBookingId);
      if (!remote.ok) return { ok: false, error: remote.error };
    }

    const reverseLines: FolioLine[] = [];
    const voidedIds = new Set<string>();
    const fresh = get().stays.find((s) => s.id === stayId) ?? stay;
    for (const line of fresh.folioLines) {
      if (!isPackageFolioLine(line) || !isApiUuid(line.id)) continue;
      const folioId =
        line.stream === "master" && isApiUuid(fresh.apiAgencyFolioId)
          ? fresh.apiAgencyFolioId
          : fresh.apiFolioId;
      if (!isApiUuid(folioId)) {
        voidedIds.add(line.id);
        continue;
      }
      const voided = await syncVoidLineRemote({
        folioId,
        lineId: line.id,
        reason: "Revert check-in · package reversal",
      });
      if (!voided.ok) return { ok: false, error: voided.error };
      voidedIds.add(line.id);
      if (!fresh.folioLines.some((l) => l.id === voided.data.reversalId)) {
        reverseLines.push({
          id: voided.data.reversalId,
          postedAt: voided.data.postedAt ?? nowIso(),
          kind: "adjustment",
          description: voided.data.description,
          netAmount: voided.data.netAmount,
          scAmount: 0,
          bstAmount: 0,
          totalAmount: voided.data.totalAmount,
          voided: false,
          stream: line.stream,
        });
      }
    }

    const roomId = fresh.roomId;
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              status: "confirmed",
              folioLines: [
                ...st.folioLines.map((l) =>
                  voidedIds.has(l.id) ? { ...l, voided: true } : l,
                ),
                ...reverseLines,
              ],
              audit: [
                audit(
                  `Check-in undone${reverseLines.length || voidedIds.size ? ` · ${voidedIds.size} package line(s) reversed` : ""}`,
                  actor,
                ),
                ...st.audit,
              ],
            },
      ),
      rooms: s.rooms.map((r) =>
        roomId && r.id === roomId
          ? { ...r, hkStatus: "clean" as const }
          : r,
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  checkOut: async (stayId, actor = ACTOR_DEFAULT) => {
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (stay.status !== "checked_in") {
      return { ok: false, error: "Only in-house stays can check out" };
    }
    if (!isApiUuid(stay.apiBookingId)) {
      return { ok: false, error: "Stay not synced to API — cannot check out" };
    }
    const gate = await syncCheckoutGateRemote(stay.apiBookingId);
    if (!gate.ok) {
      const personalBal = folioBalance(stay, "personal");
      return {
        ok: false,
        error:
          gate.error === "CHECKOUT_PERSONAL_BALANCE"
            ? `Checkout blocked: Guest has unpaid personal balance of Nu. ${personalBal.toLocaleString("en-BT")}. Master credit cannot cover incidentals.`
            : gate.error,
      };
    }
    const remote = await syncCheckOutRemote(stay.apiBookingId);
    if (!remote.ok) return { ok: false, error: remote.error };

    const roomId = stay.roomId;
    if (roomId) {
      void syncHkStatusRemote({ deskRoomId: roomId, status: "dirty" });
    }
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              status: "checked_out",
              roomId: null,
              audit: [audit("Checked out — folio closed", actor), ...st.audit],
            },
      ),
      rooms: s.rooms.map((r) =>
        r.id === roomId ? { ...r, hkStatus: "dirty" as const } : r,
      ),
      liveRevision: s.liveRevision + 1,
    }));

    return { ok: true };
  },

  cancelStay: async (stayId, actor = ACTOR_DEFAULT) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (["checked_in", "checked_out", "cancelled"].includes(stay.status)) {
      return {
        ok: false,
        error:
          stay.status === "cancelled"
            ? "Already cancelled"
            : "Cannot cancel an in-house or departed stay — check out or void folio first",
      };
    }
    if (!isApiUuid(stay.apiBookingId)) {
      const synced = await get().ensureStaySynced(stayId);
      if (!synced.ok) return synced;
    }
    const bookingId = get().stays.find((s) => s.id === stayId)?.apiBookingId;
    if (!isApiUuid(bookingId)) {
      return { ok: false, error: "Stay not synced to API — cannot cancel" };
    }
    const remote = await syncCancelRemote(bookingId);
    if (!remote.ok) return { ok: false, error: remote.error };
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              status: "cancelled",
              roomId: null,
              roomNumber: st.roomNumber,
              audit: [audit("Reservation cancelled", actor), ...st.audit],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  cancelGroup: async (groupId, actor = ACTOR_DEFAULT) => {
    const peers = groupMembers(get().stays, groupId);
    if (peers.length === 0) return { ok: false, error: "Group has no stays" };
    let cancelled = 0;
    const blocked: string[] = [];
    for (const peer of peers) {
      if (peer.status === "cancelled") continue;
      if (["checked_in", "checked_out"].includes(peer.status)) {
        blocked.push(
          `${peer.roomNumber ?? peer.guestName}: ${peer.status.replace("_", " ")}`,
        );
        continue;
      }
      const res = await get().cancelStay(peer.id, actor);
      if (res.ok) cancelled += 1;
      else blocked.push(`${peer.guestName}: ${res.error}`);
    }
    if (cancelled === 0 && blocked.length > 0) {
      return { ok: false, error: blocked[0] ?? "Nothing cancelled" };
    }
    return { ok: true, cancelled, blocked };
  },

  confirmHold: async (stayId, actor = ACTOR_DEFAULT) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (stay.status !== "held") return { ok: false, error: "Not a hold" };
    if (!isApiUuid(stay.apiBookingId)) {
      return { ok: false, error: "Stay not synced to API — cannot confirm" };
    }
    const remote = await syncConfirmHoldRemote(stay.apiBookingId);
    if (!remote.ok) return { ok: false, error: remote.error };
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              status: "confirmed",
              holdExpiresAt: null,
              audit: [audit("Hold confirmed", actor), ...st.audit],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  settleFolio: async ({
    stayId,
    method,
    amount,
    actor = ACTOR_DEFAULT,
    pinConfirmed,
    stream = "personal",
  }) => {
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (amount <= 0) return { ok: false, error: "Amount must be positive" };
    const bal = folioBalance(stay, stream);
    if (amount > bal + 0.01) {
      return {
        ok: false,
        error: `Amount exceeds ${stream} balance Nu. ${bal.toLocaleString()}`,
      };
    }
    if (method === "city_ledger" && !pinConfirmed) {
      return { ok: false, error: "City ledger transfer requires manager PIN confirm" };
    }
    const payStream: FolioStream =
      method === "city_ledger" ? "master" : stream;
    const folioId =
      payStream === "master" && isApiUuid(stay.apiAgencyFolioId)
        ? stay.apiAgencyFolioId
        : stay.apiFolioId;
    if (!isApiUuid(folioId)) {
      return { ok: false, error: "API folio missing — cannot settle" };
    }
    const labels: Record<TenderMethod, string> = {
      cash: "Cash",
      card: "Credit Card",
      rma_qr: "RMA Bhutan QR (mBoB)",
      city_ledger: "City Ledger · Agent",
    };
    const remote = await syncPostPaymentRemote({
      folioId,
      amount,
      method,
      idempotencyKey: newIdempotencyKey(),
    });
    if (!remote.ok) {
      if (remote.error === "API_UNREACHABLE") set({ apiOffline: true });
      return { ok: false, error: remote.error };
    }
    if (get().apiOffline) set({ apiOffline: false });
    const receiptNo = allocateReceiptNo();
    const line: FolioLine = {
      id: remote.data.paymentId,
      postedAt: remote.data.postedAt ?? nowIso(),
      kind: "payment",
      description: `${labels[method]} · ${receiptNo}`,
      netAmount: remote.data.netAmount,
      scAmount: 0,
      bstAmount: 0,
      totalAmount: remote.data.totalAmount,
      voided: false,
      stream: payStream,
    };
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              folioLines: [...st.folioLines, line],
              audit: [
                audit(
                  `Payment Nu. ${amount.toLocaleString()} via ${labels[method]} (${receiptNo}) · ${payStream}`,
                  actor,
                ),
                ...st.audit,
              ],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true, receiptNo };
  },

  postCharge: async (stayId, description, netAmount, kind, actor = ACTOR_DEFAULT, stream) => {
    if (get().apiOffline) {
      return { ok: false, error: "API offline — cannot post charge" };
    }
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (["cancelled", "no_show"].includes(stay.status)) {
      return { ok: false, error: "Cannot post charges on cancelled / no-show stays" };
    }
    if (!["checked_in", "checked_out", "confirmed", "held"].includes(stay.status)) {
      return { ok: false, error: `Cannot post charges from status ${stay.status}` };
    }
    const resolved = stream ?? defaultStreamForKind(kind);
    const folioId =
      resolved === "master" && isApiUuid(stay.apiAgencyFolioId)
        ? stay.apiAgencyFolioId
        : stay.apiFolioId;
    if (!isApiUuid(folioId)) {
      return { ok: false, error: "API folio missing — cannot post charge" };
    }
    const bookingKey = stay.apiBookingId ?? stayId;
    const remote = await syncPostChargeRemote({
      folioId,
      description,
      netAmount,
      kind,
      stream: resolved,
      idempotencyKey: commandIdempotencyKey(
        "charge",
        bookingKey,
        kind,
        description,
        String(Math.round(netAmount * 100)),
      ),
    });
    if (!remote.ok) return { ok: false, error: remote.error };
    if (stay.folioLines.some((l) => l.id === remote.data.id)) {
      return { ok: true };
    }
    const line: FolioLine = {
      id: remote.data.id,
      postedAt: remote.data.postedAt ?? nowIso(),
      kind,
      description: remote.data.description,
      netAmount: remote.data.netAmount,
      scAmount: remote.data.scAmount,
      bstAmount: remote.data.gstAmount,
      totalAmount: remote.data.totalAmount,
      voided: false,
      stream: resolved,
    };
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              folioLines: [...st.folioLines, line],
              audit: [
                audit(
                  `Posted ${kind}/${resolved}: ${description} (net Nu. ${netAmount})`,
                  actor,
                ),
                ...st.audit,
              ],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  voidFolioLine: async (stayId, lineId, pinConfirmed, actor = ACTOR_DEFAULT) => {
    if (!pinConfirmed) {
      return { ok: false, error: "Manager PIN required to void folio line" };
    }
    const stay = get().stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    const line = stay.folioLines.find((l) => l.id === lineId);
    if (!line) return { ok: false, error: "Line not found" };
    if (line.voided) return { ok: false, error: "Line already voided" };
    if (line.kind === "payment") {
      return { ok: false, error: "Payments cannot be voided — post a reversal" };
    }
    const folioId =
      line.stream === "master" && isApiUuid(stay.apiAgencyFolioId)
        ? stay.apiAgencyFolioId
        : stay.apiFolioId;
    if (!isApiUuid(folioId) || !isApiUuid(lineId)) {
      return { ok: false, error: "API folio/line required for append-only void" };
    }
    const remote = await syncVoidLineRemote({
      folioId,
      lineId,
      reason: "Desk void with manager PIN",
    });
    if (!remote.ok) return { ok: false, error: remote.error };
    const reversal: FolioLine = {
      id: remote.data.reversalId,
      postedAt: remote.data.postedAt ?? nowIso(),
      kind: "adjustment",
      description: remote.data.description,
      netAmount: remote.data.netAmount,
      scAmount: 0,
      bstAmount: 0,
      totalAmount: remote.data.totalAmount,
      voided: false,
      stream: line.stream,
    };
    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId
          ? st
          : {
              ...st,
              folioLines: [
                ...st.folioLines.map((l) =>
                  l.id === lineId ? { ...l, voided: true } : l,
                ),
                reversal,
              ],
              audit: [
                audit(
                  `Reversal · ${line.description} (${formatNu(line.totalAmount)}) · PIN audit`,
                  actor,
                ),
                ...st.audit,
              ],
            },
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  updateStayRate: async (stayId, patch, actor = ACTOR_DEFAULT) => {
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    if (!stay) return { ok: false, error: "Stay not found" };
    if (["cancelled", "no_show"].includes(stay.status)) {
      return { ok: false, error: "Cannot edit rate on cancelled / no-show stay" };
    }
    if (patch.nightlyNet != null && patch.nightlyNet < 0) {
      return { ok: false, error: "Nightly net must be ≥ 0" };
    }

    /* In-house + departed: void package lines remotely, then rebuild. */
    if (stay.status === "checked_in" || stay.status === "checked_out") {
      const reverseLines: FolioLine[] = [];
      const voidedIds = new Set<string>();
      for (const line of stay.folioLines) {
        if (!isPackageFolioLine(line) || !isApiUuid(line.id)) continue;
        const folioId =
          line.stream === "master" && isApiUuid(stay.apiAgencyFolioId)
            ? stay.apiAgencyFolioId
            : stay.apiFolioId;
        if (!isApiUuid(folioId)) continue;
        const voided = await syncVoidLineRemote({
          folioId,
          lineId: line.id,
          reason: "Package rebuild · rate/meal change",
        });
        if (!voided.ok) return { ok: false, error: voided.error };
        voidedIds.add(line.id);
        reverseLines.push({
          id: voided.data.reversalId,
          postedAt: voided.data.postedAt ?? nowIso(),
          kind: "adjustment",
          description: voided.data.description,
          netAmount: voided.data.netAmount,
          scAmount: 0,
          bstAmount: 0,
          totalAmount: voided.data.totalAmount,
          voided: false,
          stream: line.stream,
        });
      }
      set((s) => ({
        stays: s.stays.map((st) => {
          if (st.id !== stayId) return st;
          const nextMeal = patch.mealPlan ?? st.mealPlan;
          const nextNet = patch.nightlyNet ?? st.nightlyNet;
          const nextPlans =
            patch.dailyPlans ??
            (st.dailyPlans
              ? st.dailyPlans.map((d) => ({
                  ...d,
                  mealPlan: patch.mealPlan ?? d.mealPlan,
                  nightlyNet: patch.nightlyNet ?? d.nightlyNet,
                }))
              : undefined);
          return {
            ...st,
            mealPlan: nextMeal,
            nightlyNet: nextNet,
            dailyPlans: nextPlans,
            folioLines: [
              ...st.folioLines.map((l) =>
                voidedIds.has(l.id) ? { ...l, voided: true } : l,
              ),
              ...reverseLines,
            ],
            audit: [
              audit(
                `Rate/meal → ledger rebuild · ${nextMeal} · ${formatNu(nextNet)}/night`,
                actor,
              ),
              ...st.audit,
            ],
          };
        }),
        liveRevision: s.liveRevision + 1,
      }));
      const posted = await get().ensurePackageChargesPosted(stayId, actor);
      if (!posted.ok) return { ok: false, error: posted.error };
      return { ok: true };
    }

    set((s) => ({
      stays: s.stays.map((st) =>
        st.id !== stayId ? st : syncPackageFolio(st, s.rooms, patch, actor),
      ),
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true };
  },

  upsertGroupMeta: (meta) => {
    set((s) => ({
      groupMeta: { ...s.groupMeta, [meta.id]: meta },
    }));
  },

  applyGroupMealPlan: async (groupId, mealPlan, actor = ACTOR_DEFAULT) => {
    const members = groupMembers(get().stays, groupId).filter(
      (s) => !["cancelled", "no_show"].includes(s.status),
    );
    if (members.length === 0) {
      return { ok: false, error: "No active stays in this group" };
    }
    set((s) => ({
      groupMeta: s.groupMeta[groupId]
        ? {
            ...s.groupMeta,
            [groupId]: { ...s.groupMeta[groupId]!, mealPlan },
          }
        : s.groupMeta,
    }));
    for (const m of members) {
      const res = await get().updateStayRate(
        m.id,
        {
          mealPlan,
          dailyPlans: m.dailyPlans?.map((d) => ({ ...d, mealPlan })),
        },
        actor,
      );
      if (!res.ok) return { ok: false, error: `${m.guestName}: ${res.error}` };
    }
    return { ok: true, updated: members.length };
  },

  applyGroupNightlyNet: async (groupId, nightlyNet, actor = ACTOR_DEFAULT) => {
    if (nightlyNet < 0) return { ok: false, error: "Nightly net must be ≥ 0" };
    const members = groupMembers(get().stays, groupId).filter(
      (s) => !["cancelled", "no_show"].includes(s.status),
    );
    if (members.length === 0) {
      return { ok: false, error: "No active stays in this group" };
    }
    set((s) => {
      const prevMeta = s.groupMeta[groupId];
      return {
        groupMeta: prevMeta
          ? {
              ...s.groupMeta,
              [groupId]: {
                ...prevMeta,
                rateMode: "uniform" as const,
                uniformNightlyNet: nightlyNet,
              },
            }
          : s.groupMeta,
        liveRevision: s.liveRevision + 1,
      };
    });
    for (const m of members) {
      const res = await get().updateStayRate(
        m.id,
        {
          nightlyNet,
          dailyPlans: m.dailyPlans?.map((d) => ({ ...d, nightlyNet })),
        },
        actor,
      );
      if (!res.ok) return { ok: false, error: `${m.guestName}: ${res.error}` };
    }
    return { ok: true, updated: members.length };
  },

  applyGroupDailyPlans: async (groupId, dailyPlans, actor = ACTOR_DEFAULT) => {
    if (dailyPlans.length === 0) {
      return { ok: false, error: "Daily plan is empty" };
    }
    const members = groupMembers(get().stays, groupId).filter(
      (s) => !["cancelled", "no_show"].includes(s.status),
    );
    if (members.length === 0) {
      return { ok: false, error: "No active stays in this group" };
    }
    const mealPlan = dailyPlans[0]!.mealPlan;
    const nightlyNet = dailyPlans[0]!.nightlyNet;
    for (const m of members) {
      const dates = datesBetween(m.checkIn, m.checkOut);
      const byDate = new Map(dailyPlans.map((p) => [p.date, p]));
      const aligned = dates.map((d) => {
        const ex = byDate.get(d);
        return {
          date: d,
          nightlyNet: ex?.nightlyNet ?? nightlyNet,
          mealPlan: ex?.mealPlan ?? mealPlan,
          extraBed: Boolean(ex?.extraBed),
        };
      });
      const res = await get().updateStayRate(
        m.id,
        { mealPlan, nightlyNet, dailyPlans: aligned },
        actor,
      );
      if (!res.ok) return { ok: false, error: `${m.guestName}: ${res.error}` };
    }
    set((s) => ({
      groupMeta: s.groupMeta[groupId]
        ? {
            ...s.groupMeta,
            [groupId]: {
              ...s.groupMeta[groupId]!,
              mealPlan,
              rateMode: "uniform" as const,
              uniformNightlyNet: nightlyNet,
            },
          }
        : s.groupMeta,
      liveRevision: s.liveRevision + 1,
    }));
    return { ok: true, updated: members.length };
  },

  checkInGroup: async (groupId, actor = ACTOR_DEFAULT, opts) => {
    const members = groupMembers(get().stays, groupId).filter((s) =>
      ["confirmed", "held"].includes(s.status),
    );
    if (members.length === 0) {
      return { ok: false, error: "No confirmed/held stays ready to check in" };
    }
    const unassigned = members.filter((m) => !m.roomId);
    if (unassigned.length > 0) {
      return {
        ok: false,
        error: `Assign rooms first — ${unassigned.length} of ${members.length} still unassigned`,
      };
    }
    const rooms = get().rooms;
    const dirtyRooms = members
      .map((m) => {
        const room = m.roomId ? rooms.find((r) => r.id === m.roomId) : undefined;
        return room?.hkStatus === "dirty" ? room.number : null;
      })
      .filter((n): n is string => Boolean(n));
    if (dirtyRooms.length > 0 && !opts?.dirtyOverridePin) {
      return {
        ok: false,
        error: `Dirty room(s) · Rm ${dirtyRooms.join(", ")} — manager PIN to check in party`,
        code: "DIRTY_PIN_REQUIRED",
        dirtyRooms,
      };
    }
    if (opts?.dirtyOverridePin && dirtyRooms.length > 0) {
      const pinGate = verifyDeskManagerPin(opts.dirtyOverridePin);
      if (!pinGate.ok) {
        return { ok: false, error: pinGate.error, code: "DIRTY_PIN_REQUIRED" };
      }
      /* Clear dirty before CI loop so peers don't re-trip the HK gate. */
      const dirtyRoomIds = members
        .map((m) => {
          const room = m.roomId ? rooms.find((r) => r.id === m.roomId) : undefined;
          return room?.hkStatus === "dirty" ? room.id : null;
        })
        .filter((id): id is string => Boolean(id));
      if (dirtyRoomIds.length > 0) {
        set((s) => ({
          rooms: s.rooms.map((r) =>
            dirtyRoomIds.includes(r.id)
              ? { ...r, hkStatus: "inspected" as const }
              : r,
          ),
          liveRevision: s.liveRevision + 1,
        }));
        await Promise.all(
          dirtyRoomIds.map((roomId) =>
            syncHkStatusRemote({ deskRoomId: roomId, status: "inspected" }),
          ),
        );
      }
    }
    const lead =
      (opts?.leadStayId
        ? members.find((m) => m.id === opts.leadStayId)
        : undefined) ??
      members.find((m) => assertGuestIdDocument(m.passportOrCid).ok) ??
      members[0];
    if (!lead) {
      return { ok: false, error: "No stay available for party check-in" };
    }
    const leadGate = assertGuestIdDocument(lead.passportOrCid);
    if (!leadGate.ok) {
      return {
        ok: false,
        error: "Capture lead guest passport / CID before party check-in",
        code: "LEAD_ID_REQUIRED",
      };
    }
    const deferredToken = `PARTY:${leadGate.documentRef}`.slice(0, 64);
    const blocked: string[] = [];
    let checkedIn = 0;
    for (const m of members) {
      if (!m.roomId) {
        blocked.push(`${m.guestName}: Assign a room before check-in`);
        continue;
      }
      const idOk = assertGuestIdDocument(m.passportOrCid);
      if (!idOk.ok || isDeferredPartyId(m.passportOrCid)) {
        set((s) => ({
          stays: s.stays.map((st) =>
            st.id !== m.id
              ? st
              : {
                  ...st,
                  passportOrCid: deferredToken,
                  audit: [
                    audit(
                      `Group CI · ID deferred (lead ${leadGate.documentRef})`,
                      actor,
                    ),
                    ...st.audit,
                  ],
                },
          ),
        }));
      }
      const res = await get().checkIn(m.id, actor, {
        dirtyOverridePin: opts?.dirtyOverridePin,
      });
      if (res.ok) checkedIn += 1;
      else blocked.push(`${m.guestName}: ${res.error}`);
    }
    if (checkedIn === 0) {
      return {
        ok: false,
        error: blocked[0] ?? "Party check-in blocked — see room HK / sync",
      };
    }
    return { ok: true, checkedIn, blocked };
  },

  settleGroupMaster: async (groupId, input) => {
    const members = groupMembers(get().stays, groupId);
    if (members.length === 0) {
      return { ok: false, error: "No stays in this group" };
    }
    if (input.method === "city_ledger" && !input.pinConfirmed) {
      return { ok: false, error: "City ledger transfer requires manager PIN confirm" };
    }
    const actor = input.actor ?? ACTOR_DEFAULT;
    const blocked: string[] = [];
    let settled = 0;
    let totalAmount = 0;
    for (const m of members) {
      const due = folioBalance(m, "master");
      if (due <= 0.5) continue;
      const res = await get().settleFolio({
        stayId: m.id,
        method: input.method,
        amount: due,
        actor,
        pinConfirmed: input.pinConfirmed,
        stream: "master",
      });
      if (res.ok) {
        settled += 1;
        totalAmount += due;
      } else {
        blocked.push(`${m.guestName}: ${res.error}`);
      }
    }
    if (settled === 0 && blocked.length > 0) {
      return { ok: false, error: blocked[0] ?? "Group settle failed" };
    }
    if (settled === 0) {
      return { ok: false, error: "No agency / master balance to settle" };
    }
    return { ok: true, settled, totalAmount, blocked };
  },

  stripGstFromOpenBills: async (actor = ACTOR_DEFAULT) => {
    const open = get().stays.filter(
      (s) => !["checked_out", "cancelled", "no_show"].includes(s.status),
    );
    let linesReposted = 0;
    let staysTouched = 0;

    for (const st of open) {
      const withGst = st.folioLines.filter(
        (l) =>
          !l.voided &&
          l.kind !== "payment" &&
          l.kind !== "adjustment" &&
          l.bstAmount > 0 &&
          isApiUuid(l.id),
      );
      if (withGst.length === 0) continue;

      const reverseLines: FolioLine[] = [];
      const voidedIds = new Set<string>();
      const rebuilt: FolioLine[] = [];

      for (const line of withGst) {
        const folioId =
          line.stream === "master" && isApiUuid(st.apiAgencyFolioId)
            ? st.apiAgencyFolioId
            : st.apiFolioId;
        if (!isApiUuid(folioId)) {
          return {
            ok: false,
            error: `${st.guestName}: API folio missing for GST strip`,
          };
        }
        const voided = await syncVoidLineRemote({
          folioId,
          lineId: line.id,
          reason: "GST strip · SC-only tax policy",
        });
        if (!voided.ok) return { ok: false, error: voided.error };
        voidedIds.add(line.id);
        reverseLines.push({
          id: voided.data.reversalId,
          postedAt: voided.data.postedAt ?? nowIso(),
          kind: "adjustment",
          description: voided.data.description,
          netAmount: voided.data.netAmount,
          scAmount: 0,
          bstAmount: 0,
          totalAmount: voided.data.totalAmount,
          voided: false,
          stream: line.stream,
        });

        const bookingKey = st.apiBookingId ?? st.id;
        const charge = await syncPostChargeRemote({
          folioId,
          description: `${line.description} · SC-only`,
          netAmount: line.netAmount,
          kind: line.kind,
          stream: line.stream,
          idempotencyKey: commandIdempotencyKey(
            "gst-strip",
            bookingKey,
            line.id,
            String(Math.round(line.netAmount * 100)),
          ),
        });
        if (!charge.ok) return { ok: false, error: charge.error };
        linesReposted += 1;
        rebuilt.push({
          id: charge.data.id,
          postedAt: charge.data.postedAt ?? nowIso(),
          kind: line.kind,
          description: charge.data.description,
          netAmount: charge.data.netAmount,
          scAmount: charge.data.scAmount,
          bstAmount: charge.data.gstAmount,
          totalAmount: charge.data.totalAmount,
          voided: false,
          stream: line.stream,
        });
      }

      staysTouched += 1;
      set((s) => ({
        stays: s.stays.map((x) =>
          x.id !== st.id
            ? x
            : {
                ...x,
                folioLines: [
                  ...x.folioLines.map((l) =>
                    voidedIds.has(l.id) ? { ...l, voided: true } : l,
                  ),
                  ...reverseLines,
                  ...rebuilt,
                ],
                audit: [
                  audit(
                    `GST stripped from ${withGst.length} folio line(s) · SC-only (API ACK)`,
                    actor,
                  ),
                  ...x.audit,
                ],
              },
        ),
        liveRevision: s.liveRevision + 1,
      }));
    }

    const after = get().stays.filter(
      (s) => !["checked_out", "cancelled", "no_show"].includes(s.status),
    );
    const touched = after.filter((s) =>
      s.audit[0]?.message.startsWith("GST stripped"),
    ).length;
    return {
      ok: true as const,
      stays: staysTouched || touched,
      linesReposted,
    };
  },
}));

/* Multi-tab notify + revision tick when stay/room inventories change. */
let foTabPublishTimer: ReturnType<typeof setTimeout> | null = null;
let foBumpScheduled = false;
useFrontOfficeStore.subscribe((state, prev) => {
  if (state.stays === prev.stays && state.rooms === prev.rooms) return;
  if (!foBumpScheduled && state.liveRevision === prev.liveRevision) {
    foBumpScheduled = true;
    queueMicrotask(() => {
      foBumpScheduled = false;
      const cur = useFrontOfficeStore.getState();
      useFrontOfficeStore.setState({ liveRevision: cur.liveRevision + 1 });
    });
  }
  if (foTabPublishTimer) clearTimeout(foTabPublishTimer);
  foTabPublishTimer = setTimeout(() => {
    void import("./live-sync")
      .then(({ publishFoTabPatch }) => {
        publishFoTabPatch(useFrontOfficeStore.getState().liveRevision);
      })
      .catch((err) => {
        console.warn("[fo] tab publish skipped", err);
      });
  }, 48);
});

export function stayOnDate(stay: Stay, date: string): boolean {
  /* History must paint on StayView — checked_out still occupied its nights. */
  if (["cancelled", "no_show"].includes(stay.status)) return false;
  return stay.checkIn <= date && date < stay.checkOut && Boolean(stay.roomId);
}

export function formatNu(n: number): string {
  return `Nu. ${Math.round(n).toLocaleString("en-BT")}`;
}
