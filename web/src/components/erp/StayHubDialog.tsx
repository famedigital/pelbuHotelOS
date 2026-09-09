"use client";

import {
  resizeCalendarAssignment,
  splitCalendarAssignment,
  updateCalendarReservationDetails,
  setCalendarAssignmentLock,
} from "@/app/actions/erp-calendar";
import {
  fetchStayHubCatalog,
  fetchStayHubCheckIn,
  fetchStayHubMoney,
  fetchStayHubOpen,
  fetchStayHubPartyContext,
  fetchStayHubSummary,
  previewStayHubSheetRate,
  type StayHubCatalogMealPlan,
  type StayHubCheckInPayload,
  type StayHubMoneyPayload,
  type StayHubPartyContext,
  type StayHubPartyMember,
  type StayHubSummary,
} from "@/app/actions/stay-hub";
import { undoCheckIn } from "@/app/actions/erp-checkin";
import type { CalendarAgent } from "@/components/erp/CalendarReservationDialog";
import { AgentPicker } from "@/components/erp/AgentPicker";
import { StaffPicker, type BookableStaff } from "@/components/erp/StaffPicker";
import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { StayHubPrintPackMenu } from "@/components/erp/StayHubPrintPackMenu";
import Link from "next/link";
import { StayHubRateNightsPanel } from "@/components/erp/stay-hub/StayHubRateNightsPanel";
import {
  StayHubAuditStrip,
  StayHubFoExtrasForm,
  StayHubNextResBanner,
} from "@/components/erp/stay-hub/StayHubFoExtrasPanel";
import { StayHubTasksPanel } from "@/components/erp/stay-hub/StayHubTasksPanel";
import { useStayHubOptional } from "@/components/erp/StayHubContext";
import { StayHubPrintHost } from "@/components/erp/stay-hub/StayHubPrintHost";
import {
  getStayHubCatalogCache,
  loadStayHubCatalogFromIdb,
  loadStayHubSummaryFromIdb,
  persistStayHubCatalogToIdb,
  persistStayHubSummaryToIdb,
  setStayHubCatalogCache,
} from "@/lib/folio/stay-hub-catalog-cache";
import {
  DESK_CACHE_TTL,
  deskCacheKey,
  setDeskReadCache,
} from "@/lib/desk/desk-read-cache";
import { buildLedgerStripSummary } from "@/lib/folio/ledger-summary";
import { CheckInForm, CheckOutForm } from "@/components/erp/CheckInForm";
import {
  type FastBookVoucherData,
} from "@/components/erp/FastBookVoucher";
import { DeskSettlePanel } from "@/components/erp/DeskSettlePanel";
import { GuideEvidencePanel } from "@/components/erp/GuideEvidencePanel";
import {
  bookingNeedsGuideCheckoutEvidence,
  guideEvidenceAllowsLeave,
} from "@/lib/agents/guide-checkout";
import { fetchBookingSettlementEvidence } from "@/app/actions/erp-settlement-pack";
import { RoomNcForm } from "@/components/erp/RoomNcForm";
import { AgreedRateForm } from "@/components/erp/AgreedRateForm";
import { GuestRatePromoForm } from "@/components/erp/GuestRatePromoForm";
import {
  type GuestRegistrationCardData,
} from "@/components/erp/GuestRegistrationCard";
import {
  PostCheckInRegPanel,
  SignedRegCardUploadStrip,
} from "@/components/erp/PostCheckInRegPanel";
import type { RackStay, RackUnit } from "@/components/erp/RoomRackGrid";
import type { PropertyRegistrationDesign } from "@/lib/property-settings";
import {
  StayHubFooterBar,
  StayHubHeader,
  StayHubLeftRail,
  StayHubMobileSteps,
  StayHubToolTabs,
  StayHubWorkFrame,
  type StayHubMoreAction,
} from "@/components/erp/stay-hub/StayHubChrome";
import { StayHubAdvancedPanel } from "@/components/erp/stay-hub/StayHubAdvancedPanel";
import { StayHubPartyCommandBar, type PartyHubTab } from "@/components/erp/stay-hub/StayHubPartyCommandBar";
import { StayHubPartyRoomList } from "@/components/erp/stay-hub/StayHubPartyRoomList";
import {
  StayHubPartyDocsPanel,
  StayHubPartyMoneyPanel,
} from "@/components/erp/stay-hub/StayHubPartyHubPanels";
import { extendPartyAll, fetchRoomingList, type RoomingListPayload } from "@/app/actions/erp-reservations-party";
import { StayHubBookingRoomsStrip } from "@/components/erp/stay-hub/StayHubBookingRoomsStrip";
import { useDebouncedAutoSave } from "@/components/erp/stay-hub/use-debounced-auto-save";
import { useStayHubConcurrentLock } from "@/components/erp/stay-hub/use-stay-hub-concurrent-lock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildFolioPageHref,
  buildStayHubSteps,
  canNavigateStayHubStep,
  deskFocusedSteps,
  isStayHubArrivalTooFar,
  previousStayHubPanel,
  recommendStayHubStep,
  stayHubBackTargetLabel,
  stayHubTerminal,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { panelDescription } from "@/lib/folio/stay-hub-format";
