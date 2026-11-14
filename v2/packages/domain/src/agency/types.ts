/** Travel Agent OS — pure domain types (M02). No I/O. */

export type ShareTier = "agency" | "guest" | "guide" | "driver" | "hotel";

export const SHARE_TIERS: readonly ShareTier[] = [
  "agency",
  "guest",
  "guide",
  "driver",
  "hotel",
] as const;

export type BudgetLineKind =
  | "sdf"
  | "hotel"
  | "guide"
  | "vehicle"
  | "entry"
  | "misc"
  | "sell";

export type BudgetLine = {
  id: string;
  kind: BudgetLineKind;
  label: string;
  qty: number;
  unitChh: number;
  amountChh: number;
  isClientVisible: boolean;
};

export type TripStaySlice = {
  id: string;
  propertyId: string;
  propertyName: string;
  roomTypeName: string;
  roomNumbers: string[];
  checkIn: string;
  checkOut: string;
  mealPlan: "EP" | "CP" | "MAP" | "AP" | string;
  nightlyNetRateChh: number | null;
};

export type TripDaySlice = {
  dayIndex: number;
  date: string;
  title: string;
  narrative: string;
  overnightDzongkhag: string | null;
};

export type TripStaffSlice = {
  guideName: string | null;
  guidePhone: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehiclePlate: string | null;
};

export type AgencyTripRecord = {
  id: string;
  code: string;
  clientName: string;
  paxAdults: number;
  paxChildren: number;
  dietaryNotes: string | null;
  arrivalFlight: string | null;
  days: TripDaySlice[];
  stays: TripStaySlice[];
  staff: TripStaffSlice;
  budgetLines: BudgetLine[];
  clientGrossSellChh: number | null;
  sdfTotalChh: number | null;
  passportDocUrls: string[];
};

export type ProjectShareOptions = {
  /** Hotel tier: omit nightly nets. Default true. */
  hideRates?: boolean;
  /** Hotel tier: only stays for this property. */
  propertyIdFilter?: string;
};

export type TripMarginResult = {
  costChh: number;
  sellChh: number;
  marginChh: number;
  /** Basis points: 5000 = 50.00%. Zero when sellChh === 0. */
  marginBps: number;
};