import {
  packageNightlyAverageBtn,
  packageStayTotalBtn,
  roomNightAllInBtn,
} from "@/lib/folio/stay-rate-quote";
import { formatGuestBtn } from "@/lib/pricing";
import { printDeskSheet } from "@/lib/desk-print";
import { thimphuToday } from "@/lib/erp-lists";
import { nightsBetween } from "@/lib/stay-dates";
import { cn } from "@/lib/utils";
import { LockIcon, UnlockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";

type FolioToolTab = "bill" | "collect" | "advanced";
type DetailsToolTab = "stay" | "guest" | "rate" | "more";
type CheckInToolTab = "room" | "guest" | "more";

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const denseInputClass = "h-8 text-sm";

/** Seed shape from room rack (assignment-centric). */
export type StayHubSeedStay = RackStay;

type Draft = {
  contactName: string;
  contactPhone: string;
  phoneLater: boolean;
  contactEmail: string;
  adults: string;
  children: string;
  extraBeds: string;
  mealPlanCode: string;
  guideNumber: string;
  guestOrigin: string;
  source: string;
  agentId: string;
  soldByStaffId: string;
  notes: string;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lifecycle rank — seed rehydrate must not downgrade past DB truth. */
function bookingStatusRank(status: string): number {
  switch ((status ?? "").toLowerCase()) {
    case "expired":
    case "cancelled":
    case "no_show":
      return 100;
    case "checked_out":
      return 50;
    case "checked_in":
      return 40;
    case "confirmed":
      return 30;
    case "pending":
    case "held":
      return 20;
    default:
      return 0;
  }
}

function mergeSeedStatus(prevStatus: string, seedStatus: string): string {
  if (bookingStatusRank(seedStatus) >= bookingStatusRank(prevStatus)) {
    return seedStatus;
  }
  return prevStatus;
}

function summaryFromSeed(stay: StayHubSeedStay): StayHubSummary {
  const propertyId =
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("pelbu-desk-property-id")
      : null) ?? "";
  return {
    bookingId: stay.booking_id,
    propertyId,
    confirmationCode: null,
    contactName: stay.contact_name,
    contactPhone: stay.contact_phone,
    contactEmail: stay.contact_email,
    status: stay.status,
    checkIn: stay.check_in,
    checkOut: stay.check_out,
    adults: stay.adults,
    children: 0,
    extraBeds: 0,
    rooms: stay.rooms,
    guideNumber: stay.guide_number,
    guestOrigin: stay.guest_origin,
    source: stay.booked_by_role || stay.source,
    agentId: stay.agent_id,
    agentName: stay.agent_name,
    agentStatus: null,
    agentMarket: null,
    soldByStaffId: stay.sold_by_staff_id ?? null,
    soldByName: stay.sold_by_name ?? null,
    salesClaimStatus: stay.sales_claim_status ?? null,
    notes: stay.notes,
    paymentMode: stay.payment_mode,
    sdfIncomplete: stay.sdf_incomplete === true,
    hasRoomAssigned: Boolean(stay.room_unit_id),
    assignmentId: stay.id,
    roomUnitId: stay.room_unit_id,
    roomLabel: stay.room_label,
    roomHkStatus: null,
    roomTypeId: stay.room_type_id,
    roomTypeName: stay.room_type_name,
    roomLines: stay.room_label
      ? [
          {
            roomTypeId: stay.room_type_id || "",
            roomTypeName: stay.room_type_name || stay.room_label,
            roomTypeCode: null,
            qty: Math.max(1, stay.rooms || 1),
            inventoryKind: "sellable_guest",
            assignedLabels: stay.room_label ? [stay.room_label] : [],
          },
        ]
      : [],
    folioId: stay.folio_id,
    folioBalance: Number(stay.folio_balance ?? 0),
    isLocked: stay.is_locked,
    earlyCheckoutFeeBtn: null,
    lateCheckoutFeeBtn: null,
    chargeable: true,
    ncReasonCode: null,
    roomNcReasons: [],
    agreedNightlyRateBtn: null,
    agreedRateReason: null,
    ratePendingApproval: false,
    mealPlanCode: null,
    guideSignStatus: null,
    guideSignPhotoPublicId: null,
    guideSignWaiveReason: null,
    regCardPhotoPublicId: null,
    regCardSignedAt: null,
    rateTaxMode: "exclusive",
    taxExemptGst: false,
    taxExemptService: false,
    taxExemptBst: false,
    roomTax: {
      gstRate: 0,
      serviceChargeRate: 0,
      applyServiceCharge: false,
      inclusiveOfGstSc: false,
    },
    houseUse: false,
    dnr: false,
    dnrReason: null,
    pickupNeeded: false,
    dropoffNeeded: false,
    pickupAt: null,
    dropoffAt: null,
    transportArrivalMode: null,
    transportDepartureMode: null,
    transportNotes: null,
    visaNo: null,
    visaExpiry: null,
    arrivedFrom: null,
    purposeOfVisit: null,
    bookedAt: null,
    checkedInAt: null,
    checkedOutAt: null,
    releaseDaysBeforeArrival: null,
    releasePercent: null,
    depositDueOn: null,
    auditTrail: [],
    nextRes: null,
    guests: [],
    openTasks: [],
    confirmMode: "soft",
    advanceStatus: "none",
    advanceDueBtn: null,
    openBusinessDate: thimphuToday(),
  };
}

/** Instant party-room paint before that sibling's summary returns. */
function overlayPartyMember(
  prev: StayHubSummary,
  member: StayHubPartyMember,
): StayHubSummary {
  return {
    ...prev,
    bookingId: member.bookingId,
    confirmationCode: member.confirmationCode,
    contactName: member.contactName,
    status: member.status,
    assignmentId: member.assignmentId,
    roomLabel: member.roomLabel,
    hasRoomAssigned: Boolean(member.roomLabel || member.assignmentId),
    roomUnitId: null,
    roomHkStatus: null,
    folioId: null,
    folioBalance: 0,
    guests: [],
    auditTrail: [],
    nextRes: null,
    openTasks: [],
    agreedNightlyRateBtn: null,
    agreedRateReason: null,
    sdfIncomplete: true,
    isLocked: false,
    checkedInAt: null,
    checkedOutAt: null,
    regCardPhotoPublicId: null,
    regCardSignedAt: null,
  };
}

function partyFormStep(status: string): StayHubStepId {
  const st = (status ?? "").toLowerCase();
  if (st === "held" || st === "pending" || st === "confirmed") return "confirm";
  return "reserve";
}

function regDataFromStaySummary(
  s: StayHubSummary,
  d?: Draft | null,
  party?: StayHubPartyContext | null,
): GuestRegistrationCardData {
  const cin = (s.checkIn ?? "").slice(0, 10);
  const cout = (s.checkOut ?? "").slice(0, 10);
  const t0 = new Date(`${cin}T12:00:00`).getTime();
  const t1 = new Date(`${cout}T12:00:00`).getTime();
  const nights =
    Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0
      ? Math.round((t1 - t0) / 86_400_000)
      : 1;
  const roomName =
    [s.roomLabel, s.roomTypeName].filter(Boolean).join(" · ") || "Room";
  const booker = d?.contactName?.trim() || s.contactName?.trim() || "Guest";
  const lead = s.guests.find((g) => g.fullName?.trim()) ?? null;
  const partyName = party?.groupName?.trim() || undefined;
  const isParty = Boolean(
    party && (party.members.length > 1 || party.groupId || party.suggested),
  );
  const roomIndex = party
    ? party.members.findIndex((m) => m.bookingId === s.bookingId) + 1
    : 0;
  return {
    bookingId: s.bookingId,
    confirmationCode: s.confirmationCode ?? undefined,
    guestName: lead?.fullName.trim() || booker,
    guestPhone: d?.contactPhone?.trim() || s.contactPhone || undefined,
    guestOrigin: d?.guestOrigin || s.guestOrigin || undefined,
    passportOrCid: lead?.passportOrCid || undefined,
    guideNumber: d?.guideNumber?.trim() || s.guideNumber || undefined,
    agentLabel: s.agentName || undefined,
    checkIn: cin,
    checkOut: cout,
    nights,
    adults: Math.max(1, Number(d?.adults) || s.adults || 1),
    children: Math.max(0, Number(d?.children) || s.children || 0),
    extraBeds: Math.max(0, Number(d?.extraBeds) || s.extraBeds || 0),
    mealPlanCode: d?.mealPlanCode || s.mealPlanCode || undefined,
    roomLines: [{ name: roomName, qty: 1 }],
    rateNightlyBtn: s.agreedNightlyRateBtn,
    stayTotalBtn: null,
    partyName: isParty ? partyName || "Party" : undefined,
    roomOf:
      isParty && party && party.members.length > 1 && roomIndex > 0
        ? { index: roomIndex, total: party.members.length }
        : undefined,
    bookerName: isParty ? booker : undefined,
    unnamedRoomGuest: isParty && !lead,
  };
}

function draftFromSummary(s: StayHubSummary): Draft {
  const phone = s.contactPhone ?? "";
  return {
    contactName: s.contactName ?? "",
    contactPhone: phone,
    phoneLater: !phone.trim(),
    contactEmail: s.contactEmail ?? "",
    adults: String(s.adults),
    children: String(s.children ?? 0),
    extraBeds: String(s.extraBeds ?? 0),
    mealPlanCode: s.mealPlanCode?.trim() || "EP",
    guideNumber: s.guideNumber ?? "",
    guestOrigin: s.guestOrigin ?? "international",
    source: s.source || "reservation",
    agentId: s.agentId ?? "",
    soldByStaffId: s.soldByStaffId ?? "",
    notes: s.notes ?? "",
  };
}

/**
 * Open-panel resolve: domain recommendation first for in-house guests.
 * A stale preferredStep/seed must not dump a checked-in stay onto Reserve form.
 */
function resolveOpenPanel(
  s: StayHubSummary,
  stepHint: StayHubStepId | null | undefined,
  board: "arrivals" | "in_house" | "departures" | "reservations" | "auto",
): StayHubStepId {
  const cycleInput = {
    status: s.status,
    hasRoomAssigned: s.hasRoomAssigned,
    sdfIncomplete: s.sdfIncomplete,
    hasFolio: Boolean(s.folioId),
    balanceBtn: s.folioBalance,
    board: board ?? "auto",
    checkInDate: s.checkIn,
    openBusinessDate: s.openBusinessDate,
  } as const;

  let recommended =
    stepHint ?? recommendStayHubStep(cycleInput);

  const st = (s.status ?? "").toLowerCase();
  const tooFar = isStayHubArrivalTooFar(
    s.checkIn,
    s.openBusinessDate,
    s.status,
  );

  // Holds: never land past Confirm for edit surface.
  if (
    (st === "held" || st === "pending") &&
    recommended !== "reserve" &&
    recommended !== "confirm"
  ) {
    recommended = "confirm";
  }

  // Future arrival: never open on Check-in / Checkout.
  if (
    tooFar &&
    (recommended === "check_in" || recommended === "check_out")
  ) {
    recommended = "arrival";
  }

  // Unassigned pending/confirmed: land Check-in so Assign room is first.
  // Future arrivals stay on Arrival (Check-in is locked until hotel day).
  const unassigned =
    !s.hasRoomAssigned && !(s.roomLabel ?? "").trim();
  if ((st === "pending" || st === "confirmed") && unassigned) {
    recommended = tooFar ? "arrival" : "check_in";
  }

  // In-house: ignore reserve/confirm/arrival/check_in seed/URL hints when
  // domain says Stay/Money or Check-out — fixes progress vs body mismatch.
  if (st === "checked_in") {
    const domain = recommendStayHubStep(cycleInput);
    const early = (
      ["reserve", "confirm", "arrival", "check_in"] as StayHubStepId[]
    ).includes(recommended);
    if (early && (domain === "stay_money" || domain === "check_out")) {
      recommended = domain;
    }
  }

  return recommended;
}

export function StayHubDialog({
  open,
  onOpenChange,
  bookingId,
  assignmentId = null,
  preferredStep = null,
  seedStay = null,
  agents: agentsProp = [],
  staff: staffProp = [],
  units: unitsProp = [],
  board = "auto",
  onToggleLock,
  parentPending = false,
  onPreferredStepConsumed,
  onPanelChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  assignmentId?: string | null;
  preferredStep?: StayHubStepId | null;
  seedStay?: StayHubSeedStay | null;
  agents?: CalendarAgent[];
  staff?: BookableStaff[];
  units?: RackUnit[];
  board?: "arrivals" | "in_house" | "departures" | "reservations" | "auto";
  onToggleLock?: (stay: StayHubSeedStay) => void;
  parentPending?: boolean;
  onPreferredStepConsumed?: () => void;
  /** Keep ?step= in sync when staff change rail / panel (stops snap-back). */
  onPanelChange?: (step: StayHubStepId) => void;
}) {
  const router = useRouter();
  const stayHubCtx = useStayHubOptional();
  const [datesPending, startDatesTransition] = useTransition();
  const [undoPending, startUndoTransition] = useTransition();
  const [lockPending, startLockTransition] = useTransition();
  const [splitPending, startSplitTransition] = useTransition();
  const [checkInFollowPending, startCheckInFollowTransition] = useTransition();
  const [sheetRatePending, startSheetRate] = useTransition();

  const [summary, setSummary] = useState<StayHubSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [splitDate, setSplitDate] = useState("");
  const [splitUnitId, setSplitUnitId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [panel, setPanel] = useState<StayHubStepId>("reserve");
  const [folioTool, setFolioTool] = useState<FolioToolTab>("bill");
  const [detailsTool, setDetailsTool] = useState<DetailsToolTab>("guest");
  const [checkInTool, setCheckInTool] = useState<CheckInToolTab>("guest");
  const [lockHint, setLockHint] = useState<string | null>(null);
  const [money, setMoney] = useState<StayHubMoneyPayload | null>(null);
  const [checkInPayload, setCheckInPayload] =
    useState<StayHubCheckInPayload | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInLoadError, setCheckInLoadError] = useState(false);
  const [settlementPacks, setSettlementPacks] = useState<
    Array<{
      id: string;
      sealedAt: string;
      emailSentAt: string | null;
      emailTo: string | null;
    }>
  >([]);
  const [settlementPrint, setSettlementPrint] = useState<
    import("@/app/actions/erp-settlement-pack").SettlementPrintPack | null
  >(null);
  const [agentEmailHint, setAgentEmailHint] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error" | null
  >("idle");
  const [localAgents, setLocalAgents] = useState<CalendarAgent[]>([]);
  const [localStaff, setLocalStaff] = useState<BookableStaff[]>([]);
  const [mealPlans, setMealPlans] = useState<StayHubCatalogMealPlan[]>([]);
  const [regDesign, setRegDesign] =
    useState<PropertyRegistrationDesign | null>(null);
  const [regProperty, setRegProperty] = useState<{
    name: string;
    legal_name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_id: string | null;
    logo_public_id: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
  } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [sheetRate, setSheetRate] = useState<Awaited<
    ReturnType<typeof previewStayHubSheetRate>
  > | null>(null);
  const [railRateOpen, setRailRateOpen] = useState(false);
  const [postCheckInOpen, setPostCheckInOpen] = useState(false);
  const [postRegData, setPostRegData] =
    useState<GuestRegistrationCardData | null>(null);
  const [party, setParty] = useState<StayHubPartyContext | null>(null);
  const [partyTab, setPartyTab] = useState<PartyHubTab>("rooms");
  const [partyRooming, setPartyRooming] = useState<RoomingListPayload | null>(
    null,
  );

  /** All refs before effects/callbacks so Fast Refresh cannot TDZ `summaryRef`. */
  const checkInTabLandedRef = useRef<string | null>(null);
  const partyRef = useRef<StayHubPartyContext | null>(null);
  const partyTabRef = useRef<PartyHubTab>("rooms");
  const summaryRef = useRef<StayHubSummary | null>(null);
  const summaryCacheRef = useRef(new Map<string, StayHubSummary>());
  const checkInCacheRef = useRef(new Map<string, StayHubCheckInPayload>());
  const partyPrefetchKeyRef = useRef<string | null>(null);
  const checkInLoadedForRef = useRef<string | null>(null);
  const collectPayRef = useRef<HTMLDivElement | null>(null);
  const postChargesRef = useRef<HTMLDivElement | null>(null);
  const moneyBookingIdRef = useRef<string | null>(null);
  const moneyForceRef = useRef(false);
  const statusRollbackRef = useRef<string | null>(null);
  const sessionBookingIdRef = useRef<string | null>(null);
  const draftDirtyRef = useRef(false);
  const serverTruthRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);
  const openLandedRef = useRef(false);
  const lastDateKey = useRef<string | null>(null);
  partyRef.current = party;
  partyTabRef.current = partyTab;
  summaryRef.current = summary;

  const agents = useMemo(() => {
    if (localAgents.length > 0) return localAgents;
    return agentsProp;
  }, [localAgents, agentsProp]);
  const staff = useMemo(() => {
    if (localStaff.length > 0) return localStaff;
    return staffProp;
  }, [localStaff, staffProp]);
  const units = unitsProp;

  const { peerHint, forceTakeover } = useStayHubConcurrentLock(
    bookingId,
    open,
  );
  const railLockHint = peerHint ?? lockHint;

  // Deep link / boards may open StayHub without agents/staff props — load catalog (cached).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const applyCatalog = (data: NonNullable<ReturnType<typeof getStayHubCatalogCache>>) => {
      setLocalAgents(
        data.agents.map((a) => ({
          id: a.id,
          company_name: a.company_name,
          market: a.market,
          status: a.status,
        })),
      );
      setLocalStaff(data.staff);
      setMealPlans(data.mealPlans);
      setRegDesign(data.registration.design);
      setRegProperty(data.registration.property);
      if (typeof sessionStorage !== "undefined" && data.propertyId) {
        sessionStorage.setItem("pelbu-desk-property-id", data.propertyId);
      }
    };

    const cached = getStayHubCatalogCache();
    const propsReady =
      (agentsProp?.length ?? 0) > 0 && (staffProp?.length ?? 0) > 0;

    if (cached) {
      applyCatalog(cached);
      setCatalogLoading(false);
      return;
    }

    if (propsReady && mealPlans.length > 0) {
      setCatalogLoading(false);
      return;
    }

    // Open bundle loads catalog in the same round-trip as the stay.
    if (bookingId) {
      setCatalogLoading(true);
      return;
    }

    setCatalogLoading(true);
    void (async () => {
      const lastPid =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("pelbu-desk-property-id")
          : null;
      if (lastPid) {
        const fromDisk = await loadStayHubCatalogFromIdb(lastPid);
        if (!cancelled && fromDisk) {
          setStayHubCatalogCache(fromDisk);
          applyCatalog(fromDisk);
          setCatalogLoading(false);
        }
      }
      const r = await fetchStayHubCatalog();
      if (cancelled) return;
      setCatalogLoading(false);
      if (!r.ok) return;
      setStayHubCatalogCache(r.data);
      void persistStayHubCatalogToIdb(r.data.propertyId, r.data);
      applyCatalog(r.data);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- catalog once per open; props seed skip
  }, [open]);

  // Live sheet rate for left-rail amount + Details → Rate.
  useEffect(() => {
    if (!open || !bookingId || !draft) return;
    const timer = window.setTimeout(() => {
      startSheetRate(async () => {
        const r = await previewStayHubSheetRate({
          bookingId,
          mealPlanCode: draft.mealPlanCode,
          adults: Number(draft.adults) || 1,
          children: Number(draft.children) || 0,
          extraBeds: Number(draft.extraBeds) || 0,
        });
        setSheetRate(r);
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [
    open,
    bookingId,
    draft?.mealPlanCode,
    draft?.adults,
    draft?.children,
    draft?.extraBeds,
    draft?.source,
    draft?.agentId,
    summary?.agreedNightlyRateBtn,
  ]);

  const applySummary = useCallback(
    (s: StayHubSummary, resetPanel: boolean, stepHint?: StayHubStepId | null) => {
      summaryRef.current = s;
      setSummary(s);
      void persistStayHubSummaryToIdb(s.propertyId, s.bookingId, s);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("pelbu-desk-property-id", s.propertyId);
      }
      if (!draftDirtyRef.current) {
        setDraft(draftFromSummary(s));
        setCheckIn(s.checkIn);
        setCheckOut(s.checkOut);
        setSplitDate(addDays(s.checkIn, 1));
      }
      if (resetPanel) {
        draftDirtyRef.current = false;
        setDraft(draftFromSummary(s));
        setCheckIn(s.checkIn);
        setCheckOut(s.checkOut);
        setSplitDate(addDays(s.checkIn, 1));
        setSplitUnitId("");
        setMessage(null);
        setLockHint(null);
        // Keep sticky money for same booking (prefetch / Folio↔Checkout)
        if (moneyBookingIdRef.current !== s.bookingId) {
          setMoney(null);
          moneyBookingIdRef.current = null;
        }
        setCheckInPayload(null);
        setFolioTool("bill");
        setDetailsTool("guest");
        setCheckInTool("room");
        setPanel(resolveOpenPanel(s, stepHint, board ?? "auto"));
        onPreferredStepConsumed?.();
      }
    },
    [board, onPreferredStepConsumed],
  );

  const handleCheckedIn = useCallback(
    (payload: {
      bookingId: string;
      folioId?: string;
      leadGuest?: {
        fullName?: string;
        passportOrCid?: string;
        sdfRef?: string;
      };
    }) => {
      const id = payload.bookingId;
      // Build reg print payload immediately so FO always sees Print + Upload
      // even if summary re-fetch is slow or soft-fails.
      const s = summary;
      const d = draft;
      const ciBooking = checkInPayload?.booking;
      const cin = (
        s?.checkIn ??
        ciBooking?.check_in ??
        checkIn ??
        ""
      ).slice(0, 10);
      const cout = (
        s?.checkOut ??
        ciBooking?.check_out ??
        checkOut ??
        ""
      ).slice(0, 10);
      const t0 = new Date(`${cin}T12:00:00`).getTime();
      const t1 = new Date(`${cout}T12:00:00`).getTime();
      const nights =
        Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0
          ? Math.round((t1 - t0) / 86_400_000)
          : 1;
      const roomName =
        [s?.roomLabel, s?.roomTypeName].filter(Boolean).join(" · ") ||
        "Room";
      const p = partyRef.current;
      const partyName = p?.groupName?.trim() || undefined;
      const isParty = Boolean(
        p && (p.members.length > 1 || p.groupId || p.suggested),
      );
      const roomIndex = p
        ? p.members.findIndex((m) => m.bookingId === id) + 1
        : 0;
      const namedGuest = payload.leadGuest?.fullName?.trim();
      setPostRegData({
        bookingId: id,
        confirmationCode: s?.confirmationCode ?? undefined,
        guestName:
          namedGuest ||
          d?.contactName?.trim() ||
          s?.contactName ||
          "Guest",
        guestPhone: d?.contactPhone?.trim() || s?.contactPhone || undefined,
        guestOrigin: d?.guestOrigin || s?.guestOrigin || undefined,
        passportOrCid: payload.leadGuest?.passportOrCid || undefined,
        sdfRef: payload.leadGuest?.sdfRef || undefined,
        guideNumber:
          d?.guideNumber?.trim() ||
          s?.guideNumber ||
          ciBooking?.guide_number ||
          undefined,
        agentLabel: s?.agentName || undefined,
        checkIn: cin,
        checkOut: cout,
        nights,
        adults: Math.max(1, Number(d?.adults) || s?.adults || 1),
        children: Math.max(0, Number(d?.children) || s?.children || 0),
        extraBeds: Math.max(0, Number(d?.extraBeds) || s?.extraBeds || 0),
        mealPlanCode: d?.mealPlanCode || s?.mealPlanCode || undefined,
        roomLines: [
          {
            name: roomName,
            qty: 1,
          },
        ],
        rateNightlyBtn: s?.agreedNightlyRateBtn ?? null,
        stayTotalBtn: null,
        partyName: isParty ? partyName || "Party" : undefined,
        roomOf:
          isParty && p && p.members.length > 1 && roomIndex > 0
            ? { index: roomIndex, total: p.members.length }
            : undefined,
        bookerName: isParty
          ? d?.contactName?.trim() || s?.contactName || undefined
          : undefined,
        unnamedRoomGuest: isParty && !namedGuest,
      });
      setPostCheckInOpen(true);
      setPanel("check_in");
      setCheckInTool("guest");
      onPanelChange?.("check_in");
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              status: "checked_in",
              folioId: payload.folioId ?? prev.folioId,
            }
          : prev,
      );
      setLockHint(null);
      setMessage(null);
      toast.success("Checked in — print registration, then upload signed card");

      startCheckInFollowTransition(async () => {
        const result = await fetchStayHubSummary(id, assignmentId);
        if (result.ok) {
          serverTruthRef.current = true;
          applySummary(result.data, false);
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  status: result.data.status,
                  folioId:
                    result.data.folioId ?? payload.folioId ?? prev.folioId,
                  folioBalance: result.data.folioBalance,
                  sdfIncomplete: result.data.sdfIncomplete,
                  hasRoomAssigned: result.data.hasRoomAssigned,
                  regCardPhotoPublicId: result.data.regCardPhotoPublicId,
                  regCardSignedAt: result.data.regCardSignedAt,
                }
              : result.data,
          );
          // Enrich print card without leaving the post-CI panel.
          setPostRegData((prev) => {
            if (!prev || prev.bookingId !== id) return prev;
            const r = result.data;
            const nextName = [
              r.roomLabel,
              r.roomTypeName,
            ]
              .filter(Boolean)
              .join(" · ");
            return {
              ...prev,
              confirmationCode:
                r.confirmationCode ?? prev.confirmationCode,
              guestName:
                payload.leadGuest?.fullName?.trim() ||
                r.contactName ||
                prev.guestName,
              guestPhone: r.contactPhone || prev.guestPhone,
              guestOrigin: r.guestOrigin || prev.guestOrigin,
              guideNumber: r.guideNumber || prev.guideNumber,
              agentLabel: r.agentName || prev.agentLabel,
              checkIn: (r.checkIn ?? prev.checkIn).slice(0, 10),
              checkOut: (r.checkOut ?? prev.checkOut).slice(0, 10),
              adults: r.adults || prev.adults,
              children: r.children ?? prev.children,
              extraBeds: r.extraBeds ?? prev.extraBeds,
              mealPlanCode: r.mealPlanCode || prev.mealPlanCode,
              roomLines: nextName
                ? [{ name: nextName, qty: Math.max(1, r.rooms || 1) }]
                : prev.roomLines,
              rateNightlyBtn:
                r.agreedNightlyRateBtn ?? prev.rateNightlyBtn,
            };
          });
        } else if (payload.folioId) {
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  status: "checked_in",
                  folioId: payload.folioId ?? prev.folioId,
                }
              : prev,
          );
        }
        const moneyResult = await fetchStayHubMoney(id);
        if (moneyResult.ok) setMoney(moneyResult.data);
        router.refresh();
      });
    },
    [
      applySummary,
      assignmentId,
      checkIn,
      checkInPayload?.booking,
      checkOut,
      draft,
      onPanelChange,
      router,
      summary,
    ],
  );

  // Open / bookingId change
  useEffect(() => {
    if (!open || !bookingId) {
      sessionBookingIdRef.current = null;
      serverTruthRef.current = false;
      prevStatusRef.current = null;
      openLandedRef.current = false;
      partyPrefetchKeyRef.current = null;
      summaryCacheRef.current.clear();
      checkInCacheRef.current.clear();
      setSummary(null);
      setDraft(null);
      setLoadError(null);
      setPostCheckInOpen(false);
      setPostRegData(null);
      setParty(null);
      setPartyTab("rooms");
      setPartyRooming(null);
      return;
    }

    const prevSessionId = sessionBookingIdRef.current;
    const isNewOpen = prevSessionId !== bookingId;
    const sibling = Boolean(
      prevSessionId &&
        partyRef.current?.members.some((m) => m.bookingId === bookingId),
    );

    sessionBookingIdRef.current = bookingId;

    // Party room tap: keep the sheet, swap the form. Never blank to "Loading stay…".
    if (isNewOpen && sibling) {
      const cached = summaryCacheRef.current.get(bookingId);
      const member = partyRef.current?.members.find(
        (m) => m.bookingId === bookingId,
      );
      const prevSummary = summaryRef.current;
      const instant =
        cached ??
        (member && prevSummary
          ? overlayPartyMember(prevSummary, member)
          : null);

      draftDirtyRef.current = false;
      serverTruthRef.current = Boolean(cached);
      prevStatusRef.current = null;
      openLandedRef.current = true;
      setPostCheckInOpen(false);
      setPostRegData(null);
      moneyBookingIdRef.current = null;
      moneyForceRef.current = false;
      setMoney(null);
      setSheetRate(null);
      setLoadError(null);
      setMessage(null);

      if (partyRef.current) {
        setParty({ ...partyRef.current, bookingId });
      }

      const formHint = partyFormStep(
        instant?.status ?? member?.status ?? "confirmed",
      );
      if (instant) {
        applySummary(instant, true, formHint);
        if (partyTabRef.current === "rooms") {
          setPanel(formHint);
          setDetailsTool("guest");
          onPanelChange?.(formHint);
        }
      }

      const cachedCi = checkInCacheRef.current.get(bookingId);
      if (cachedCi && instant) {
        setCheckInPayload(cachedCi);
        checkInLoadedForRef.current = `${bookingId}:${instant.checkIn}:${instant.checkOut}`;
      } else {
        setCheckInPayload(null);
        checkInLoadedForRef.current = null;
      }

      let cancelled = false;
      void fetchStayHubSummary(bookingId, assignmentId).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.error);
          return;
        }
        serverTruthRef.current = true;
        summaryCacheRef.current.set(bookingId, result.data);
        applySummary(result.data, false);
        if (!draftDirtyRef.current) {
          setDraft(draftFromSummary(result.data));
          setCheckIn(result.data.checkIn);
          setCheckOut(result.data.checkOut);
        }
        setParty((p) => {
          if (!p) return p;
          return {
            ...p,
            bookingId,
            members: p.members.map((m) =>
              m.bookingId === bookingId
                ? {
                    ...m,
                    confirmationCode: result.data.confirmationCode,
                    contactName: result.data.contactName,
                    status: result.data.status,
                    roomLabel: result.data.roomLabel,
                    assignmentId: result.data.assignmentId,
                  }
                : m,
            ),
          };
        });
      });

      return () => {
        cancelled = true;
      };
    }

    if (isNewOpen) {
      serverTruthRef.current = false;
      prevStatusRef.current = null;
      openLandedRef.current = false;
      setPostCheckInOpen(false);
      setPostRegData(null);
      moneyBookingIdRef.current = null;
      moneyForceRef.current = false;
      checkInLoadedForRef.current = null;
    }

    let cancelled = false;

    if (isNewOpen && seedStay && seedStay.booking_id === bookingId) {
      applySummary(summaryFromSeed(seedStay), true, preferredStep);
    } else if (isNewOpen) {
      setSummary(null);
      setDraft(null);
      setLoadError(null);
      const lastPid =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("pelbu-desk-property-id")
          : null;
      if (lastPid) {
        void loadStayHubSummaryFromIdb<StayHubSummary>(lastPid, bookingId).then(
          (cached) => {
            if (!cached || cancelled) return;
            if (serverTruthRef.current) return;
            applySummary(cached, true, preferredStep);
          },
        );
      }
    }

    const needCatalog = !getStayHubCatalogCache();
    void fetchStayHubOpen(bookingId, assignmentId, {
      catalog: needCatalog,
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        setCatalogLoading(false);
        return;
      }
      serverTruthRef.current = true;
      summaryCacheRef.current.set(bookingId, result.data.summary);
      applySummary(result.data.summary, isNewOpen, preferredStep);
      if (result.data.party) setParty(result.data.party);
      else setParty(null);
      if (result.data.checkIn) {
        checkInCacheRef.current.set(bookingId, result.data.checkIn);
        setCheckInPayload(result.data.checkIn);
        checkInLoadedForRef.current = `${bookingId}:${result.data.summary.checkIn}:${result.data.summary.checkOut}`;
      }
      if (result.data.catalog) {
        setStayHubCatalogCache(result.data.catalog);
        void persistStayHubCatalogToIdb(
          result.data.catalog.propertyId,
          result.data.catalog,
        );
        setLocalAgents(
          result.data.catalog.agents.map((a) => ({
            id: a.id,
            company_name: a.company_name,
            market: a.market,
            status: a.status,
          })),
        );
        setLocalStaff(result.data.catalog.staff);
        setMealPlans(result.data.catalog.mealPlans);
        setRegDesign(result.data.catalog.registration.design);
        setRegProperty(result.data.catalog.registration.property);
      }
      setCatalogLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // seedStay intentionally only seeds on new open id — not every rehydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stay thrash fix: key by bookingId/open only
  }, [open, bookingId, assignmentId]);

  // Warm sibling summaries so the next room tap paints the form immediately.
  useEffect(() => {
    if (!open || !party?.members.length) return;
    const key = party.members
      .map((m) => m.bookingId)
      .slice()
      .sort()
      .join(",");
    if (partyPrefetchKeyRef.current === key) return;
    partyPrefetchKeyRef.current = key;

    let cancelled = false;
    const pending = party.members.filter(
      (m) => !summaryCacheRef.current.has(m.bookingId),
    );
    const run = () => {
      void Promise.all(
        pending.slice(0, 12).map(async (m) => {
          const r = await fetchStayHubSummary(m.bookingId, m.assignmentId);
          if (cancelled || !r.ok) return;
          summaryCacheRef.current.set(m.bookingId, r.data);
        }),
      );
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      const idleId = ric(run, { timeout: 900 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(idleId);
      };
    }
    const t = window.setTimeout(run, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, party]);

  // Party rooming list for group registration print (keyed by group, not room).
  useEffect(() => {
    if (!open || !party?.groupId) {
      if (!open || !party) setPartyRooming(null);
      return;
    }
    const anchor = party.members[0]?.bookingId ?? party.bookingId;
    if (!anchor) return;
    let cancelled = false;
    void fetchRoomingList(anchor).then((r) => {
      if (cancelled || !r.ok) return;
      setPartyRooming(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, party?.groupId]);

  // Seed rehydrate: room/label/lock only after server truth; never downgrade status
  useEffect(() => {
    if (!open || !bookingId || !seedStay) return;
    if (seedStay.booking_id !== bookingId) return;
    if (sessionBookingIdRef.current !== bookingId) return;
    setSummary((prev) => {
      if (!prev) return summaryFromSeed(seedStay);
      // Never downgrade lifecycle (stale arrivals/rack list after check-in)
      const status = mergeSeedStatus(prev.status, seedStay.status);
      return {
        ...prev,
        status,
        // After check-in, keep SDF badge from server truth when seed still stale
        sdfIncomplete:
          prev.status === "checked_in" || prev.status === "checked_out"
            ? prev.sdfIncomplete
            : seedStay.sdf_incomplete === true,
        folioId: seedStay.folio_id ?? prev.folioId,
        folioBalance: Number(seedStay.folio_balance ?? prev.folioBalance),
        isLocked: seedStay.is_locked,
        contactName: draftDirtyRef.current
          ? prev.contactName
          : seedStay.contact_name,
        roomLabel: seedStay.room_label,
        checkIn: draftDirtyRef.current ? prev.checkIn : seedStay.check_in,
        checkOut: draftDirtyRef.current ? prev.checkOut : seedStay.check_out,
      };
    });
  }, [open, bookingId, seedStay]);

  // When status transitions into checked_in, land on Stay / Money once —
  // unless FO is still on post-CI registration print/upload.
  // When held/pending is confirmed, advance to Check-in so footer is not Close-only.
  useEffect(() => {
    if (!open || !summary) return;
    const prev = prevStatusRef.current;
    const cur = summary.status;
    prevStatusRef.current = cur;
    if (
      prev &&
      ["pending", "confirmed", "held"].includes(prev) &&
      cur === "checked_in" &&
      (panel === "arrival" || panel === "check_in" || panel === "reserve") &&
      !postCheckInOpen &&
      !postRegData
    ) {
      setPanel("stay_money");
      setLockHint(null);
      return;
    }
    if (
      prev &&
      ["held", "pending"].includes(prev) &&
      cur === "confirmed" &&
      (panel === "reserve" || panel === "confirm" || panel === "arrival")
    ) {
      setPanel("check_in");
      setLockHint(null);
    }
  }, [open, summary?.status, panel, summary, postCheckInOpen, postRegData]);

  /**
   * Once-per-open safety: if progress already treats Stay/Money as current
   * (checked_in) but panel is still Reserve (seed race / preferredStep), snap.
   * User may still click Reserve after landing — flag prevents re-snapping.
   */
  useEffect(() => {
    if (!open || !summary || !bookingId) return;
    if (openLandedRef.current) return;
    if (postCheckInOpen || postRegData) return;

    const st = (summary.status ?? "").toLowerCase();
    if (st !== "checked_in") {
      // Wait for checked_in truth (or mark landed after server confirmed non-house)
      if (serverTruthRef.current) openLandedRef.current = true;
      return;
    }

    openLandedRef.current = true;
    const domain = recommendStayHubStep({
      status: summary.status,
      hasRoomAssigned: summary.hasRoomAssigned,
      sdfIncomplete: summary.sdfIncomplete,
      hasFolio: Boolean(summary.folioId),
      balanceBtn: summary.folioBalance,
      board: board ?? "auto",
    });
    const early = (
      ["reserve", "confirm", "arrival", "check_in"] as StayHubStepId[]
    ).includes(panel);
    if (early && (domain === "stay_money" || domain === "check_out")) {
      setPanel(domain);
      setLockHint(null);
    }
  }, [
    open,
    bookingId,
    summary,
    panel,
    board,
    postCheckInOpen,
    postRegData,
  ]);

  // Prefetch money when folio exists / in-house / Folio·Checkout; sticky skip unless forced
  useEffect(() => {
    if (!open || !bookingId) return;
    const wantsMoney =
      panel === "stay_money" ||
      panel === "check_out" ||
      preferredStep === "stay_money" ||
      preferredStep === "check_out" ||
      summary?.status === "checked_in" ||
      Boolean(summary?.folioId) ||
      Boolean(seedStay?.folio_id);

    if (!wantsMoney) return;

    if (moneyBookingIdRef.current === bookingId && !moneyForceRef.current) {
      return;
    }

    let cancelled = false;
    const force = moneyForceRef.current;
    void fetchStayHubMoney(bookingId).then((r) => {
      if (cancelled || !r.ok) {
        if (force) moneyForceRef.current = false;
        return;
      }
      moneyBookingIdRef.current = bookingId;
      moneyForceRef.current = false;
      setMoney(r.data);
      const pid = summaryRef.current?.propertyId;
      if (pid) {
        void setDeskReadCache({
          key: deskCacheKey("stayhub:money", pid, `b:${bookingId}`),
          propertyId: pid,
          payload: { ...r.data, advisoryAsOf: new Date().toISOString() },
          hardMs: DESK_CACHE_TTL.stayhubMoney.hardMs,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    bookingId,
    panel,
    preferredStep,
    summary?.status,
    summary?.folioId,
    seedStay?.folio_id,
  ]);

  const refreshSettlementEvidence = useCallback(() => {
    if (!bookingId) return;
    void fetchBookingSettlementEvidence(bookingId).then((r) => {
      if (!r.ok) return;
      setSettlementPacks(r.data.packs);
      setAgentEmailHint(r.data.agentEmail);
      setSettlementPrint(r.data.print);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              guideSignStatus: r.data.guideSignStatus,
              guideSignPhotoPublicId: r.data.guideSignPhotoPublicId,
              guideSignWaiveReason: r.data.guideSignWaiveReason,
              confirmMode: r.data.confirmMode,
              advanceStatus: r.data.advanceStatus,
              advanceDueBtn: r.data.advanceDueBtn,
            }
          : prev,
      );
    });
  }, [bookingId]);

  useEffect(() => {
    if (!open || !bookingId) return;
    if (panel === "check_out" || panel === "stay_money") {
      refreshSettlementEvidence();
    }
  }, [open, bookingId, panel, refreshSettlementEvidence]);

  // Apply preferred panel from URL / openStayHub once (Back to stay / deep link).
  // Consuming preferred clears it so rail clicks are not overwritten.
  useEffect(() => {
    if (!open || !bookingId || !preferredStep) return;
    setLockHint(null);
    setPanel(preferredStep);
    if (preferredStep === "stay_money") setFolioTool("bill");
    onPreferredStepConsumed?.();
  }, [open, bookingId, preferredStep, onPreferredStepConsumed]);

  useEffect(() => {
    if (!open || !bookingId || !summary) return;
    const st = summary.status;
    if (!["pending", "confirmed"].includes(st)) return;
    const checkInKey = `${bookingId}:${summary.checkIn}:${summary.checkOut}`;
    if (checkInLoadedForRef.current === checkInKey) return;
    // Prefetch when hub opens (not only when CI step clicked)
    let cancelled = false;
    setCheckInLoading(true);
    setCheckInLoadError(false);
    fetchStayHubCheckIn(bookingId)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          checkInCacheRef.current.set(bookingId, r.data);
          setCheckInPayload(r.data);
          checkInLoadedForRef.current = checkInKey;
          setCheckInLoadError(false);
        } else {
          setCheckInPayload(null);
          setCheckInLoadError(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCheckInPayload(null);
        setCheckInLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setCheckInLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookingId, summary?.status, summary?.checkIn, summary?.checkOut]);

  const retryCheckInLoad = useCallback(() => {
    if (!bookingId || !summary) return;
    checkInLoadedForRef.current = null;
    setCheckInLoading(true);
    setCheckInLoadError(false);
    fetchStayHubCheckIn(bookingId)
      .then((r) => {
        if (r.ok) {
          checkInCacheRef.current.set(bookingId, r.data);
          setCheckInPayload(r.data);
          checkInLoadedForRef.current = `${bookingId}:${summary.checkIn}:${summary.checkOut}`;
          setCheckInLoadError(false);
        } else {
          setCheckInPayload(null);
          setCheckInLoadError(true);
        }
      })
      .catch(() => {
        setCheckInPayload(null);
        setCheckInLoadError(true);
      })
      .finally(() => setCheckInLoading(false));
  }, [bookingId, summary]);

  // Prefer Guest tab when room is already assigned (FO captures IDs next).
  useEffect(() => {
    if (!open || !summary?.bookingId) return;
    if (panel !== "check_in" && panel !== "arrival") return;
    if (checkInTabLandedRef.current === summary.bookingId) return;
    checkInTabLandedRef.current = summary.bookingId;
    const assigned =
      summary.hasRoomAssigned || Boolean(summary.roomLabel?.trim());
    if (
      ["pending", "confirmed"].includes(summary.status) &&
      assigned
    ) {
      setCheckInTool("guest");
    } else {
      setCheckInTool("room");
    }
  }, [
    open,
    panel,
    summary?.bookingId,
    summary?.status,
    summary?.hasRoomAssigned,
    summary?.roomLabel,
  ]);

  useEffect(() => {
    if (!open) checkInTabLandedRef.current = null;
  }, [open]);

  const refreshStayAfterDateChange = useCallback(() => {
    if (!summary?.bookingId) {
      router.refresh();
      return;
    }
    void fetchStayHubSummary(summary.bookingId, summary.assignmentId).then(
      (result) => {
        if (result.ok) {
          // Date apply was explicit — take server truth for check-in gate UI
          draftDirtyRef.current = false;
          applySummary(result.data, false);
        }
      },
    );
    if (["pending", "confirmed"].includes(summary.status)) {
      void fetchStayHubCheckIn(summary.bookingId).then((r) => {
        if (r.ok) setCheckInPayload(r.data);
      });
    }
    router.refresh();
  }, [
    summary?.bookingId,
    summary?.assignmentId,
    summary?.status,
    applySummary,
    router,
  ]);

  const steps = useMemo(() => {
    if (!summary) return [];
    const full = buildStayHubSteps({
      status: summary.status,
      hasRoomAssigned: summary.hasRoomAssigned,
      sdfIncomplete: summary.sdfIncomplete,
      hasFolio: Boolean(summary.folioId || money?.folioId),
      hasCharges: money?.hasCharges,
      hasInvoice: money?.hasInvoice,
      balanceBtn: money?.balanceBtn ?? summary.folioBalance,
      // Strip “current” tracks where staff actually are — not leave-ready math.
      forceCurrent: panel,
      checkInDate: summary.checkIn,
      openBusinessDate: summary.openBusinessDate,
    });
    return deskFocusedSteps(full, summary.status);
  }, [summary, money, panel]);

  const arrivalTooFar = summary
    ? isStayHubArrivalTooFar(
        summary.checkIn,
        summary.openBusinessDate,
        summary.status,
      )
    : false;

  const goPanel = useCallback(
    (id: StayHubStepId) => {
      setLockHint(null);
      setPartyTab("rooms");
      setPanel(id);
      if (id === "stay_money") setFolioTool("bill");
      onPanelChange?.(id);
    },
    [onPanelChange],
  );

  const terminal = summary ? stayHubTerminal(summary.status) : null;

  const sameTypeUnits = useMemo(
    () =>
      units.filter(
        (unit) =>
          summary?.roomTypeId &&
          unit.room_type_id === summary.roomTypeId &&
          unit.id !== summary.roomUnitId,
      ),
    [summary, units],
  );

  const handleStepClick = (
    id: StayHubStepId,
    _locked: boolean,
    reason?: string,
  ) => {
    const step = steps.find((s) => s.id === id);
    const status = summary?.status ?? "";
    if (
      arrivalTooFar &&
      (id === "check_in" || id === "check_out") &&
      ["pending", "confirmed", "held"].includes(status)
    ) {
      setLockHint(
        step?.lockReason ??
          `Arrival ${summary?.checkIn.slice(0, 10)} — business day is ${summary?.openBusinessDate}`,
      );
      return;
    }
    const allowed = canNavigateStayHubStep({
      targetId: id,
      panel,
      step,
      status,
    });
    if (!allowed) {
      setLockHint(
        reason ?? step?.lockReason ?? "Complete earlier steps first",
      );
      return;
    }
    goPanel(id);
  };

  const backTarget =
    summary && !terminal ? previousStayHubPanel(panel, summary.status) : null;
  const backLabel = backTarget
    ? `Back to ${stayHubBackTargetLabel(backTarget, summary?.status ?? "")}`
    : null;

  const handleBack = () => {
    if (!backTarget) return;
    goPanel(backTarget);
  };

  const serializeDraft = useCallback((d: Draft) => JSON.stringify(d), []);

  useDebouncedAutoSave({
    value: draft ?? {
      contactName: "",
      contactPhone: "",
      phoneLater: true,
      contactEmail: "",
      adults: "1",
      children: "0",
      extraBeds: "0",
      mealPlanCode: "EP",
      guideNumber: "",
      guestOrigin: "international",
      source: "reservation",
      agentId: "",
      soldByStaffId: "",
      notes: "",
    },
    enabled: Boolean(open && bookingId && draft && summary && !terminal),
    serialize: serializeDraft,
    onStatus: setSaveStatus,
    successMessage: "Guest details saved",
    save: async (d) => {
      if (!summary || !bookingId) return { ok: false, error: "No booking" };
      const result = await updateCalendarReservationDetails({
        bookingId: summary.bookingId,
        contactName: d.contactName,
        contactPhone: d.phoneLater ? "" : d.contactPhone,
        contactEmail: d.contactEmail,
        adults: Number(d.adults) || 1,
        children: Number(d.children) || 0,
        extraBeds: Number(d.extraBeds) || 0,
        mealPlanCode: d.mealPlanCode || "EP",
        guideNumber: d.guideNumber,
        guestOrigin: d.guestOrigin,
        source: d.source,
        agentId: d.agentId,
        notes: d.notes,
        soldByStaffId: d.soldByStaffId,
      });
      if (result.ok) {
        draftDirtyRef.current = false;
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                contactName: d.contactName,
                contactPhone: d.phoneLater ? "" : d.contactPhone,
                contactEmail: d.contactEmail,
                adults: Number(d.adults) || 1,
                children: Number(d.children) || 0,
                extraBeds: Number(d.extraBeds) || 0,
                mealPlanCode: d.mealPlanCode || "EP",
                guideNumber: d.guideNumber || null,
                guestOrigin: d.guestOrigin,
                source: d.source,
                agentId: d.agentId || null,
                soldByStaffId: d.soldByStaffId || null,
                notes: d.notes || null,
              }
            : prev,
        );
      }
      return {
        ok: Boolean(result.ok),
        error: result.error,
        message: result.message,
      };
    },
  });

  // Debounced date resize when assignment exists
  const dateKey = `${checkIn}|${checkOut}`;
  useEffect(() => {
    lastDateKey.current = null;
  }, [bookingId]);
  useEffect(() => {
    if (!open || !summary?.assignmentId || summary.isLocked) return;
    if (!checkIn || !checkOut) return;
    if (lastDateKey.current === null) {
      lastDateKey.current = `${summary.checkIn}|${summary.checkOut}`;
      return;
    }
    if (dateKey === lastDateKey.current) return;
    if (dateKey === `${summary.checkIn}|${summary.checkOut}`) {
      lastDateKey.current = dateKey;
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setSaveStatus("saving");
        const result = await resizeCalendarAssignment(
          summary.assignmentId!,
          checkIn,
          checkOut,
        );
        if (result.ok) {
          lastDateKey.current = dateKey;
          setSaveStatus("saved");
          setSummary((prev) =>
            prev
              ? { ...prev, checkIn, checkOut }
              : prev,
          );
          window.setTimeout(() => setSaveStatus("idle"), 1800);
          void router.refresh();
        } else {
          setSaveStatus("error");
          toast.error(result.error ?? "Could not update dates");
        }
      })();
    }, 800);
    return () => clearTimeout(t);
  }, [
    open,
    dateKey,
    checkIn,
    checkOut,
    summary?.assignmentId,
    summary?.checkIn,
    summary?.checkOut,
    summary?.isLocked,
    router,
  ]);

  useEffect(() => {
    const bal = Number(money?.balanceBtn ?? summary?.folioBalance ?? 0);
    if (bal <= 0.5) {
      setFolioTool((t) => (t === "collect" ? "bill" : t));
    }
  }, [money?.balanceBtn, summary?.folioBalance]);

  const switchPartyRoom = useCallback(
    (nextId: string, nextAssignmentId: string | null) => {
      if (!nextId || nextId === bookingId) return;
      stayHubCtx?.openStayHub({
        bookingId: nextId,
        assignmentId: nextAssignmentId,
        board: board === "auto" ? "reservations" : board,
        replaceInParty: true,
      });
    },
    [stayHubCtx, board, bookingId],
  );

  if (!open || !bookingId) return null;

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    draftDirtyRef.current = true;
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const dues = Number(money?.balanceBtn ?? summary?.folioBalance ?? 0);
  const balanceOpen = dues > 0.5;
  const titleName = summary?.contactName ?? seedStay?.contact_name ?? "Stay";
  const folioId = money?.folioId || summary?.folioId || null;
  const panelLabel = steps.find((s) => s.id === panel)?.label ?? "Stay";
  const isInHouse = summary?.status === "checked_in";
  const isDetailsPanel = panel === "reserve" || panel === "confirm";
  const isCheckInPanel = panel === "arrival" || panel === "check_in";

  const sheetOk = sheetRate?.ok === true ? sheetRate : null;
  const nightsCount =
    sheetOk?.nights != null && sheetOk.nights > 0
      ? sheetOk.nights
      : summary
        ? nightsBetween(summary.checkIn, summary.checkOut)
        : 0;
  const roomsCount = Math.max(
    1,
    Math.floor(Number(summary?.rooms ?? 1) || 1),
  );
  const taxOpts = summary?.roomTax
    ? {
        gstRate: summary.roomTax.gstRate,
        serviceChargeRate: summary.roomTax.serviceChargeRate,
        applyServiceCharge: summary.roomTax.applyServiceCharge,
        // Booking FO tax mode wins when set (eZee toggle on book)
        inclusiveOfGstSc:
          summary.rateTaxMode === "inclusive" ||
          summary.roomTax.inclusiveOfGstSc,
      }
    : null;

  /** Guest-facing room all-in night (taxed). Matches room-night posts. */
  let railNightly: number | null = null;
  let railStayTotal: number | null = null;
  if (summary?.agreedNightlyRateBtn != null && taxOpts) {
    const roomAllIn = roomNightAllInBtn(
      summary.agreedNightlyRateBtn,
      taxOpts,
    );
    railNightly = roomAllIn;
    if (nightsCount > 0) {
      railStayTotal = packageStayTotalBtn({
        roomNightAllInBtn: roomAllIn,
        rooms: roomsCount,
        nights: nightsCount,
        mealStayBtn: sheetOk?.mealStayBtn ?? 0,
        extraBedStayBtn: sheetOk?.extraBedStayBtn ?? 0,
      });
    }
  } else if (sheetOk) {
    // Sheet path already returns guest all-in room + package totals.
    railNightly =
      sheetOk.systemNightlyTotalBtn ?? sheetOk.roomNightlyBtn ?? null;
    railStayTotal = sheetOk.systemStayTotalBtn ?? null;
    // If sheet lacks package average but has room nightly, rebuild stay.
    if (
      railStayTotal == null &&
      sheetOk.roomNightlyBtn != null &&
      nightsCount > 0
    ) {
      railStayTotal = packageStayTotalBtn({
        roomNightAllInBtn: sheetOk.roomNightlyBtn,
        rooms: roomsCount,
        nights: nightsCount,
        mealStayBtn: sheetOk.mealStayBtn,
        extraBedStayBtn: sheetOk.extraBedStayBtn,
      });
      railNightly =
        packageNightlyAverageBtn(railStayTotal, roomsCount, nightsCount) ??
        sheetOk.roomNightlyBtn;
    }
  }
  const rateEditable =
    !!summary &&
    ["pending", "held", "confirmed", "checked_in"].includes(summary.status);

  const openCollect = () => {
    setPanel("stay_money");
    setFolioTool("collect");
    onPanelChange?.("stay_money");
  };
  const openBill = () => {
    setPanel("stay_money");
    setFolioTool("bill");
    onPanelChange?.("stay_money");
  };
  const openAdvanced = () => {
    setPanel("stay_money");
    setFolioTool("advanced");
    onPanelChange?.("stay_money");
  };

  const handleClose = () => {
    onOpenChange(false);
    router.refresh();
  };

  const handleUndoCheckIn = () => {
    if (!summary) return;
    startUndoTransition(async () => {
      const result = await undoCheckIn(summary.bookingId);
      if (result.ok) {
        toast.success(result.message ?? "Check-in reversed");
        const next = await fetchStayHubSummary(
          summary.bookingId,
          summary.assignmentId,
        );
        if (next.ok) {
          applySummary(next.data, true, "check_in");
        }
        setPanel("check_in");
        setCheckInTool("room");
        setMoney(null);
        moneyBookingIdRef.current = null;
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not undo check-in");
      }
    });
  };

  const refreshSummary = () => {
    if (!summary) return;
    void fetchStayHubSummary(summary.bookingId, summary.assignmentId).then(
      (result) => {
        if (result.ok) applySummary(result.data, false);
      },
    );
    router.refresh();
  };

  const primaryCta = (() => {
    if (!summary) return null;

    if (summary.status === "checked_out") {
      return (
        <Button asChild variant="citrus" className="min-h-11 flex-1 sm:flex-none">
          <Link href="/erp/housekeeping">Send to HK</Link>
        </Button>
      );
    }

    if (isDetailsPanel) {
      if (
        (summary.status === "held" || summary.status === "pending") &&
        summary.ratePendingApproval
      ) {
        return (
          <Button
            asChild
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
          >
            <Link href="/erp/rate-approvals">Open rate approvals</Link>
          </Button>
        );
      }
      if (summary.status === "held") {
        if (panel !== "confirm") {
          return (
            <Button
              type="button"
              variant="citrus"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => goPanel("confirm")}
            >
              Confirm reservation
            </Button>
          );
        }
        return (
          <Button
            type="submit"
            form="stay-hub-confirm-token-form"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
          >
            Confirm reservation
          </Button>
        );
      }
      if (["pending", "confirmed"].includes(summary.status)) {
        if (arrivalTooFar) {
          return (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => goPanel("arrival")}
            >
              Prepare arrival
            </Button>
          );
        }
        const ciStep = steps.find((s) => s.id === "check_in");
        const allowed = canNavigateStayHubStep({
          targetId: "check_in",
          panel,
          step: ciStep,
          status: summary.status,
        });
        if (allowed) {
          return (
            <Button
              type="button"
              variant="citrus"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => goPanel("check_in")}
            >
              Continue to check-in
            </Button>
          );
        }
      }
      return null;
    }

    if (isCheckInPanel) {
      if (summary.status === "held") {
        if (summary.ratePendingApproval) {
          return (
            <Button
              asChild
              variant="citrus"
              className="min-h-11 flex-1 sm:flex-none"
            >
              <Link href="/erp/rate-approvals">Open rate approvals</Link>
            </Button>
          );
        }
        return (
          <Button
            type="button"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => goPanel("confirm")}
          >
            Confirm reservation
          </Button>
        );
      }
      if (["pending", "confirmed"].includes(summary.status)) {
        if (arrivalTooFar) {
          return (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => goPanel("reserve")}
            >
              Adjust stay dates
            </Button>
          );
        }
        if (summary.ratePendingApproval) {
          return (
            <Button
              asChild
              variant="citrus"
              className="min-h-11 flex-1 sm:flex-none"
            >
              <Link href="/erp/rate-approvals">Open rate approvals</Link>
            </Button>
          );
        }
        if (checkInLoading) {
          return (
            <Button
              type="button"
              variant="citrus"
              className="min-h-11 flex-1 sm:flex-none"
              disabled
            >
              Loading check-in…
            </Button>
          );
        }
        if (checkInLoadError || !checkInPayload) {
          return (
            <Button
              type="button"
              variant="citrus"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={retryCheckInLoad}
            >
              Retry check-in load
            </Button>
          );
        }
        return (
          <Button
            type="submit"
            form="stay-hub-checkin-form"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
          >
            Confirm check-in
          </Button>
        );
      }
      if (summary.status === "checked_in") {
        return (
          <Button
            type="button"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => {
              if (postCheckInOpen || postRegData) {
                setPostCheckInOpen(false);
                setPostRegData(null);
              }
              goPanel("stay_money");
            }}
          >
            {postCheckInOpen || postRegData ? "Go to Folio" : "Open folio"}
          </Button>
        );
      }
      return null;
    }

    if (panel === "stay_money" && isInHouse) {
      if (folioTool === "collect") return null;
      if (folioId && !money?.hasCharges) {
        return (
          <Button
            type="button"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={openBill}
          >
            Post charges
          </Button>
        );
      }
      if (balanceOpen) {
        return (
          <Button
            type="button"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={openCollect}
            disabled={!folioId}
          >
            {summary.agentId ? "Settle / agent AR" : "Collect payment"}
          </Button>
        );
      }
      return (
        <Button
          type="button"
          variant="citrus"
          className="min-h-11 flex-1 sm:flex-none"
          onClick={() => goPanel("check_out")}
        >
          Check out
        </Button>
      );
    }

    if (panel === "check_out" && isInHouse) {
      if (balanceOpen) {
        return (
          <Button
            type="button"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={openCollect}
          >
            {summary.agentId ? "Settle due first" : "Collect payment first"}
          </Button>
        );
      }
      if (
        guideEvidenceAllowsLeave({
          agentId: summary.agentId,
          guideSignStatus: summary.guideSignStatus,
        })
      ) {
        return (
          <Button
            type="submit"
            form="stay-hub-checkout-form"
            variant="citrus"
            className="min-h-11 flex-1 sm:flex-none"
          >
            Confirm check-out
          </Button>
        );
      }
      return null;
    }

    return null;
  })();

  const moreActions: StayHubMoreAction[] = [];
  if (
    summary &&
    isInHouse &&
    (panel === "stay_money" ||
      panel === "check_out" ||
      panel === "check_in" ||
      panel === "arrival")
  ) {
    moreActions.push({
      key: "undo-ci",
      label: "Undo check-in",
      disabled: undoPending || parentPending,
      destructive: true,
      onSelect: handleUndoCheckIn,
    });
  }
  if (panel === "stay_money") {
    moreActions.push({
      key: "advanced",
      label: "Advanced",
      onSelect: openAdvanced,
    });
  }
  if (folioId) {
    moreActions.push({
      key: "invoice",
      label: "Invoice (INV-)",
      onSelect: () => {
        window.open(`/erp/folios/${folioId}`, "_blank", "noopener,noreferrer");
      },
    });
    const receiptHref = buildFolioPageHref({
      folioId,
      pathSuffix: "/receipt",
    });
    moreActions.push({
      key: "receipt",
      label: "Receipt (new tab)",
      onSelect: () => {
        window.open(receiptHref, "_blank", "noopener,noreferrer");
      },
    });
    moreActions.push({
      key: "folio-page",
      label: "Open folio page",
      onSelect: () => {
        const href = buildFolioPageHref({
          folioId,
          stayReturn: true,
          bookingId: summary?.bookingId,
          panel: "stay_money",
          board,
        });
        window.open(href, "_blank", "noopener,noreferrer");
      },
    });
  }

  const headerAlerts: Array<{
    key: string;
    label: string;
    tone: "warn" | "danger" | "info";
  }> = [];
  if (summary) {
    if (!summary.hasRoomAssigned || !summary.roomLabel) {
      headerAlerts.push({
        key: "unassigned",
        label: "Unassigned",
        tone: "danger",
      });
    }
    if (summary.isLocked) {
      headerAlerts.push({ key: "lock", label: "Room locked", tone: "warn" });
    }
    if (summary.sdfIncomplete) {
      headerAlerts.push({
        key: "sdf",
        label: "SDF incomplete",
        tone: "danger",
      });
    }
  }

  const detailsTabs = [
    { id: "stay", label: "Stay" },
    { id: "guest", label: "Guest" },
    { id: "rate", label: "Rate" },
    { id: "more", label: "More" },
  ];
  const checkInTabs = [
    { id: "room", label: "Room" },
    { id: "guest", label: "Guest" },
    { id: "more", label: "More" },
  ];
  const folioTabs = [
    { id: "bill", label: "Folio" },
    ...(balanceOpen
      ? [
          {
            id: "collect",
            label: summary?.agentId ? "Settle" : "Collect",
          },
        ]
      : []),
  ];

  const toolTabsNode = (() => {
    if (isDetailsPanel) {
      return (
        <StayHubToolTabs
          tabs={detailsTabs}
          activeId={detailsTool}
          onChange={(id) => setDetailsTool(id as DetailsToolTab)}
        />
      );
    }
    if (isCheckInPanel) {
      return (
        <StayHubToolTabs
          tabs={checkInTabs}
          activeId={checkInTool}
          onChange={(id) => setCheckInTool(id as CheckInToolTab)}
        />
      );
    }
    if (panel === "stay_money") {
      const active =
        !balanceOpen && folioTool === "collect" ? "bill" : folioTool;
      return (
        <StayHubToolTabs
          tabs={folioTabs}
          activeId={active}
          onChange={(id) => setFolioTool(id as FolioToolTab)}
        />
      );
    }
    return null;
  })();

  const navProps = {
    steps,
    panel,
    terminal,
    onStepClick: handleStepClick,
    canNavigateStep: (id: StayHubStepId, step: (typeof steps)[number]) =>
      canNavigateStayHubStep({
        targetId: id,
        panel,
        step,
        status: summary?.status ?? "",
      }),
  };

  const onMoneyChanged = () => {
    if (!summary) return;
    moneyForceRef.current = true;
    void fetchStayHubMoney(summary.bookingId).then((r) => {
      if (r.ok) {
        moneyBookingIdRef.current = summary.bookingId;
        moneyForceRef.current = false;
        setMoney(r.data);
      }
    });
    router.refresh();
  };

  const onOptimisticVoidLine = (lineId: string) => {
    setMoney((prev) => {
      if (!prev) return prev;
      const lines = prev.lines.map((l) =>
        l.id === lineId ? { ...l, status: "voided" } : l,
      );
      const ledgerSummary = buildLedgerStripSummary(lines);
      return {
        ...prev,
        lines,
        ledgerSummary,
        balanceBtn: ledgerSummary.balanceBtn,
      };
    });
  };

  const patchOptimisticStatus = (nextStatus: string) => {
    setSummary((prev) => {
      if (!prev) return prev;
      statusRollbackRef.current = prev.status;
      return { ...prev, status: nextStatus };
    });
  };

  const rollbackOptimisticStatus = () => {
    const prev = statusRollbackRef.current;
    if (!prev) return;
    statusRollbackRef.current = null;
    setSummary((s) => (s ? { ...s, status: prev } : s));
  };

  const showPartyRooms = Boolean(
    party &&
      (party.members.length > 1 ||
        party.suggested ||
        Boolean(party.groupId)),
  );

  const advancedExtra =
    summary && folioId ? (
      <StayHubAdvancedPanel
        folioId={folioId}
        masterCandidates={money?.masterCandidates ?? []}
        onRefresh={refreshSummary}
        onOpenVoucher={() => printDeskSheet("voucher")}
        booking={{
          bookingId: summary.bookingId,
          assignmentId: summary.assignmentId,
          chargeable: summary.chargeable,
          ncReasonCode: summary.ncReasonCode,
          roomNcReasons: summary.roomNcReasons,
          roomLabel: summary.roomLabel,
          agreedNightlyRateBtn: summary.agreedNightlyRateBtn,
          agreedRateReason: summary.agreedRateReason,
          mealPlanCode: summary.mealPlanCode,
          contactEmail: summary.contactEmail,
          contactName: summary.contactName,
          contactPhone: summary.contactPhone,
          confirmationCode: summary.confirmationCode,
          checkOut: summary.checkOut,
          agentId: summary.agentId,
          checkIn: summary.checkIn,
        }}
      />
    ) : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) router.refresh();
          onOpenChange(next);
        }}
      >
        <DialogContent
          showCloseButton
          className={cn(
            "erp flex flex-col gap-0 overflow-hidden p-0",
            "isolate bg-background shadow-2xl",
            "top-auto bottom-0 left-0 right-0 z-[60] h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "md:top-[50%] md:bottom-auto md:left-[50%] md:right-auto md:h-auto md:max-h-[min(92vh,880px)] md:w-full md:max-w-5xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-lg md:border",
            showPartyRooms ? "lg:max-w-[min(96vw,88rem)]" : "lg:max-w-6xl",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <DialogTitle className="sr-only">
            Edit Transaction · {titleName}
          </DialogTitle>

          {/* Mobile compact identity — desktop lives in left rail */}
          <StayHubHeader
            guestName={titleName}
            status={summary?.status}
            roomLabel={summary?.roomLabel}
            roomTypeName={summary?.roomTypeName}
            checkIn={summary?.checkIn}
            checkOut={summary?.checkOut}
            bookingId={summary?.bookingId}
            confirmationCode={summary?.confirmationCode}
            agentName={summary?.agentName}
            paymentMode={summary?.paymentMode}
            alerts={headerAlerts}
            terminal={terminal}
            saveStatus={saveStatus}
            lockHint={railLockHint}
            onForceLock={
              railLockHint
                ? () => {
                    void forceTakeover("Manager forced stay lease from StayHub");
                  }
                : undefined
            }
            backLabel={backLabel}
            onBack={backTarget ? handleBack : undefined}
            dueChipBtn={balanceOpen ? dues : null}
            hkStatus={summary?.roomHkStatus}
          />

          {party && summary ? (
            <StayHubPartyCommandBar
              party={party}
              tab={partyTab}
              onTabChange={setPartyTab}
              activeBookingId={summary.bookingId}
              onSwitch={switchPartyRoom}
              onLinked={() => {
                if (!summary) return;
                void fetchStayHubPartyContext(summary.bookingId).then((r) => {
                  if (r.ok) setParty(r.data);
                });
                router.refresh();
              }}
              onExtendAll={
                party.groupId
                  ? () => {
                      void (async () => {
                        const res = await extendPartyAll(party.groupId!, 1);
                        if (res.ok) {
                          toast.success(res.message ?? "Extended");
                          void refreshSummary();
                          router.refresh();
                        } else {
                          toast.error(res.error ?? "Could not extend");
                        }
                      })();
                    }
                  : undefined
              }
            />
          ) : summary?.roomLines && summary.roomLines.length > 0 ? (
            <StayHubBookingRoomsStrip roomLines={summary.roomLines} />
          ) : null}

          {summary ? (
            <div
              className={cn(
                // Clear the dialog’s absolute close control (top-4 right-4 + X size)
                // so it never draws over “Print pack”.
                "flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-border",
                "px-3 py-1.5 pr-12 md:px-4 md:pr-14",
              )}
            >
              <StayHubPrintPackMenu
                compact
                bookingId={summary.bookingId}
                folioId={folioId}
                agentId={summary.agentId}
                confirmationCode={summary.confirmationCode}
                onPrintVoucher={() => printDeskSheet("voucher")}
                onPrintRegistration={() => printDeskSheet("reg")}
              />
            </div>
          ) : null}

          <StayHubMobileSteps {...navProps} />

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <StayHubLeftRail
              identity={{
                guestName: titleName,
                status: summary?.status,
                roomLabel: summary?.roomLabel,
                roomTypeName: summary?.roomTypeName,
                checkIn: summary?.checkIn,
                checkOut: summary?.checkOut,
                bookingId: summary?.bookingId,
                confirmationCode: summary?.confirmationCode,
                agentName: summary?.agentName,
                agentStatus:
                  summary?.agentStatus ?? money?.agentStatus ?? null,
                paymentMode: summary?.paymentMode ?? money?.paymentMode,
                alerts: headerAlerts,
                terminal,
                saveStatus,
                lockHint: railLockHint,
                onForceLock: railLockHint
                  ? () => {
                      void forceTakeover(
                        "Manager forced stay lease from StayHub",
                      );
                    }
                  : undefined,
                backLabel,
                onBack: backTarget ? handleBack : undefined,
                dueChipBtn: balanceOpen ? dues : null,
                hkStatus: summary?.roomHkStatus,
              }}
              amount={
                summary
                  ? {
                      nightlyBtn: railNightly,
                      isCustom: summary.agreedNightlyRateBtn != null,
                      stayTotalBtn: railStayTotal,
                      nights: nightsCount > 0 ? nightsCount : null,
                      rooms: roomsCount,
                      mealPlanCode:
                        draft?.mealPlanCode ?? summary.mealPlanCode,
                      pending: sheetRatePending && railNightly == null,
                      editable: rateEditable,
                      onEdit: rateEditable
                        ? () => setRailRateOpen(true)
                        : undefined,
                    }
                  : null
              }
              railActions={
                balanceOpen &&
                panel === "stay_money" &&
                folioTool !== "collect" ? (
                  <button
                    type="button"
                    onClick={() => openCollect()}
                    className="inline-flex w-full items-center justify-center rounded-md bg-citrus px-2 text-[11px] font-semibold text-citrus-foreground"
                  >
                    Settle
                  </button>
                ) : balanceOpen && panel === "check_out" ? (
                  <button
                    type="button"
                    onClick={() => openCollect()}
                    className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-2 text-[11px] font-semibold"
                  >
                    Collect on Folio
                  </button>
                ) : null
              }
              {...navProps}
            />

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 md:px-4 md:py-3">
              {loadError ? (
                <p className="text-sm text-destructive">{loadError}</p>
              ) : !summary || !draft ? (
                <div
                  className="desk-premium-enter space-y-3"
                  aria-busy="true"
                  aria-label="Loading stay"
                >
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <p className="text-xs text-muted-foreground">
                    Loading stay…
                    {summary ? " · Balance as of last sync may appear first" : ""}
                  </p>
                </div>
              ) : showPartyRooms && party && partyTab === "money" ? (
                <StayHubPartyMoneyPanel
                  bookingId={summary.bookingId}
                  groupId={party.groupId}
                  activeBookingId={summary.bookingId}
                  onSwitch={(id, assignmentId) => {
                    const member = party.members.find((m) => m.bookingId === id);
                    switchPartyRoom(
                      id,
                      assignmentId ?? member?.assignmentId ?? null,
                    );
                  }}
                  onOpenFolio={(id, assignmentId) => {
                    const member = party.members.find((m) => m.bookingId === id);
                    switchPartyRoom(
                      id,
                      assignmentId ?? member?.assignmentId ?? null,
                    );
                    setPartyTab("rooms");
                    setPanel("stay_money");
                    onPanelChange?.("stay_money");
                  }}
                />
              ) : showPartyRooms && party && partyTab === "docs" ? (
                <StayHubPartyDocsPanel
                  party={party}
                  summary={summary}
                  folioId={folioId}
                  regData={
                    postRegData ??
                    regDataFromStaySummary(summary, draft, party)
                  }
                  property={regProperty}
                  design={regDesign}
                  canPrintGroup={Boolean(
                    partyRooming && partyRooming.lines.length > 1,
                  )}
                  onPrintGroup={() => printDeskSheet("reg-party")}
                  onSwitch={switchPartyRoom}
                  onUploaded={() => refreshSummary()}
                />
              ) : (
                <StayHubWorkFrame
                  key={bookingId}
                  title={panelLabel}
                  description={panelDescription(panel)}
                  dense={
                    isCheckInPanel ||
                    panel === "stay_money" ||
                    panel === "check_out"
                  }
                  tools={toolTabsNode}
                >
                  <div className="min-w-0 space-y-2">
                    {/* Details — Stay | Guest | Rate | More */}
                    {isDetailsPanel ? (
                      <div className="space-y-2">
                        {panel === "confirm" &&
                        (summary.status === "held" ||
                          summary.status === "pending") ? (
                          <Callout
                            tone="amber"
                            title={
                              summary.ratePendingApproval
                                ? "Awaiting GM rate approval"
                                : "Hold / confirmation pending"
                            }
                          >
                            {summary.ratePendingApproval ? (
                              <>
                                Custom category rate must be approved at{" "}
                                <Link
                                  href="/erp/rate-approvals"
                                  className="underline"
                                >
                                  Rate approvals
                                </Link>{" "}
                                before confirm or check-in.
                              </>
                            ) : (
                              <>
                                Confirm token via lifecycle actions, then
                                continue to check-in.
                              </>
                            )}
                          </Callout>
                        ) : null}

                        {panel === "confirm" &&
                        (summary.status === "held" ||
                          summary.status === "pending") &&
                        !summary.ratePendingApproval &&
                        !terminal ? (
                          <WorkSection title="Confirm reservation">
                            <BookingLifecycleActions
                              bookingId={summary.bookingId}
                              status={summary.status}
                              ratePendingApproval={summary.ratePendingApproval}
                              onSuccess={refreshSummary}
                              onOptimisticStatus={patchOptimisticStatus}
                              onOptimisticRollback={rollbackOptimisticStatus}
                            />
                          </WorkSection>
                        ) : null}

                        {arrivalTooFar ? (
                          <Callout
                            tone="amber"
                            title={`Arrival ${summary.checkIn.slice(0, 10)} — hotel day is ${summary.openBusinessDate}`}
                          >
                            Adjust dates on Details for early arrival, or wait
                            until the hotel business day reaches arrival.
                            Check-in stays locked until then.
                          </Callout>
                        ) : null}

                        <StayHubNextResBanner
                          summary={summary}
                          onOpen={(id) => {
                            stayHubCtx?.openStayHub({
                              bookingId: id,
                              board: board === "auto" ? "reservations" : board,
                            });
                          }}
                        />

                        {detailsTool === "guest" ? (
                          <WorkSection title="Guest identity">
                            <GuestIdentityFields
                              draft={draft}
                              agents={agents}
                              staff={staff}
                              mealPlans={mealPlans}
                              catalogLoading={catalogLoading}
                              salesClaimStatus={summary.salesClaimStatus}
                              onUpdate={updateDraft}
                            />
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                              Saves automatically as you type.
                            </p>
                            {summary.guests.length > 0 ? (
                              <div className="mt-3 border-t border-border/50 pt-2">
                                <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                  Named guests / sharers
                                </p>
                                <div className="overflow-x-auto rounded-md border border-border/70">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-muted/40 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                      <tr>
                                        <th className="px-2 py-1">Name</th>
                                        <th className="px-2 py-1">ID</th>
                                        <th className="px-2 py-1">Nationality</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {summary.guests.map((g) => (
                                        <tr
                                          key={g.id || g.fullName}
                                          className="border-t border-border/50"
                                        >
                                          <td className="px-2 py-1 font-medium">
                                            {g.fullName}
                                            {g.blacklisted ? (
                                              <span className="ml-1 text-[10px] font-normal text-destructive">
                                                DNR
                                              </span>
                                            ) : null}
                                          </td>
                                          <td className="px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                                            {g.passportOrCid || "—"}
                                          </td>
                                          <td className="px-2 py-1 text-muted-foreground">
                                            {g.nationality || "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                No additional guest names yet — add at check-in.
                              </p>
                            )}
                          </WorkSection>
                        ) : null}

                        {detailsTool === "stay" && summary.assignmentId ? (
                          <WorkSection title="Stay dates">
                            <StayDatesAndSplit
                              summary={summary}
                              checkIn={checkIn}
                              checkOut={checkOut}
                              setCheckIn={(v) => {
                                draftDirtyRef.current = true;
                                setCheckIn(v);
                              }}
                              setCheckOut={(v) => {
                                draftDirtyRef.current = true;
                                setCheckOut(v);
                              }}
                              splitDate={splitDate}
                              setSplitDate={setSplitDate}
                              splitUnitId={splitUnitId}
                              setSplitUnitId={setSplitUnitId}
                              sameTypeUnits={sameTypeUnits}
                              datesPending={datesPending}
                              splitPending={splitPending}
                              lockPending={lockPending || parentPending}
                              seedStay={seedStay}
                              onToggleLock={onToggleLock}
                              onMessage={setMessage}
                              onRefresh={refreshStayAfterDateChange}
                              startDatesTransition={startDatesTransition}
                              startSplitTransition={startSplitTransition}
                              startLockTransition={startLockTransition}
                            />
                          </WorkSection>
                        ) : null}

                        {detailsTool === "stay" && !summary.assignmentId ? (
                          <p className="text-xs text-muted-foreground">
                            No room assignment yet — dates locked after
                            assignment.
                          </p>
                        ) : null}

                        {detailsTool === "rate" ? (
                          <WorkSection title="Package & rate">
                            <StayHubSheetRatePanel
                              draft={draft}
                              mealPlans={mealPlans}
                              sheetRate={sheetRate}
                              sheetRatePending={sheetRatePending}
                              summary={summary}
                              onUpdate={updateDraft}
                            />
                            <div className="mt-3 border-t pt-3">
                              <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                                Night grid (tax split)
                              </p>
                              {summary.roomTax ? (
                                <StayHubRateNightsPanel
                                  checkIn={summary.checkIn}
                                  checkOut={summary.checkOut}
                                  baseNightBtn={
                                    summary.agreedNightlyRateBtn ??
                                    (sheetRate?.ok
                                      ? (sheetRate.roomNightlyBtn ?? null)
                                      : null)
                                  }
                                  adults={summary.adults}
                                  children={summary.children}
                                  tax={summary.roomTax}
                                  taxExemptGst={summary.taxExemptGst}
                                  taxExemptService={summary.taxExemptService}
                                  rateTaxMode={summary.rateTaxMode}
                                />
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Room tax settings unavailable for this stay.
                                </p>
                              )}
                            </div>
                            <div className="mt-4 border-t pt-3">
                              <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                                Custom nightly (exception)
                              </p>
                              <p className="mb-2 text-xs text-muted-foreground">
                                Only use when negotiated off the sheet. Manager
                                PIN required.
                              </p>
                              <AgreedRateForm
                                bookingId={summary.bookingId}
                                currentRateBtn={summary.agreedNightlyRateBtn}
                                currentReason={summary.agreedRateReason}
                                mealPlanCode={
                                  draft?.mealPlanCode ?? summary.mealPlanCode
                                }
                                roomLabel={summary.roomLabel}
                                onSuccess={refreshSummary}
                              />
                            </div>
                          </WorkSection>
                        ) : null}

                        {detailsTool === "more" ? (
                          <div className="space-y-2">
                            <WorkSection title="Audit">
                              <StayHubAuditStrip summary={summary} />
                            </WorkSection>
                            <WorkSection title="Wake-up · follow-up · message">
                              <StayHubTasksPanel
                                bookingId={summary.bookingId}
                                tasks={summary.openTasks.map((t) => ({
                                  id: t.id,
                                  due_at: t.dueAt,
                                  kind: t.kind,
                                  notes: t.notes,
                                  done_at: t.doneAt,
                                }))}
                                onChanged={() => void refreshSummary()}
                              />
                            </WorkSection>
                            <WorkSection title="Logistics · visa · flags">
                              <StayHubFoExtrasForm
                                summary={summary}
                                onSuccess={refreshSummary}
                              />
                            </WorkSection>
                            {summary.assignmentId ? (
                              <>
                                <WorkSection title="Room NC">
                                  <RoomNcForm
                                    assignmentId={summary.assignmentId}
                                    chargeable={summary.chargeable}
                                    ncReasonCode={summary.ncReasonCode}
                                    reasons={summary.roomNcReasons}
                                    roomLabel={summary.roomLabel}
                                    onSuccess={refreshSummary}
                                  />
                                </WorkSection>
                                <WorkSection title="Guest rate code">
                                  <GuestRatePromoForm
                                    bookingId={summary.bookingId}
                                    defaultNightlyRateBtn={
                                      summary.agreedNightlyRateBtn
                                    }
                                    defaultEmail={summary.contactEmail}
                                    guestName={summary.contactName}
                                    onSuccess={refreshSummary}
                                  />
                                </WorkSection>
                              </>
                            ) : null}
                            {!terminal &&
                            !(
                              panel === "confirm" &&
                              (summary.status === "held" ||
                                summary.status === "pending") &&
                              !summary.ratePendingApproval
                            ) ? (
                              <WorkSection title="Cancel / no-show">
                                <BookingLifecycleActions
                                  bookingId={summary.bookingId}
                                  status={summary.status}
                                  ratePendingApproval={
                                    summary.ratePendingApproval
                                  }
                                  onSuccess={refreshSummary}
                                  onOptimisticStatus={patchOptimisticStatus}
                                  onOptimisticRollback={rollbackOptimisticStatus}
                                />
                              </WorkSection>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Check-in — post-CI reg print/upload OR Room | Guest | More */}
                    {isCheckInPanel && postRegData && postCheckInOpen ? (
                      <PostCheckInRegPanel
                        regData={postRegData}
                        regCardPhotoPublicId={summary.regCardPhotoPublicId}
                        property={regProperty ?? undefined}
                        design={regDesign}
                        onUploaded={(publicId) => {
                          setSummary((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  regCardPhotoPublicId: publicId,
                                  regCardSignedAt: new Date().toISOString(),
                                }
                              : prev,
                          );
                        }}
                        onGoFolio={() => {
                          setPostCheckInOpen(false);
                          setPostRegData(null);
                          setPanel("stay_money");
                          setFolioTool("bill");
                          onPanelChange?.("stay_money");
                        }}
                        onCloseStay={() => {
                          setPostCheckInOpen(false);
                          setPostRegData(null);
                          onOpenChange(false);
                          router.refresh();
                        }}
                      />
                    ) : isCheckInPanel ? (
                      <div className="space-y-2">
                        {checkInTool === "guest" ? (
                          <div className="space-y-2">
                            {summary.status === "checked_in" ? (
                              <SignedRegCardUploadStrip
                                bookingId={summary.bookingId}
                                regCardPhotoPublicId={
                                  summary.regCardPhotoPublicId
                                }
                                regData={regDataFromStaySummary(
                                  summary,
                                  draft,
                                  party,
                                )}
                                property={regProperty ?? undefined}
                                design={regDesign}
                                onUploaded={() => void refreshSummary()}
                              />
                            ) : null}
                            {(summary.contactPhone ?? draft?.contactPhone ?? "")
                              .trim() === "" &&
                            ["pending", "confirmed"].includes(
                              summary.status,
                            ) ? (
                              <Callout
                                tone="muted"
                                title="Phone not collected"
                              >
                                Walk-in can check in with name only. Collect
                                phone before settle when possible.
                              </Callout>
                            ) : null}
                            {!summary.hasRoomAssigned &&
                            !summary.roomLabel?.trim() &&
                            ["pending", "confirmed"].includes(
                              summary.status,
                            ) ? (
                              <Callout
                                tone="amber"
                                title="Room not assigned"
                              >
                                Assign a unit on the Room tab, then complete
                                guest ID here.
                              </Callout>
                            ) : null}
                            <WorkSection title="Stay contact">
                              <GuestIdentityFields
                                draft={draft}
                                agents={agents}
                                staff={staff}
                                mealPlans={mealPlans}
                                catalogLoading={catalogLoading}
                                salesClaimStatus={summary.salesClaimStatus}
                                onUpdate={updateDraft}
                                compactSnapshot
                              />
                            </WorkSection>
                          </div>
                        ) : null}

                        {checkInTool === "more" ? (
                          <div className="space-y-2">
                            {!terminal &&
                            [
                              "pending",
                              "held",
                              "confirmed",
                              "checked_in",
                            ].includes(summary.status) ? (
                              <WorkSection title="Cancel / no-show">
                                <BookingLifecycleActions
                                  bookingId={summary.bookingId}
                                  status={summary.status}
                                  ratePendingApproval={
                                    summary.ratePendingApproval
                                  }
                                  onSuccess={refreshSummary}
                                  onOptimisticStatus={patchOptimisticStatus}
                                  onOptimisticRollback={rollbackOptimisticStatus}
                                  compact
                                />
                              </WorkSection>
                            ) : null}
                            {["pending", "confirmed"].includes(
                              summary.status,
                            ) ? (
                              <WorkSection title="Agreed nightly rate">
                                <AgreedRateForm
                                  bookingId={summary.bookingId}
                                  currentRateBtn={
                                    summary.agreedNightlyRateBtn
                                  }
                                  currentReason={summary.agreedRateReason}
                                  mealPlanCode={summary.mealPlanCode}
                                  roomLabel={summary.roomLabel}
                                  onSuccess={refreshSummary}
                                  compact
                                />
                              </WorkSection>
                            ) : null}
                          </div>
                        ) : null}

                        {checkInTool === "room" ? (
                          <div className="space-y-2">
                            {["pending", "confirmed"].includes(
                              summary.status,
                            ) &&
                            summary.checkIn.slice(0, 10) < thimphuToday() ? (
                              <Callout
                                tone="amber"
                                title={`Check-in date ${summary.checkIn.slice(0, 10)} is before today`}
                              >
                                Adjust dates below, or use GM override /
                                manager PIN under Room allocation.
                              </Callout>
                            ) : null}

                            {["pending", "confirmed"].includes(
                              summary.status,
                            ) && arrivalTooFar ? (
                              <Callout
                                tone="amber"
                                title={`Arrival ${summary.checkIn.slice(0, 10)} — hotel day is ${summary.openBusinessDate}`}
                              >
                                Check-in opens on the arrival business day.
                                Assign rooms and collect token now, or move
                                check-in earlier under Details if the guest is
                                arriving early.
                              </Callout>
                            ) : null}

                            {["pending", "confirmed"].includes(
                              summary.status,
                            ) && summary.assignmentId ? (
                              <WorkSection title="Stay dates">
                                <StayDatesAndSplit
                                  summary={summary}
                                  checkIn={checkIn}
                                  checkOut={checkOut}
                                  setCheckIn={(v) => {
                                    draftDirtyRef.current = true;
                                    setCheckIn(v);
                                  }}
                                  setCheckOut={(v) => {
                                    draftDirtyRef.current = true;
                                    setCheckOut(v);
                                  }}
                                  splitDate={splitDate}
                                  setSplitDate={setSplitDate}
                                  splitUnitId={splitUnitId}
                                  setSplitUnitId={setSplitUnitId}
                                  sameTypeUnits={sameTypeUnits}
                                  datesPending={datesPending}
                                  splitPending={splitPending}
                                  lockPending={lockPending || parentPending}
                                  seedStay={seedStay}
                                  onToggleLock={onToggleLock}
                                  onMessage={setMessage}
                                  onRefresh={refreshStayAfterDateChange}
                                  startDatesTransition={startDatesTransition}
                                  startSplitTransition={startSplitTransition}
                                  startLockTransition={startLockTransition}
                                />
                              </WorkSection>
                            ) : null}
                          </div>
                        ) : null}

                        {/* One form for all CI tabs — panes hide without unmount */}
                        {["pending", "confirmed"].includes(summary.status) ? (
                          checkInLoading ? (
                            checkInTool !== "more" ? (
                              <p className="text-sm text-muted-foreground">
                                Loading check-in form…
                              </p>
                            ) : null
                          ) : summary.ratePendingApproval ? (
                            <Callout
                              tone="amber"
                              title="Awaiting GM rate approval"
                            >
                              Check-in is locked until custom category rates are
                              approved at{" "}
                              <Link
                                href="/erp/rate-approvals"
                                className="underline"
                              >
                                Rate approvals
                              </Link>
                              .
                            </Callout>
                          ) : checkInPayload ? (
                            <div
                              className={cn(
                                checkInTool === "more" && "hidden",
                              )}
                              aria-hidden={checkInTool === "more"}
                            >
                              <WorkSection
                                title={
                                  checkInTool === "room"
                                    ? "Room allocation"
                                    : "Guest check-in"
                                }
                              >
                                <CheckInForm
                                  key={`${summary.bookingId}-${checkInPayload.booking.check_in}`}
                                  booking={{
                                    ...checkInPayload.booking,
                                    adults: Math.max(
                                      1,
                                      Number(draft?.adults) ||
                                        checkInPayload.booking.adults ||
                                        1,
                                    ),
                                  }}
                                  guides={checkInPayload.guides}
                                  drivers={checkInPayload.drivers}
                                  slots={checkInPayload.slots}
                                  units={checkInPayload.units}
                                  embedded
                                  pane={
                                    checkInTool === "room" ? "room" : "guest"
                                  }
                                  onCheckedIn={handleCheckedIn}
                                />
                              </WorkSection>
                            </div>
                          ) : checkInLoadError || !checkInPayload ? (
                            checkInTool !== "more" ? (
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Could not load check-in form for this stay.
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={retryCheckInLoad}
                                >
                                  Retry
                                </Button>
                              </div>
                            ) : null
                          ) : null
                        ) : summary.status === "checked_in" &&
                          checkInTool !== "more" ? (
                          <p className="text-xs text-muted-foreground">
                            Already checked in. Continue on Folio or Checkout.
                            Undo is under ··· when the folio is still simple.
                          </p>
                        ) : checkInTool !== "more" &&
                          summary.status !== "checked_in" ? (
                          <p className="text-xs text-muted-foreground">
                            Check-in not available for status{" "}
                            {summary.status.replace(/_/g, " ")}.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Folio — Folio | Collect; Advanced under More */}
                    {panel === "stay_money" ? (
                      <div className="space-y-2">
                        {summary.rooms > 1 && folioTool === "advanced" ? (
                          <Callout tone="muted" title="Multi-room / group">
                            Check in each room from Reservations party board if
                            needed. Master attach is on the folio advanced
                            page.
                          </Callout>
                        ) : null}
                        <DeskSettlePanel
                          key={`settle-${summary.bookingId}`}
                          bookingId={summary.bookingId}
                          status={summary.status}
                          money={money}
                          checkIn={summary.checkIn}
                          earlyCheckoutFeeBtn={summary.earlyCheckoutFeeBtn}
                          lateCheckoutFeeBtn={summary.lateCheckoutFeeBtn}
                          hasInvoice={Boolean(money?.hasInvoice)}
                          mode="settle"
                          stayPanel="stay_money"
                          stayBoard={board}
                          toolTab={
                            !balanceOpen && folioTool === "collect"
                              ? "bill"
                              : folioTool
                          }
                          onRequestCollect={openCollect}
                          collectAnchorRef={collectPayRef}
                          postChargesAnchorRef={postChargesRef}
                          advancedExtra={advancedExtra}
                          onMoneyChanged={onMoneyChanged}
                          onOptimisticVoidLine={onOptimisticVoidLine}
                        />
                      </div>
                    ) : null}

                    {/* Checkout — evidence → leave (agent) · pay-first FO */}
                    {panel === "check_out" ? (
                      <div className="space-y-2">
                        {/* Mobile only — md+ due sits on left rail */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5 md:hidden">
                          <div className="flex items-baseline gap-2">
                            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                              Balance
                            </p>
                            <p
                              className={cn(
                                "text-base font-semibold tracking-tight tabular-nums",
                                balanceOpen && "text-maroon",
                              )}
                            >
                              {balanceOpen
                                ? formatGuestBtn(dues)
                                : "Clear"}
                            </p>
                          </div>
                          {balanceOpen ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-9 h-9 text-xs"
                              onClick={openCollect}
                            >
                              Collect on Folio
                            </Button>
                          ) : null}
                        </div>
                        {balanceOpen ? (
                          <div className="hidden md:flex md:flex-wrap md:items-center md:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-9 h-9 text-xs"
                              onClick={openCollect}
                            >
                              Collect on Folio
                            </Button>
                          </div>
                        ) : null}

                        {summary.confirmMode &&
                        summary.confirmMode !== "soft" ? (
                          <p className="text-[11px] text-muted-foreground">
                            Confirm mode:{" "}
                            <span className="font-medium capitalize text-foreground">
                              {summary.confirmMode.replace(/_/g, " ")}
                            </span>
                            {summary.advanceStatus !== "none"
                              ? ` · advance ${summary.advanceStatus}`
                              : null}
                            {summary.advanceDueBtn != null &&
                            summary.advanceDueBtn > 0
                              ? ` · due ${formatGuestBtn(summary.advanceDueBtn)}`
                              : null}
                          </p>
                        ) : null}

                        {balanceOpen ? (
                          <Callout tone="amber" title="Balance still open">
                            Collect on Folio, or tick “allow checkout with
                            folio balance” if manager-approved.
                          </Callout>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Balance clear — after guide paper (if agent),
                            confirm leave.
                          </p>
                        )}

                        {money?.hasInvoice ? (
                          <p className="text-[11px] text-muted-foreground">
                            Tax invoice issued — void/credit note needs manager
                            (L4).
                          </p>
                        ) : null}

                        {(summary.status === "checked_in" ||
                          summary.status === "checked_out") &&
                        bookingNeedsGuideCheckoutEvidence({
                          agentId: summary.agentId,
                        }) ? (
                          <GuideEvidencePanel
                            bookingId={summary.bookingId}
                            guestName={summary.contactName ?? "Guest"}
                            rooms={money?.roomLabels ?? []}
                            checkIn={summary.checkIn}
                            checkOut={summary.checkOut}
                            guideNumber={summary.guideNumber}
                            agentName={summary.agentName}
                            agentEmail={agentEmailHint}
                            confirmationCode={summary.confirmationCode}
                            printPack={settlementPrint}
                            needsEvidence
                            guideSignStatus={summary.guideSignStatus}
                            guideSignPhotoPublicId={
                              summary.guideSignPhotoPublicId
                            }
                            canLeave={guideEvidenceAllowsLeave({
                              agentId: summary.agentId,
                              guideSignStatus: summary.guideSignStatus,
                            })}
                            packs={settlementPacks}
                            onChanged={refreshSettlementEvidence}
                          />
                        ) : null}

                        {isInHouse ? (
                          guideEvidenceAllowsLeave({
                            agentId: summary.agentId,
                            guideSignStatus: summary.guideSignStatus,
                          }) ? (
                            <CheckOutForm
                              bookingId={summary.bookingId}
                              rooms={money?.roomLabels ?? []}
                              folioBalance={dues}
                              earlyFeeDefaultBtn={summary.earlyCheckoutFeeBtn}
                              lateFeeDefaultBtn={summary.lateCheckoutFeeBtn}
                              onCheckedOut={() => {
                                setSummary((prev) =>
                                  prev
                                    ? { ...prev, status: "checked_out" }
                                    : prev,
                                );
                                void refreshSummary();
                              }}
                            />
                          ) : (
                            <Callout
                              tone="amber"
                              title="Guide paper required before leave"
                            >
                              Attach signed pack with phone camera, scanner, or
                              PC file (or waive with reason). Email agent after
                              guests leave.
                            </Callout>
                          )
                        ) : summary.status === "checked_out" ? (
                          <p className="rounded-md border bg-card px-3 py-2 text-sm">
                            Guest already checked out
                            {bookingNeedsGuideCheckoutEvidence({
                              agentId: summary.agentId,
                            })
                              ? " — seal/email pack above if still needed."
                              : "."}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Check-out available after check-in.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {message ? (
                      <p
                        role="status"
                        className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs"
                      >
                        {message}
                      </p>
                    ) : null}
                  </div>
                </StayHubWorkFrame>
              )}
            </div>
            {showPartyRooms && party && summary ? (
              <StayHubPartyRoomList
                party={party}
                activeBookingId={summary.bookingId}
                onSwitch={switchPartyRoom}
                side="right"
              />
            ) : null}
          </div>

          <StayHubFooterBar
            panelLabel={panelLabel}
            onClose={handleClose}
            primaryCta={primaryCta}
            moreActions={moreActions}
          />
        </DialogContent>
      </Dialog>

      {open && summary ? (
        <StayHubPrintHost
          voucher={voucherFromSummary(summary)}
          registration={
            postRegData ?? regDataFromStaySummary(summary, draft, party)
          }
          partyRooming={partyRooming}
          partyAgentLabel={summary.agentName}
          partyGuideNumber={draft?.guideNumber || summary.guideNumber}
          property={regProperty ?? undefined}
          design={regDesign}
        />
      ) : null}

      {summary && rateEditable ? (
        <Dialog open={railRateOpen} onOpenChange={setRailRateOpen}>
          <DialogContent layer="nested" className="erp max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nightly rate</DialogTitle>
              <DialogDescription>
                Sheet or agreed Nu/night. Manager PIN required for a custom
                rate. Posts use this for room-night charging.
              </DialogDescription>
            </DialogHeader>
            {sheetOk ? (
              <p className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                Sheet package nightly{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {sheetOk.systemNightlyTotalBtn != null
                    ? formatGuestBtn(sheetOk.systemNightlyTotalBtn)
                    : "—"}
                </span>
                {sheetOk.nights ? ` · ${sheetOk.nights}n` : ""}
                {sheetOk.seasonKind ? ` · ${sheetOk.seasonKind}` : ""}
              </p>
            ) : null}
            <AgreedRateForm
              bookingId={summary.bookingId}
              currentRateBtn={summary.agreedNightlyRateBtn}
              currentReason={summary.agreedRateReason}
              mealPlanCode={
                draft?.mealPlanCode ?? summary.mealPlanCode
              }
              roomLabel={summary.roomLabel}
              compact
              onSuccess={() => {
                setRailRateOpen(false);
                void refreshSummary();
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Nested print dialog removed — PostCheckInRegPanel runs in work pane */}
    </>
  );
}

/* ─── Workspace subcomponents ─────────────────────────────────────────── */

function WorkSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-md border bg-card p-2.5 sm:p-3",
        className,
      )}
    >
      <h3 className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "amber" | "muted";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        tone === "amber" &&
          "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20",
        tone === "muted" && "bg-muted/20",
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-1 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

function GuestIdentityFields({
  draft,
  agents,
  staff,
  mealPlans,
  catalogLoading,
  salesClaimStatus,
  onUpdate,
  compactSnapshot = false,
}: {
  draft: Draft;
  agents: CalendarAgent[];
  staff: BookableStaff[];
  mealPlans: StayHubCatalogMealPlan[];
  catalogLoading: boolean;
  salesClaimStatus?: string | null;
  onUpdate: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  /** Check-in Guest tab: contact + booking context; ID docs live in CheckInForm. */
  compactSnapshot?: boolean;
}) {
  const needsAgent = draft.source === "agent" || draft.source === "mou_agent";
  const mealOptions =
    mealPlans.length > 0
      ? mealPlans
      : [{ code: "EP", name: "Room only", blurb: null, amountPerAdultNight: null, amountPerChildNight: null }];

  return (
    <div
      className={cn(
        "grid gap-2",
        compactSnapshot ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      <Field label="Guest / lead name" id="hub_contact_name">
        <Input
          id="hub_contact_name"
          className={denseInputClass}
          value={draft.contactName}
          onChange={(e) => onUpdate("contactName", e.target.value)}
        />
      </Field>
      <Field label="Phone" id="hub_contact_phone">
        <Input
          id="hub_contact_phone"
          className={denseInputClass}
          disabled={draft.phoneLater}
          value={draft.phoneLater ? "" : draft.contactPhone}
          onChange={(e) => onUpdate("contactPhone", e.target.value)}
        />
        <label className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={draft.phoneLater}
            onChange={(e) => {
              const on = e.target.checked;
              onUpdate("phoneLater", on);
              if (on) onUpdate("contactPhone", "");
            }}
            className="size-3.5 accent-foreground"
          />
          Phone later
        </label>
      </Field>
      {!compactSnapshot ? (
        <Field label="Email" id="hub_contact_email">
          <Input
            id="hub_contact_email"
            type="email"
            className={denseInputClass}
            value={draft.contactEmail}
            onChange={(e) => onUpdate("contactEmail", e.target.value)}
          />
        </Field>
      ) : null}
      <Field label="Occupancy" id="hub_occupancy">
        <select
          id="hub_occupancy"
          value={
            Math.max(1, Number(draft.adults) || 1) === 1 ? "single" : "double"
          }
          onChange={(e) => {
            if (e.target.value === "single") {
              onUpdate("adults", "1");
            } else {
              const n = Math.max(1, Number(draft.adults) || 1);
              onUpdate("adults", String(n < 2 ? 2 : n));
            }
          }}
          className={selectClass}
        >
          <option value="single">Single</option>
          <option value="double">Double</option>
        </select>
        {!compactSnapshot ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Room sheet rate. Adults below is headcount for meals.
          </p>
        ) : null}
      </Field>
      <Field label="Adults" id="hub_adults">
        <Input
          id="hub_adults"
          type="number"
          min={1}
          max={48}
          className={denseInputClass}
          value={draft.adults}
          onChange={(e) => {
            onUpdate("adults", e.target.value);
          }}
        />
      </Field>
      {!compactSnapshot ? (
        <>
          <Field label="Children" id="hub_children">
            <Input
              id="hub_children"
              type="number"
              min={0}
              max={24}
              className={denseInputClass}
              value={draft.children}
              onChange={(e) => onUpdate("children", e.target.value)}
            />
          </Field>
          <Field label="Extra beds" id="hub_extra_beds">
            <Input
              id="hub_extra_beds"
              type="number"
              min={0}
              max={8}
              className={denseInputClass}
              value={draft.extraBeds}
              onChange={(e) => onUpdate("extraBeds", e.target.value)}
            />
          </Field>
        </>
      ) : (
        <Field label="Children" id="hub_children">
          <Input
            id="hub_children"
            type="number"
            min={0}
            max={24}
            className={denseInputClass}
            value={draft.children}
            onChange={(e) => onUpdate("children", e.target.value)}
          />
        </Field>
      )}
      <Field label="Meal package" id="hub_meal">
        <select
          id="hub_meal"
          value={draft.mealPlanCode || "EP"}
          onChange={(e) => onUpdate("mealPlanCode", e.target.value)}
          className={selectClass}
        >
          {mealOptions.map((m) => (
            <option key={m.code} value={m.code}>
              {m.code} · {m.name}
              {!compactSnapshot && m.amountPerAdultNight != null
                ? ` (+Nu ${m.amountPerAdultNight}/adult·night meal)`
                : !compactSnapshot && m.code === "EP"
                  ? " (room only)"
                  : ""}
            </option>
          ))}
        </select>
        {!compactSnapshot ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            EP / CP / MAP — sheet room + meal. Details → Rate for totals.
          </p>
        ) : null}
      </Field>
      <Field label="Guest origin" id="hub_origin">
        <select
          id="hub_origin"
          value={draft.guestOrigin}
          onChange={(e) => {
            onUpdate("guestOrigin", e.target.value);
            if (e.target.value !== "international") {
              onUpdate("guideNumber", "");
            }
          }}
          className={selectClass}
        >
          <option value="international">International</option>
          <option value="regional">Regional</option>
          <option value="official">Official</option>
          <option value="local">Local</option>
        </select>
      </Field>
      {draft.guestOrigin === "international" ? (
        <Field label="Guide #" id="hub_guide">
          <Input
            id="hub_guide"
            className={cn(denseInputClass, "font-mono")}
            value={draft.guideNumber}
            onChange={(e) => onUpdate("guideNumber", e.target.value)}
            placeholder="Required for international"
          />
          {!compactSnapshot ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Guide # required. Agent is under Booked by (not origin).
            </p>
          ) : null}
        </Field>
      ) : null}
      <Field label="Booked by" id="hub_source">
        <select
          id="hub_source"
          value={draft.source}
          onChange={(e) => {
            const next = e.target.value;
            onUpdate("source", next);
            if (next !== "agent" && next !== "mou_agent") {
              onUpdate("agentId", "");
            }
          }}
          className={selectClass}
        >
          <option value="reservation">Reservation desk</option>
          <option value="owner">Owner</option>
          <option value="agent">Agent</option>
          <option value="mou_agent">MoU agent</option>
        </select>
        {compactSnapshot ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Channel only — staff name is Sold by.
          </p>
        ) : null}
      </Field>
      <Field
        label={needsAgent ? "Agent (required)" : "Agent (optional)"}
        id="hub_agent"
      >
        {catalogLoading && agents.length === 0 ? (
          <p className="rounded-md border bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
            Loading agents…
          </p>
        ) : null}
        <AgentPicker
          agents={agents}
          value={draft.agentId}
          onValueChange={(next) => onUpdate("agentId", next)}
          className={cn("bg-background", denseInputClass)}
        />
        {needsAgent && !draft.agentId ? (
          <p className="mt-0.5 text-[10px] text-amber-800 dark:text-amber-200">
            Select agent for agent / MoU bookings.
          </p>
        ) : null}
      </Field>
      <Field label="Sold by (staff)" id="hub_sold_by">
        {catalogLoading && staff.length === 0 ? (
          <p className="rounded-md border bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
            Loading staff…
          </p>
        ) : (
          <StaffPicker
            staff={staff}
            value={draft.soldByStaffId}
            onValueChange={(next) => onUpdate("soldByStaffId", next)}
            className={cn("bg-background", denseInputClass)}
            disabled={salesClaimStatus === "approved"}
          />
        )}
        {salesClaimStatus ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground capitalize">
            Claim: {salesClaimStatus}
            {salesClaimStatus === "approved"
              ? " · clear only via Owner/GM reject"
              : ""}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {compactSnapshot
              ? "Who brought / sold this stay (desk staff name)."
              : "Incentive credit — Owner/GM approves on Sales claims."}
          </p>
        )}
      </Field>
      {!compactSnapshot ? (
        <div className="sm:col-span-2">
          <Field label="Notes" id="hub_notes">
            <Textarea
              id="hub_notes"
              rows={2}
              value={draft.notes}
              onChange={(e) => onUpdate("notes", e.target.value)}
              className="min-h-[2.75rem] resize-y text-sm"
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function StayHubSheetRatePanel({
  draft,
  mealPlans,
  sheetRate,
  sheetRatePending,
  summary,
  onUpdate,
}: {
  draft: Draft | null;
  mealPlans: StayHubCatalogMealPlan[];
  sheetRate: Awaited<ReturnType<typeof previewStayHubSheetRate>> | null;
  sheetRatePending: boolean;
  summary: StayHubSummary;
  onUpdate: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  if (!draft) return null;
  const mealOptions =
    mealPlans.length > 0
      ? mealPlans
      : [
          {
            code: "EP",
            name: "Room only",
            blurb: null,
            amountPerAdultNight: null,
            amountPerChildNight: null,
          },
        ];
  const ok = sheetRate?.ok === true ? sheetRate : null;
  const err = sheetRate && !sheetRate.ok ? sheetRate.error : null;
  const usingAgreed = summary.agreedNightlyRateBtn != null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Meal package" id="hub_rate_meal">
          <select
            id="hub_rate_meal"
            value={draft.mealPlanCode || "EP"}
            onChange={(e) => onUpdate("mealPlanCode", e.target.value)}
            className={selectClass}
          >
            {mealOptions.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} · {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <p>
            Pax: {draft.adults} adult
            {Number(draft.adults) === 1 ? "" : "s"}
            {Number(draft.children) > 0
              ? ` · ${draft.children} child`
              : ""}
            {Number(draft.extraBeds) > 0
              ? ` · ${draft.extraBeds} extra bed`
              : ""}
          </p>
          <p className="mt-1">
            {summary.roomLabel ?? "Room"}
            {summary.roomTypeName ? ` · ${summary.roomTypeName}` : ""}
          </p>
          <p className="mt-1 text-[10px]">
            Edit pax under Details → Guest (autosave).
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {sheetRatePending ? "Loading sheet…" : "System sheet rate"}
          </p>
          {ok ? (
            <p className="text-[11px] text-muted-foreground">
              {ok.seasonKind} · {ok.rateTier} · {ok.nights}n
            </p>
          ) : null}
        </div>
        {err ? (
          <p className="mt-2 text-sm text-destructive">{err}</p>
        ) : null}
        {ok ? (
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Room nightly</span>
              <span className="tabular-nums font-medium">
                {ok.roomNightlyBtn != null
                  ? formatGuestBtn(ok.roomNightlyBtn)
                  : "— no sheet"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                Meal ({ok.mealPlanCode}) / night
              </span>
              <span className="tabular-nums">
                {formatGuestBtn(ok.mealPerNightBtn)}
              </span>
            </div>
            {ok.extraBedPerNightBtn > 0.009 ? (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Extra bed / night</span>
                <span className="tabular-nums">
                  {formatGuestBtn(ok.extraBedPerNightBtn)}
                </span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between gap-2 border-t pt-2">
              <span className="font-medium">Package nightly total</span>
              <span className="text-lg font-semibold tabular-nums">
                {ok.systemNightlyTotalBtn != null
                  ? formatGuestBtn(ok.systemNightlyTotalBtn)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Stay total (rooms + meal + extra)</span>
              <span className="tabular-nums">
                {ok.systemStayTotalBtn != null
                  ? formatGuestBtn(ok.systemStayTotalBtn)
                  : "—"}
              </span>
            </div>
            {!ok.hasRoomType ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                No room type on stay yet — assign room for full sheet lookup.
              </p>
            ) : null}
            {usingAgreed ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px]">
                Custom agreed rate active:{" "}
                {formatGuestBtn(summary.agreedNightlyRateBtn!)}/night
                {summary.agreedRateReason
                  ? ` · ${summary.agreedRateReason}`
                  : ""}
                . Clear below to return to sheet.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Auto sheet — no input. Custom rate only if negotiated.
              </p>
            )}
          </div>
        ) : !sheetRatePending ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Sheet preview unavailable.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StayDatesAndSplit({
  summary,
  checkIn,
  checkOut,
  setCheckIn,
  setCheckOut,
  splitDate,
  setSplitDate,
  splitUnitId,
  setSplitUnitId,
  sameTypeUnits,
  datesPending,
  splitPending,
  lockPending,
  seedStay,
  onToggleLock,
  onMessage,
  onRefresh,
  startDatesTransition,
  startSplitTransition,
  startLockTransition,
}: {
  summary: StayHubSummary;
  checkIn: string;
  checkOut: string;
  setCheckIn: (v: string) => void;
  setCheckOut: (v: string) => void;
  splitDate: string;
  setSplitDate: (v: string) => void;
  splitUnitId: string;
  setSplitUnitId: (v: string) => void;
  sameTypeUnits: RackUnit[];
  datesPending: boolean;
  splitPending: boolean;
  lockPending: boolean;
  seedStay: StayHubSeedStay | null;
  onToggleLock?: (stay: StayHubSeedStay) => void;
  onMessage: (m: string | null) => void;
  onRefresh: () => void;
  startDatesTransition: (fn: () => void) => void;
  startSplitTransition: (fn: () => void) => void;
  startLockTransition: (fn: () => void) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Check-in" id="hub_ci">
          <Input
            id="hub_ci"
            type="date"
            className={denseInputClass}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </Field>
        <Field label="Check-out" id="hub_co">
          <Input
            id="hub_co"
            type="date"
            className={denseInputClass}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3 text-xs"
          disabled={datesPending || summary.isLocked}
          onClick={() => {
            if (!summary.assignmentId) return;
            startDatesTransition(async () => {
              const result = await resizeCalendarAssignment(
                summary.assignmentId!,
                checkIn,
                checkOut,
              );
              if (result.ok) {
                toast.success(result.message ?? "Dates updated");
                onRefresh();
              } else {
                toast.error(result.error ?? "Could not update dates");
                onMessage(result.error ?? null);
              }
            });
          }}
        >
          Apply dates
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Dates also auto-save shortly after you change them.
      </p>

      {sameTypeUnits.length > 0 ? (
        <div className="space-y-1.5 border-t border-border/50 pt-2">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Split remaining nights
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Split from date" id="hub_split">
              <Input
                id="hub_split"
                type="date"
                className={denseInputClass}
                min={addDays(summary.checkIn, 1)}
                max={addDays(summary.checkOut, -1)}
                value={splitDate}
                onChange={(e) => setSplitDate(e.target.value)}
              />
            </Field>
            <Field label="Destination room" id="hub_split_unit">
              <select
                id="hub_split_unit"
                value={splitUnitId}
                onChange={(e) => setSplitUnitId(e.target.value)}
                className={selectClass}
              >
                <option value="">Select room</option>
                {sameTypeUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={splitPending || summary.isLocked || !splitUnitId}
              onClick={() => {
                if (!summary.assignmentId) return;
                startSplitTransition(async () => {
                  const result = await splitCalendarAssignment(
                    summary.assignmentId!,
                    splitDate,
                    splitUnitId,
                  );
                  onMessage(result.message ?? result.error ?? null);
                  if (result.ok) onRefresh();
                });
              }}
            >
              Split stay
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        variant={summary.isLocked ? "outline" : "secondary"}
        disabled={lockPending}
        className="h-8 gap-1.5 px-3 text-xs"
        onClick={() => {
          if (onToggleLock && seedStay) {
            onToggleLock(seedStay);
            return;
          }
          if (!summary.assignmentId) return;
          startLockTransition(async () => {
            await setCalendarAssignmentLock(
              summary.assignmentId!,
              !summary.isLocked,
            );
            onRefresh();
          });
        }}
      >
        {summary.isLocked ? (
          <UnlockIcon className="size-3.5" />
        ) : (
          <LockIcon className="size-3.5" />
        )}
        {summary.isLocked ? "Unlock room" : "Lock room assignment"}
      </Button>
    </div>
  );
}

function voucherFromSummary(s: StayHubSummary): FastBookVoucherData {
  const nights = Math.max(
    0,
    Math.round(
      (new Date(`${s.checkOut}T12:00:00Z`).getTime() -
        new Date(`${s.checkIn}T12:00:00Z`).getTime()) /
        86_400_000,
    ),
  );
  return {
    bookingId: s.bookingId,
    confirmationCode: s.confirmationCode ?? undefined,
    checkIn: s.checkIn,
    checkOut: s.checkOut,
    nights,
    guestName: s.contactName ?? "Guest",
    guestPhone: s.contactPhone ?? undefined,
    agentId: s.agentId ?? undefined,
    agentLabel: s.agentName ?? undefined,
    guideNumber: s.guideNumber ?? undefined,
    lines: [
      {
        name: s.roomTypeName ?? "Room",
        code: (s.roomTypeId ?? "room").slice(0, 8),
        qty: Math.max(1, s.rooms),
      },
    ],
  };
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <Label
        htmlFor={id}
        className="text-[10px] font-normal text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
