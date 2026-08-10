"use client";

import {
  createFastBooking,
  type DeskBookIntent,
  type FastBookState,
} from "@/app/actions/fast-book";
import { previewDeskStayQuote } from "@/app/actions/desk-book-preview";
import { AgentPicker, type BookableAgent } from "@/components/erp/AgentPicker";
import { AgentVoucherEmailButton } from "@/components/erp/AgentVoucherEmailButton";
import {
  CreditAgentPromotePanel,
  needsCreditPromote,
} from "@/components/erp/CreditAgentPromotePanel";
import type { FastBookRoomType } from "@/components/erp/FastBookForm";
import { FastBookInvoice, type FastBookInvoiceData } from "@/components/erp/FastBookInvoice";
import { FastBookVoucher, type FastBookVoucherData } from "@/components/erp/FastBookVoucher";
import {
  GuestRegistrationCard,
  type GuestRegistrationCardData,
} from "@/components/erp/GuestRegistrationCard";
import { StaffPicker, type BookableStaff } from "@/components/erp/StaffPicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useAgentCreditEligibilityNotify } from "@/hooks/use-agent-credit-eligibility-notify";
import { creditAgentIneligibilityMessage } from "@/lib/agents/status";
import type { PropertyDocumentDesign } from "@/lib/property-settings";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  PencilIcon,
  PrinterIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";

export type DeskBookFormProps = {
  roomTypes: FastBookRoomType[];
  agents: BookableAgent[];
  staff?: BookableStaff[];
  defaultSoldByStaffId?: string;
  mealPlans?: {
    code: string;
    name: string;
    blurb: string | null;
    amountPerAdultNight?: number | null;
  }[];
  property?: {
    name: string;
    legal_name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    tax_id?: string | null;
    logo_public_id?: string | null;
  };
  invoiceDesign?: PropertyDocumentDesign;
  voucherDesign?: PropertyDocumentDesign;
  defaults?: {
    checkIn?: string;
    checkOut?: string;
    roomUnitId?: string;
    /** Display label for preferred rack unit (e.g. "101"). */
    roomUnitLabel?: string;
    qtyByCode?: Record<string, number>;
    mealPlanCode?: string;
    guestOrigin?: string;
  };
  /** Notify parent after save (do not open StayHub). */
  onSaved?: (bookingId: string, intent: DeskBookIntent) => void;
  /** Open StayHub from confirmation pack. */
  onOpenStay?: (bookingId: string, intent: DeskBookIntent) => void;
  onBookAnother?: () => void;
  onClose?: () => void;
  /** @deprecated use onOpenStay — only fires Open stay now */
  onCreated?: (bookingId: string, intent: DeskBookIntent) => void;
};

const initial: FastBookState = { ok: false };
const MAX_NIGHTS = 30;

type GuestOrigin = "local" | "regional" | "international" | "official";
type StepId = "stay" | "guest" | "source" | "room" | "ready";
type PrintTarget = "note" | "voucher" | "reg";
type WalkinRateTier = "public" | "friends" | "family" | "mutual_friends";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  prepaid: "Prepaid",
  partial: "Partial",
  on_credit: "On credit",
};

const ORIGIN_OPTIONS: { id: GuestOrigin; label: string }[] = [
  { id: "local", label: "Local" },
  { id: "regional", label: "Regional" },
  { id: "international", label: "Intl" },
  { id: "official", label: "Official" },
];

const WALKIN_TIERS: { id: WalkinRateTier; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "friends", label: "Friends" },
  { id: "family", label: "Family" },
  { id: "mutual_friends", label: "Mutual" },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const t0 = new Date(`${a}T00:00:00`).getTime();
  const t1 = new Date(`${b}T00:00:00`).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1) || t1 <= t0) return 0;
  return Math.round((t1 - t0) / 86_400_000);
}

function parseGuestOrigin(raw?: string | null): GuestOrigin {
  if (raw === "local") return "local";
  if (raw === "international") return "international";
  if (raw === "official") return "official";
  return "regional";
}

function isMouAgentTier(tier: string | null | undefined): boolean {
  return tier === "mou_agents" || tier === "mou_agent";
}

function fmtShort(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function printDeskSheet(target: PrintTarget) {
  const html = document.documentElement;
  html.setAttribute("data-desk-print", target);
  html.setAttribute("data-doc-paper", "a4");
  const cleanup = () => {
    html.removeAttribute("data-desk-print");
    html.removeAttribute("data-doc-paper");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1500);
}

/**
 * Desk book modal: StayHub-style left identity/price rail + dense work pane.
 */
export function DeskBookForm({
  roomTypes,
  agents,
  staff = [],
  defaultSoldByStaffId = "",
  mealPlans = [],
  property,
  invoiceDesign,
  voucherDesign,
  defaults,
  onSaved,
  onOpenStay,
  onBookAnother,
  onClose,
  onCreated,
}: DeskBookFormProps) {
  const [state, action, pending] = useActionState(createFastBooking, initial);
  useActionToast(state, {
    successMessage: state.bookingId
      ? `Saved · ${
          state.confirmationCode ??
          state.bookingId.slice(0, 8).toUpperCase()
        }`
      : "Reservation saved",
  });
  const savedNotified = useRef(false);

  const guestTypes = useMemo(
    () => roomTypes.filter((r) => r.inventory_kind === "sellable_guest"),
    [roomTypes],
  );
  const compTypes = useMemo(
    () =>
      roomTypes.filter(
        (r) =>
          r.inventory_kind === "guide_comp" ||
          r.inventory_kind === "driver_comp",
      ),
    [roomTypes],
  );

  const initialNights = useMemo(() => {
    if (defaults?.checkIn && defaults?.checkOut) {
      return Math.max(1, nightsBetween(defaults.checkIn, defaults.checkOut) || 1);
    }
    return 1;
  }, [defaults?.checkIn, defaults?.checkOut]);

  const [checkIn, setCheckIn] = useState(
    () =>
      defaults?.checkIn && /^\d{4}-\d{2}-\d{2}$/.test(defaults.checkIn)
        ? defaults.checkIn
        : todayIso(),
  );
  const [checkOut, setCheckOut] = useState(() => {
    if (defaults?.checkOut && /^\d{4}-\d{2}-\d{2}$/.test(defaults.checkOut)) {
      return defaults.checkOut;
    }
    const ci =
      defaults?.checkIn && /^\d{4}-\d{2}-\d{2}$/.test(defaults.checkIn)
        ? defaults.checkIn
        : todayIso();
    return addDaysIso(ci, initialNights);
  });
  const nights = useMemo(
    () => Math.max(1, Math.min(MAX_NIGHTS, nightsBetween(checkIn, checkOut) || 1)),
    [checkIn, checkOut],
  );

  const setNights = (n: number) => {
    const next = Math.max(1, Math.min(MAX_NIGHTS, Math.floor(n) || 1));
    setCheckOut(addDaysIso(checkIn, next));
  };

  const onCheckInChange = (iso: string) => {
    const keepNights = Math.max(1, nights);
    setCheckIn(iso);
    setCheckOut(addDaysIso(iso, keepNights));
  };

  const onCheckOutChange = (iso: string) => {
    if (!iso || nightsBetween(checkIn, iso) < 1) {
      setCheckOut(addDaysIso(checkIn, 1));
      return;
    }
    const n = nightsBetween(checkIn, iso);
    if (n > MAX_NIGHTS) {
      setCheckOut(addDaysIso(checkIn, MAX_NIGHTS));
      return;
    }
    setCheckOut(iso);
  };

  const [guestOrigin, setGuestOrigin] = useState<GuestOrigin>(() =>
    parseGuestOrigin(defaults?.guestOrigin),
  );
  const [billAgent, setBillAgent] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [soldByStaffId, setSoldByStaffId] = useState(defaultSoldByStaffId);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [phoneLater, setPhoneLater] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [docId, setDocId] = useState("");
  const [sdfRef, setSdfRef] = useState("");
  const [guideNumber, setGuideNumber] = useState("");
  const [walkinRateTier, setWalkinRateTier] =
    useState<WalkinRateTier>("public");
  const [preferredUnitId, setPreferredUnitId] = useState(
    () => defaults?.roomUnitId ?? "",
  );
  const preferredUnitLabel = defaults?.roomUnitLabel?.trim() || null;
  const [mealPlanCode, setMealPlanCode] = useState(
    defaults?.mealPlanCode ?? mealPlans[0]?.code ?? "EP",
  );
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [extraBeds, setExtraBeds] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  /** Multi-category guest room cart (one booking · many booking_rooms). */
  type RoomCartLine = { roomTypeId: string; qty: number };
  const [roomLines, setRoomLines] = useState<RoomCartLine[]>(() => {
    const seeded = guestTypes
      .filter((g) => (defaults?.qtyByCode?.[g.code] ?? 0) > 0)
      .map((g) => ({
        roomTypeId: g.id,
        qty: Math.max(1, defaults?.qtyByCode?.[g.code] ?? 1),
      }));
    if (seeded.length > 0) return seeded;
    if (guestTypes[0]) return [{ roomTypeId: guestTypes[0].id, qty: 1 }];
    return [];
  });
  const [addCategoryId, setAddCategoryId] = useState("");
  /** Comp beds by room type id */
  const [compQtyByTypeId, setCompQtyByTypeId] = useState<Record<string, number>>(
    () => {
      const init: Record<string, number> = {};
      for (const c of roomTypes.filter(
        (r) =>
          r.inventory_kind === "guide_comp" ||
          r.inventory_kind === "driver_comp",
      )) {
        const seed = defaults?.qtyByCode?.[c.code];
        if (seed && seed > 0) init[c.id] = seed;
      }
      return init;
    },
  );

  const [systemNightly, setSystemNightly] = useState<number | null>(null);
  const [displayRate, setDisplayRate] = useState("");
  const [rateDirty, setRateDirty] = useState(false);
  const [ratePin, setRatePin] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [draftRate, setDraftRate] = useState("");
  const [draftPin, setDraftPin] = useState("");
  const [quoteHint, setQuoteHint] = useState<string | null>(null);
  const [quoteMealStay, setQuoteMealStay] = useState(0);
  const [quoteExtraStay, setQuoteExtraStay] = useState(0);
  const [quoteRoomsStay, setQuoteRoomsStay] = useState<number | null>(null);
  const [quotePackageStay, setQuotePackageStay] = useState<number | null>(null);
  const [quoteLines, setQuoteLines] = useState<
    Array<{
      roomTypeId: string;
      code: string;
      name: string;
      qty: number;
      nightlyBtn: number | null;
    }>
  >([]);
  const [remainingByType, setRemainingByType] = useState<
    Record<string, number>
  >({});
  const [agentOpenRooms, setAgentOpenRooms] = useState<number | null>(null);
  const [agentRoomCap, setAgentRoomCap] = useState<number | null>(null);
  const [quotePending, startQuote] = useTransition();
  const [intent, setIntent] = useState<DeskBookIntent>("confirm");
  const [agentPatches, setAgentPatches] = useState<
    Record<string, BookableAgent>
  >({});

  const skipConfirmationPack = useMemo(() => {
    if (intent === "check_in") return true;
    if (intent === "confirm" && checkIn === todayIso()) return true;
    return false;
  }, [intent, checkIn]);

  const pickerAgents = useMemo(() => {
    const extras = Object.values(agentPatches).filter(
      (p) => !agents.some((a) => a.id === p.id),
    );
    return [...agents.map((a) => agentPatches[a.id] ?? a), ...extras];
  }, [agents, agentPatches]);

  const selectedAgent =
    pickerAgents.find((a) => a.id === agentId) ?? null;

  const bookedBy = useMemo(() => {
    if (!billAgent || !agentId) return "reservation";
    if (isMouAgentTier(selectedAgent?.rate_tier)) return "mou_agent";
    return "agent";
  }, [billAgent, agentId, selectedAgent?.rate_tier]);

  const origin = guestOrigin;

  const totalGuestRooms = useMemo(
    () => roomLines.reduce((s, l) => s + Math.max(0, l.qty), 0),
    [roomLines],
  );
  const mixedCategories = roomLines.length > 1;
  const cartTypesUsed = useMemo(
    () => new Set(roomLines.map((l) => l.roomTypeId)),
    [roomLines],
  );
  const typesAvailableToAdd = guestTypes.filter(
    (g) => !cartTypesUsed.has(g.id),
  );

  const roomLineSummary = useMemo(() => {
    return roomLines
      .map((l) => {
        const rt = guestTypes.find((g) => g.id === l.roomTypeId);
        if (!rt || l.qty < 1) return null;
        return `${rt.name}${l.qty > 1 ? ` ×${l.qty}` : ""}`;
      })
      .filter(Boolean)
      .join(" · ");
  }, [roomLines, guestTypes]);

  const roomLinesForPack = useMemo(() => {
    const guest = roomLines
      .map((l) => {
        const rt = guestTypes.find((g) => g.id === l.roomTypeId);
        if (!rt || l.qty < 1) return null;
        return {
          name: rt.name,
          code: rt.code,
          qty: l.qty,
          kind: "guest" as const,
        };
      })
      .filter(Boolean) as Array<{
      name: string;
      code: string;
      qty: number;
      kind: string;
    }>;
    const comps = compTypes
      .map((rt) => {
        const qty = compQtyByTypeId[rt.id] ?? 0;
        if (qty < 1) return null;
        return {
          name: rt.name,
          code: rt.code,
          qty,
          kind: rt.inventory_kind,
        };
      })
      .filter(Boolean) as Array<{
      name: string;
      code: string;
      qty: number;
      kind: string;
    }>;
    return [...guest, ...comps];
  }, [roomLines, guestTypes, compTypes, compQtyByTypeId]);

  const availStrip = useMemo(() => {
    return roomLines
      .map((l) => {
        const rt = guestTypes.find((g) => g.id === l.roomTypeId);
        if (!rt) return null;
        const left = remainingByType[l.roomTypeId];
        if (left == null) return null;
        return `${rt.code || rt.name} ${left} left`;
      })
      .filter(Boolean)
      .join(" · ");
  }, [roomLines, guestTypes, remainingByType]);

  function leftFor(roomTypeId: string, unitCount: number): number {
    if (remainingByType[roomTypeId] != null) {
      return remainingByType[roomTypeId];
    }
    return unitCount;
  }

  function setLineQty(roomTypeId: string, qty: number) {
    const rt = guestTypes.find((g) => g.id === roomTypeId);
    const left = leftFor(roomTypeId, rt?.unit_count ?? 20);
    const maxAllowed = Math.max(
      0,
      Math.min(rt?.unit_count ?? 20, left),
    );
    if (maxAllowed < 1) {
      toast.message("Not enough rooms left for these dates", {
        description: rt?.name ?? "Room",
      });
      return;
    }
    const next = Math.max(1, Math.min(maxAllowed, Math.floor(qty) || 1));
    if (qty > next) {
      toast.message("Not enough rooms left for these dates", {
        description: `${rt?.name ?? "Room"} · max ${next}`,
      });
    }
    setRoomLines((prev) =>
      prev.map((l) =>
        l.roomTypeId === roomTypeId ? { ...l, qty: next } : l,
      ),
    );
    setRateDirty(false);
  }

  function removeLine(roomTypeId: string) {
    setRoomLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.roomTypeId !== roomTypeId);
    });
    setRateDirty(false);
  }

  function addCategoryLine(roomTypeId: string) {
    if (!roomTypeId || cartTypesUsed.has(roomTypeId)) return;
    const rt = guestTypes.find((g) => g.id === roomTypeId);
    const left = leftFor(roomTypeId, rt?.unit_count ?? 1);
    if (left < 1) {
      toast.message("No inventory left", {
        description: rt?.name ?? "Room type sold out for these dates.",
      });
      return;
    }
    setRoomLines((prev) => [...prev, { roomTypeId, qty: 1 }]);
    setAddCategoryId("");
    setRateDirty(false);
  }

  function setCompQty(roomTypeId: string, qty: number) {
    const rt = compTypes.find((c) => c.id === roomTypeId);
    const max = Math.min(
      rt?.unit_count ?? 8,
      leftFor(roomTypeId, rt?.unit_count ?? 8),
    );
    const next = Math.max(0, Math.min(max, Math.floor(qty) || 0));
    setCompQtyByTypeId((prev) => ({ ...prev, [roomTypeId]: next }));
  }

  const blockCredit =
    billAgent &&
    needsCreditPromote(paymentMode, selectedAgent) &&
    Boolean(agentId);

  const creditEligibilityError = useAgentCreditEligibilityNotify(
    paymentMode,
    selectedAgent,
    { enabled: billAgent && Boolean(agentId) },
  );

  const roomCapNear =
    billAgent &&
    agentOpenRooms != null &&
    agentRoomCap != null &&
    agentOpenRooms + totalGuestRooms > agentRoomCap;

  const refreshQuote = useCallback(() => {
    if (roomLines.length === 0 || totalGuestRooms < 1 || !checkIn || nights < 1)
      return;
    startQuote(async () => {
      const r = await previewDeskStayQuote({
        checkIn,
        checkOut,
        lines: roomLines.map((l) => ({
          roomTypeId: l.roomTypeId,
          qty: l.qty,
        })),
        adults,
        children,
        extraBeds,
        mealPlanCode,
        source: bookedBy,
        agentId: billAgent ? agentId || null : null,
        rateTier: billAgent ? null : walkinRateTier,
      });
      if (!r.ok) {
        setQuoteHint(r.error);
        setSystemNightly(null);
        setQuoteRoomsStay(null);
        setQuotePackageStay(null);
        setQuoteMealStay(0);
        setQuoteExtraStay(0);
        setQuoteLines([]);
        return;
      }
      const mixNote = r.mixedCategories ? " · multi" : "";
      const pkgNote =
        r.mealPlanCode && r.mealPlanCode !== "EP"
          ? ` · ${r.mealPlanCode}`
          : "";
      setQuoteHint(
        r.systemNightlyBtn == null
          ? "No rate — enter a rate (manager PIN)."
          : `${r.seasonKind} · ${r.rateTier}${mixNote}${pkgNote}`,
      );
      setSystemNightly(r.systemNightlyBtn);
      setQuoteRoomsStay(r.stayRoomsBtn);
      setQuotePackageStay(r.packageStayBtn);
      setQuoteMealStay(r.mealStayBtn);
      setQuoteExtraStay(r.extraBedStayBtn);
      setQuoteLines(r.lines);
      setRemainingByType(r.remainingByRoomTypeId ?? {});
      setAgentOpenRooms(r.agentOpenRooms);
      setAgentRoomCap(r.agentRoomCap);
      if (!rateDirty && r.systemNightlyBtn != null) {
        setDisplayRate(String(Math.round(r.systemNightlyBtn)));
      }
    });
  }, [
    roomLines,
    totalGuestRooms,
    checkIn,
    checkOut,
    nights,
    adults,
    children,
    extraBeds,
    mealPlanCode,
    bookedBy,
    billAgent,
    agentId,
    walkinRateTier,
    rateDirty,
  ]);

  useEffect(() => {
    refreshQuote();
  }, [refreshQuote]);

  useEffect(() => {
    if (billAgent) {
      if (paymentMode === "cash") setPaymentMode("on_credit");
    } else {
      setAgentId("");
      setPaymentMode("cash");
    }
  }, [billAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (guestOrigin === "local" || guestOrigin === "official") {
      setSdfRef("");
      if (guestOrigin === "local") setGuideNumber("");
    } else if (guestOrigin === "regional") {
      setGuideNumber("");
    }
  }, [guestOrigin]);

  useEffect(() => {
    if (!state.ok || !state.bookingId || savedNotified.current) return;
    savedNotified.current = true;
    const savedIntent = state.intent ?? intent;
    const sameDayOpen =
      savedIntent === "check_in" ||
      (savedIntent === "confirm" && checkIn === todayIso());
    if (sameDayOpen) {
      (onOpenStay ?? onCreated)?.(state.bookingId, savedIntent);
      return;
    }
    onSaved?.(state.bookingId, savedIntent);
  }, [
    onSaved,
    onOpenStay,
    onCreated,
    state.ok,
    state.bookingId,
    state.intent,
    intent,
    checkIn,
  ]);

  const editedRate = Number(displayRate);
  const rateDiffers =
    (systemNightly != null &&
      Number.isFinite(editedRate) &&
      Math.abs(editedRate - systemNightly) > 0.009) ||
    (systemNightly == null &&
      displayRate.trim() !== "" &&
      Number.isFinite(editedRate));

  /** Custom nightly is treated as all-in per room-night; sheet uses package total. */
  const stayTotal = useMemo(() => {
    if (rateDiffers && Number.isFinite(editedRate) && nights > 0 && totalGuestRooms > 0) {
      return editedRate * nights * totalGuestRooms;
    }
    if (quotePackageStay != null) return quotePackageStay;
    if (
      Number.isFinite(editedRate) &&
      nights > 0 &&
      totalGuestRooms > 0
    ) {
      return editedRate * nights * totalGuestRooms;
    }
    return null;
  }, [
    rateDiffers,
    editedRate,
    nights,
    totalGuestRooms,
    quotePackageStay,
  ]);

  const stepDone: Record<StepId, boolean> = {
    stay: Boolean(checkIn) && nights >= 1,
    guest:
      guestName.trim().length > 0 && (phoneLater || phone.trim().length > 0),
    source: !billAgent || (Boolean(agentId) && !blockCredit),
    room: totalGuestRooms >= 1 && roomLines.length >= 1,
    ready:
      Boolean(checkIn) &&
      nights >= 1 &&
      guestName.trim().length > 0 &&
      totalGuestRooms >= 1 &&
      (guestOrigin !== "international" || guideNumber.trim().length > 0) &&
      (!billAgent || (Boolean(agentId) && !blockCredit)),
  };
  void stepDone;

  function validateStep(id: StepId): string | null {
    if (id === "stay") {
      if (!checkIn || nights < 1) return "Choose check-in and nights.";
      return null;
    }
    if (id === "guest") {
      if (!guestName.trim()) return "Guest name is required.";
      if (!phoneLater && !phone.trim()) return "Phone or tick Phone later.";
      return null;
    }
    if (id === "source") {
      if (billAgent && !agentId) return "Pick an agent.";
      if (blockCredit) {
        const msg =
          creditEligibilityError ??
          creditAgentIneligibilityMessage(
            selectedAgent?.status ?? "directory",
            selectedAgent?.company_name,
          ) ??
          "Enable credit for this agent in the panel below, or use cash.";
        toast.warning(msg, {
          id: `agent-credit-step-${agentId || "none"}`,
          duration: 10_000,
          description: "Scroll to Enable credit in this window.",
        });
        return "Enable credit below (or switch to cash) before continuing.";
      }
      if (guestOrigin === "international" && !guideNumber.trim())
        return "Guide number is required for international.";
      return null;
    }
    if (id === "room") {
      if (totalGuestRooms < 1 || roomLines.length < 1)
        return "Add at least one guest room.";
      for (const line of roomLines) {
        const left = remainingByType[line.roomTypeId];
        if (left != null && line.qty > left) {
          const rt = guestTypes.find((g) => g.id === line.roomTypeId);
          return `${rt?.name ?? "Room"}: only ${left} left for these dates.`;
        }
      }
      return null;
    }
    return null;
  }

  const openRateDialog = () => {
    setDraftRate(
      displayRate ||
        (systemNightly != null ? String(Math.round(systemNightly)) : ""),
    );
    setDraftPin(ratePin);
    setPinOpen(true);
  };

  const applyRateDialog = () => {
    const n = Number(draftRate);
    if (!Number.isFinite(n) || n < 0) return;
    const differs =
      systemNightly == null || Math.abs(n - systemNightly) > 0.009;
    if (differs && !draftPin.trim()) return;
    setDisplayRate(String(Math.round(n)));
    setRateDirty(true);
    setRatePin(differs ? draftPin : "");
    setPinOpen(false);
  };

  const draftDiffers =
    systemNightly == null ||
    !Number.isFinite(Number(draftRate)) ||
    Math.abs(Number(draftRate) - (systemNightly ?? -1)) > 0.009;

  // —— Confirmation pack after successful create (future holds / non same-day) ——
  if (state.ok && state.bookingId && !skipConfirmationPack) {
    const bookingId = state.bookingId;
    const savedIntent = state.intent ?? intent;
    const agentLabel = selectedAgent?.company_name;
    const hasAgent = billAgent && Boolean(agentId);
    const packLines = roomLinesForPack;

    const invoiceData: FastBookInvoiceData = {
      bookingId,
      confirmationCode: state.confirmationCode,
      checkIn,
      checkOut,
      nights,
      adults,
      guestName,
      agentLabel,
      sourceLabel: bookedBy,
      paymentLabel: PAYMENT_LABELS[paymentMode] ?? paymentMode,
      lines: packLines,
    };

    const voucherData: FastBookVoucherData = {
      bookingId,
      confirmationCode: state.confirmationCode,
      checkIn,
      checkOut,
      nights,
      guestName,
      guestPhone: phoneLater ? "" : phone,
      agentId: agentId || undefined,
      agentLabel,
      guideNumber: guideNumber || undefined,
      lines: packLines.map((l) => ({ name: l.name, code: l.code, qty: l.qty })),
    };

    const regData: GuestRegistrationCardData = {
      bookingId,
      confirmationCode: state.confirmationCode,
      guestName,
      guestPhone: phoneLater ? undefined : phone,
      guestOrigin: origin,
      passportOrCid: docId || undefined,
      sdfRef: sdfRef || undefined,
      guideNumber: guideNumber || undefined,
      agentLabel,
      checkIn,
      checkOut,
      nights,
      adults,
      children,
      extraBeds,
      mealPlanCode,
      roomLines: packLines.map((l) => ({ name: l.name, qty: l.qty })),
      rateNightlyBtn: Number.isFinite(editedRate) ? editedRate : null,
      stayTotalBtn: stayTotal,
    };

    const openStay = () => {
      (onOpenStay ?? onCreated)?.(bookingId, savedIntent);
    };

    return (
      <div className="erp flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <header className="print:hidden">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Confirmed
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {guestName || "Guest"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {fmtShort(checkIn)} → {fmtShort(checkOut)} · {nights}n ·{" "}
              {roomLineSummary || "Rooms"}
              {stayTotal != null ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatGuestBtn(stayTotal)}
                  </span>
                </>
              ) : null}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              Conf{" "}
              {state.confirmationCode ??
                bookingId.slice(0, 8).toUpperCase()}
            </p>
          </header>

          <div className="mt-6 grid gap-4 print:hidden sm:grid-cols-2 lg:grid-cols-3">
            <ConfirmActionCard
              title="Booking confirmation"
              blurb="Proforma stay note — not a tax invoice. Print or save as PDF."
              actions={
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2"
                  onClick={() => printDeskSheet("note")}
                >
                  <PrinterIcon className="size-4" />
                  Print / PDF
                </Button>
              }
            />

            {hasAgent ? (
              <ConfirmActionCard
                title="Agent voucher"
                blurb="For the agent — print desk copy or email the voucher text."
                actions={
                  <div className="flex w-full flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full gap-2"
                      onClick={() => printDeskSheet("voucher")}
                    >
                      <PrinterIcon className="size-4" />
                      Print voucher
                    </Button>
                    <div className="[&_button]:h-11 [&_button]:w-full">
                      <AgentVoucherEmailButton bookingId={bookingId} />
                    </div>
                  </div>
                }
              />
            ) : null}

            <ConfirmActionCard
              title="Arrival reg card"
              blurb="Guest and staff sign on paper at check-in / arrival."
              actions={
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2"
                  onClick={() => printDeskSheet("reg")}
                >
                  <PrinterIcon className="size-4" />
                  Print reg card
                </Button>
              }
            />
          </div>

          {/* Print sheets — targeted via html[data-desk-print] in globals.css */}
          <div className="desk-print-host" aria-hidden>
            <FastBookInvoice
              data={invoiceData}
              property={property}
              design={invoiceDesign}
              title="Booking confirmation"
            />
            {hasAgent ? (
              <FastBookVoucher
                data={voucherData}
                property={property}
                design={voucherDesign}
              />
            ) : null}
            <GuestRegistrationCard data={regData} property={property} />
          </div>
        </div>

        <footer className="shrink-0 space-y-2 border-t bg-background/95 px-4 py-3 sm:px-6 print:hidden">
          <Button
            type="button"
            variant="citrus"
            className="h-12 w-full text-base font-semibold"
            onClick={openStay}
          >
            Open stay
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onBookAnother?.()}
            >
              Book another
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11"
              onClick={() => onClose?.()}
            >
              Close
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <>
      <form
        action={action}
        className="erp flex min-h-0 flex-1 flex-col md:flex-row"
        onSubmit={(e) => {
          if (rateDiffers && !ratePin.trim()) {
            e.preventDefault();
            openRateDialog();
            return;
          }
          if (blockCredit) e.preventDefault();
          const readyErr =
            validateStep("stay") ||
            validateStep("guest") ||
            validateStep("source") ||
            validateStep("room");
          if (readyErr) {
            e.preventDefault();
            setStepError(readyErr);
          }
        }}
      >
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="source" value={bookedBy} />
        <input type="hidden" name="guest_origin" value={origin} />
        <input type="hidden" name="check_in" value={checkIn} />
        <input type="hidden" name="check_out" value={checkOut} />
        <input type="hidden" name="contact_name" value={guestName} />
        <input
          type="hidden"
          name="contact_phone"
          value={phoneLater ? "" : phone}
        />
        {phoneLater ? (
          <input type="hidden" name="phone_later" value="1" />
        ) : null}
        <input type="hidden" name="contact_email" value={email} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="promo_code" value={promoCode} />
        <input type="hidden" name="meal_plan_code" value={mealPlanCode} />
        <input type="hidden" name="payment_mode" value={paymentMode} />
        <input type="hidden" name="agent_id" value={billAgent ? agentId : ""} />
        <input
          type="hidden"
          name="sold_by_staff_id"
          value={soldByStaffId}
        />
        <input type="hidden" name="adults" value={String(adults)} />
        <input type="hidden" name="children" value={String(children)} />
        <input type="hidden" name="extra_beds" value={String(extraBeds)} />
        <input type="hidden" name="guide_number" value={guideNumber} />
        {!billAgent ? (
          <input type="hidden" name="rate_tier" value={walkinRateTier} />
        ) : null}
        <input type="hidden" name="passport_or_cid" value={docId} />
        <input
          type="hidden"
          name="sdf_ref"
          value={
            guestOrigin === "regional" || guestOrigin === "international"
              ? sdfRef
              : ""
          }
        />
        <input
          type="hidden"
          name="system_nightly_rate_btn"
          value={systemNightly != null ? String(systemNightly) : ""}
        />
        <input
          type="hidden"
          name="agreed_nightly_rate_btn"
          value={rateDiffers ? displayRate : ""}
        />
        <input type="hidden" name="manager_pin" value={ratePin} />
        {preferredUnitId ? (
          <input type="hidden" name="room_unit_id" value={preferredUnitId} />
        ) : null}
        {roomTypes.map((rt) => {
          let qtyVal = "0";
          if (rt.inventory_kind === "sellable_guest") {
            const line = roomLines.find((l) => l.roomTypeId === rt.id);
            qtyVal = line ? String(line.qty) : "0";
          } else if (
            rt.inventory_kind === "guide_comp" ||
            rt.inventory_kind === "driver_comp"
          ) {
            qtyVal = String(compQtyByTypeId[rt.id] ?? 0);
          }
          return (
            <input
              key={rt.id}
              type="hidden"
              name={`qty_${rt.code}`}
              value={qtyVal}
            />
          );
        })}

        {/* LEFT RAIL */}
        <aside
          className={cn(
            "flex shrink-0 flex-col gap-2 border-b bg-muted/20 p-2.5",
            "md:w-[13.5rem] md:border-b-0 md:border-r lg:w-60 lg:p-3",
          )}
        >
          <button
            type="button"
            onClick={openRateDialog}
            className={cn(
              "w-full rounded-md border bg-card px-2.5 py-2 text-left transition-colors",
              "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              rateDiffers &&
                "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {quotePending
                  ? "Price…"
                  : rateDiffers
                    ? "Custom nightly"
                    : "Sheet nightly"}
              </p>
              <PencilIcon className="size-3 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums lg:text-[1.75rem]">
              {displayRate && Number.isFinite(Number(displayRate))
                ? formatGuestBtn(Number(displayRate))
                : "—"}
            </p>
            <div className="mt-1.5 space-y-0.5 border-t border-border/60 pt-1.5 text-[10px]">
              {quoteRoomsStay != null && !rateDiffers ? (
                <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
                  <span>Rooms</span>
                  <span>{formatGuestBtn(quoteRoomsStay)}</span>
                </div>
              ) : null}
              {quoteMealStay > 0 && !rateDiffers ? (
                <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
                  <span>Meals</span>
                  <span>{formatGuestBtn(quoteMealStay)}</span>
                </div>
              ) : null}
              {quoteExtraStay > 0 && !rateDiffers ? (
                <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
                  <span>Extra beds</span>
                  <span>{formatGuestBtn(quoteExtraStay)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-2 pt-0.5">
                <p className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Stay total
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {stayTotal != null ? formatGuestBtn(stayTotal) : "—"}
                </p>
              </div>
            </div>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {nights}n · {totalGuestRooms} rm
              {mixedCategories ? " · multi" : ""}
              {mealPlanCode ? ` · ${mealPlanCode}` : ""}
            </p>
            {quoteHint ? (
              <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                {quoteHint}
              </p>
            ) : null}
          </button>

          <div className="rounded-md border bg-background/80 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
            <p className="truncate font-medium text-foreground">
              {guestName.trim() || "Walk-in guest"}
            </p>
            <p className="mt-0.5">
              {fmtShort(checkIn)} → {fmtShort(checkOut)} · {nights}n
            </p>
            <p className="mt-0.5 truncate">
              {roomLineSummary || "Pick rooms"}
            </p>
            {billAgent && selectedAgent ? (
              <p className="mt-1 truncate border-t border-border/50 pt-1 font-medium text-foreground">
                {selectedAgent.company_name}
                {isMouAgentTier(selectedAgent.rate_tier) ? " · MoU" : ""}
              </p>
            ) : (
              <p className="mt-1 truncate border-t border-border/50 pt-1 capitalize">
                {guestOrigin}
                {!billAgent ? ` · ${walkinRateTier.replace("_", " ")}` : ""}
              </p>
            )}
            {soldByStaffId && staff.length ? (
              <p className="mt-0.5 truncate text-[10px]">
                Sold by{" "}
                {staff.find((s) => s.id === soldByStaffId)?.full_name ?? "—"}
              </p>
            ) : null}
            {preferredUnitId ? (
              <p className="mt-0.5 truncate text-[10px] text-foreground">
                Rack {preferredUnitLabel || preferredUnitId.slice(0, 6)}
              </p>
            ) : null}
            {availStrip ? (
              <p className="mt-1 truncate border-t border-border/50 pt-1 text-[9px]">
                {availStrip}
              </p>
            ) : null}
          </div>

          {roomCapNear ? (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-950 dark:text-amber-50">
              Room cap soft warn:{" "}
              {agentOpenRooms ?? "?"} open + {totalGuestRooms} this book
              {agentRoomCap != null ? ` vs cap ${agentRoomCap}` : ""}. Block is
              at check-in only.
            </p>
          ) : null}

          <div className="hidden flex-1 md:block" />
          <p className="hidden text-[9px] leading-snug text-muted-foreground md:block">
            Tap price for custom rate (manager PIN). Live leftover updates with
            dates.
          </p>
        </aside>

        {/* RIGHT work pane */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-2 sm:px-3 md:px-4 md:py-2.5">
            {state.error ? (
              <Alert variant="destructive" className="mb-2 py-2">
                <TriangleAlertIcon />
                <AlertDescription className="text-xs">
                  {state.error}
                </AlertDescription>
              </Alert>
            ) : null}
            {stepError ? (
              <Alert variant="destructive" className="mb-2 py-2">
                <TriangleAlertIcon />
                <AlertDescription className="text-xs">
                  {stepError}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2.5">
              <section className="rounded-md border bg-card p-2 sm:p-2.5">
                <p className="mb-1.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Stay &amp; guest
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_ci"
                      className="text-[10px] text-muted-foreground"
                    >
                      Check-in
                    </Label>
                    <Input
                      id="db_ci"
                      type="date"
                      value={checkIn}
                      min={todayIso()}
                      onChange={(e) => onCheckInChange(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_co"
                      className="text-[10px] text-muted-foreground"
                    >
                      Check-out
                    </Label>
                    <Input
                      id="db_co"
                      type="date"
                      value={checkOut}
                      min={addDaysIso(checkIn, 1)}
                      onChange={(e) => onCheckOutChange(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">
                      Nights
                    </Label>
                    <div className="flex h-9 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="size-9 shrink-0"
                        onClick={() => setNights(nights - 1)}
                        aria-label="Fewer nights"
                      >
                        −
                      </Button>
                      <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
                        {nights}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="size-9 shrink-0"
                        onClick={() => setNights(nights + 1)}
                        aria-label="More nights"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-0.5 sm:col-span-2 lg:col-span-3">
                    <Label
                      htmlFor="db_name"
                      className="text-[10px] text-muted-foreground"
                    >
                      Guest name
                    </Label>
                    <Input
                      id="db_name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      autoComplete="off"
                      className="h-9"
                      placeholder="Lead guest"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_phone"
                      className="text-[10px] text-muted-foreground"
                    >
                      Phone
                    </Label>
                    <Input
                      id="db_phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={phoneLater}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_email"
                      className="text-[10px] text-muted-foreground"
                    >
                      Email
                    </Label>
                    <Input
                      id="db_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-span-2 flex items-end pb-1 sm:col-span-1">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={phoneLater}
                        onChange={(e) => setPhoneLater(e.target.checked)}
                        className="size-3.5 accent-foreground"
                      />
                      Phone later
                    </label>
                  </div>
                </div>
                {preferredUnitId ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-sky-500/25 bg-sky-500/5 px-2 py-1 text-[11px]">
                    <span className="font-medium text-foreground">
                      Preferred rack room
                    </span>
                    <span className="tabular-nums">
                      {preferredUnitLabel || preferredUnitId.slice(0, 8)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setPreferredUnitId("")}
                    >
                      Clear
                    </Button>
                  </div>
                ) : null}
              </section>

              <section className="rounded-md border bg-card p-2 sm:p-2.5">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1">
                  <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Origin · bill · staff
                  </p>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium">
                    <input
                      type="checkbox"
                      checked={billAgent}
                      onChange={(e) => setBillAgent(e.target.checked)}
                      className="size-3.5 accent-foreground"
                    />
                    Bill to agent
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {ORIGIN_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setGuestOrigin(c.id)}
                      className={cn(
                        "h-8 rounded-md border text-xs font-semibold transition-colors",
                        guestOrigin === c.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background hover:bg-muted/50",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {guestOrigin === "local" ? (
                    <div className="space-y-0.5 sm:col-span-2">
                      <Label
                        htmlFor="db_cid"
                        className="text-[10px] text-muted-foreground"
                      >
                        CID (optional)
                      </Label>
                      <Input
                        id="db_cid"
                        value={docId}
                        onChange={(e) => setDocId(e.target.value)}
                        placeholder="11 digits"
                        className="h-9"
                        inputMode="numeric"
                      />
                    </div>
                  ) : null}

                  {guestOrigin === "regional" || guestOrigin === "official" ? (
                    <>
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="db_pass_r"
                          className="text-[10px] text-muted-foreground"
                        >
                          Passport / voter
                        </Label>
                        <Input
                          id="db_pass_r"
                          value={docId}
                          onChange={(e) => setDocId(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="db_sdf_r"
                          className="text-[10px] text-muted-foreground"
                        >
                          SDF (optional)
                        </Label>
                        <Input
                          id="db_sdf_r"
                          value={sdfRef}
                          onChange={(e) => setSdfRef(e.target.value)}
                          className="h-9"
                          disabled={guestOrigin === "official"}
                        />
                      </div>
                    </>
                  ) : null}

                  {guestOrigin === "international" ? (
                    <>
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="db_pass_i"
                          className="text-[10px] text-muted-foreground"
                        >
                          Passport
                        </Label>
                        <Input
                          id="db_pass_i"
                          value={docId}
                          onChange={(e) => setDocId(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="db_sdf_i"
                          className="text-[10px] text-muted-foreground"
                        >
                          SDF
                        </Label>
                        <Input
                          id="db_sdf_i"
                          value={sdfRef}
                          onChange={(e) => setSdfRef(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-0.5 sm:col-span-2">
                        <Label
                          htmlFor="db_guide"
                          className="text-[10px] text-muted-foreground"
                        >
                          Guide number (required)
                        </Label>
                        <Input
                          id="db_guide"
                          value={guideNumber}
                          onChange={(e) => setGuideNumber(e.target.value)}
                          className="h-9"
                          placeholder="Guide #"
                        />
                      </div>
                    </>
                  ) : null}

                  {billAgent ? (
                    <>
                      <div className="space-y-0.5 sm:col-span-2">
                        <Label className="text-[10px] text-muted-foreground">
                          Agent
                        </Label>
                        <AgentPicker
                          agents={pickerAgents}
                          value={agentId}
                          onValueChange={(id) => {
                            setAgentId(id);
                            if (id) setPaymentMode("on_credit");
                          }}
                          creditMode={paymentMode === "on_credit"}
                          className="h-9 min-h-9"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">
                          Payment
                        </Label>
                        <Select
                          value={paymentMode}
                          onValueChange={setPaymentMode}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_credit">On credit</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="prepaid">Prepaid</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                        {paymentMode === "partial" || paymentMode === "prepaid" ? (
                          <p className="text-[10px] text-muted-foreground">
                            Collect balance later on Folio.
                          </p>
                        ) : null}
                      </div>
                      {blockCredit && selectedAgent ? (
                        <div className="sm:col-span-2">
                          <CreditAgentPromotePanel
                            agent={selectedAgent}
                            variant="compact"
                            onPromoted={(a) =>
                              setAgentPatches((p) => ({ ...p, [a.id]: a }))
                            }
                            onUseCash={() => {
                              setPaymentMode("cash");
                              toast.message("Payment set to cash", {
                                description:
                                  "Agent stays as directory listing (no credit).",
                              });
                            }}
                          />
                        </div>
                      ) : null}
                      {selectedAgent &&
                      paymentMode === "on_credit" &&
                      !blockCredit ? (
                        <p className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-900 sm:col-span-2 dark:text-emerald-100">
                          {selectedAgent.company_name} · credit OK
                          {agentOpenRooms != null && agentRoomCap != null
                            ? ` · open ${agentOpenRooms}/${agentRoomCap}`
                            : ""}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-0.5 sm:col-span-2">
                      <Label className="text-[10px] text-muted-foreground">
                        Rate tier (walk-in sheet)
                      </Label>
                      <div className="grid grid-cols-4 gap-1">
                        {WALKIN_TIERS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setWalkinRateTier(t.id);
                              setRateDirty(false);
                            }}
                            className={cn(
                              "h-8 rounded-md border text-[11px] font-semibold",
                              walkinRateTier === t.id
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background hover:bg-muted/50",
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-0.5 sm:col-span-2">
                    <Label className="text-[10px] text-muted-foreground">
                      Sold by (staff)
                    </Label>
                    <StaffPicker
                      staff={staff}
                      value={soldByStaffId}
                      onValueChange={setSoldByStaffId}
                      className="h-9 min-h-9"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-md border bg-card p-2 sm:p-2.5">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1">
                  <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Rooms · comps · meal · pax
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {totalGuestRooms} guest room
                    {totalGuestRooms === 1 ? "" : "s"}
                    {mixedCategories ? " · multi" : ""}
                  </p>
                </div>

                <ul className="space-y-1">
                  {roomLines.map((line) => {
                    const rt = guestTypes.find((g) => g.id === line.roomTypeId);
                    if (!rt) return null;
                    const left = leftFor(line.roomTypeId, rt.unit_count || 20);
                    const qLine = quoteLines.find(
                      (q) => q.roomTypeId === line.roomTypeId,
                    );
                    return (
                      <li
                        key={line.roomTypeId}
                        className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">
                            {rt.name}
                            <span className="ml-1 font-normal text-muted-foreground">
                              {rt.code}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {left} left
                            {qLine?.nightlyBtn != null
                              ? ` · ${formatGuestBtn(qLine.nightlyBtn)}/n`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="size-8"
                            onClick={() =>
                              setLineQty(line.roomTypeId, line.qty - 1)
                            }
                            aria-label={`Decrease ${rt.name}`}
                          >
                            −
                          </Button>
                          <span className="min-w-[1.25rem] text-center text-sm font-semibold tabular-nums">
                            {line.qty}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="size-8"
                            disabled={line.qty >= left}
                            onClick={() =>
                              setLineQty(line.roomTypeId, line.qty + 1)
                            }
                            aria-label={`Increase ${rt.name}`}
                          >
                            +
                          </Button>
                          {roomLines.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-1.5 text-[10px] text-muted-foreground"
                              onClick={() => removeLine(line.roomTypeId)}
                            >
                              ×
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {typesAvailableToAdd.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Select
                      value={addCategoryId || undefined}
                      onValueChange={setAddCategoryId}
                    >
                      <SelectTrigger className="h-8 min-w-[9rem] flex-1 text-xs">
                        <SelectValue placeholder="Add room type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {typesAvailableToAdd.map((rt) => {
                          const left = leftFor(rt.id, rt.unit_count || 0);
                          return (
                            <SelectItem
                              key={rt.id}
                              value={rt.id}
                              disabled={left < 1}
                            >
                              {rt.name}
                              {left < 1 ? " · sold" : ` · ${left} left`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={!addCategoryId}
                      onClick={() => addCategoryLine(addCategoryId)}
                    >
                      Add
                    </Button>
                  </div>
                ) : null}

                {compTypes.length > 0 ? (
                  <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    <p className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Guide / driver beds
                    </p>
                    <ul className="space-y-1">
                      {compTypes.map((rt) => {
                        const qty = compQtyByTypeId[rt.id] ?? 0;
                        const left = leftFor(rt.id, rt.unit_count || 8);
                        return (
                          <li
                            key={rt.id}
                            className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {rt.name}
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  {rt.inventory_kind === "guide_comp"
                                    ? "guide"
                                    : "driver"}{" "}
                                  · {left} left
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                className="size-8"
                                disabled={qty <= 0}
                                onClick={() => setCompQty(rt.id, qty - 1)}
                              >
                                −
                              </Button>
                              <span className="min-w-[1.25rem] text-center text-sm font-semibold tabular-nums">
                                {qty}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                className="size-8"
                                disabled={qty >= left}
                                onClick={() => setCompQty(rt.id, qty + 1)}
                              >
                                +
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">
                      Meal
                    </Label>
                    <Select
                      value={mealPlanCode}
                      onValueChange={setMealPlanCode}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(mealPlans.length
                          ? mealPlans
                          : [
                              {
                                code: "EP",
                                name: "Room only",
                                blurb: null,
                              },
                            ]
                        ).map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.code} · {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_adults"
                      className="text-[10px] text-muted-foreground"
                    >
                      Adults
                    </Label>
                    <Input
                      id="db_adults"
                      type="number"
                      min={1}
                      max={24}
                      value={adults}
                      onChange={(e) => setAdults(Number(e.target.value) || 1)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_children"
                      className="text-[10px] text-muted-foreground"
                    >
                      Children
                    </Label>
                    <Input
                      id="db_children"
                      type="number"
                      min={0}
                      max={12}
                      value={children}
                      onChange={(e) =>
                        setChildren(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_extra_beds"
                      className="text-[10px] text-muted-foreground"
                    >
                      Extra beds
                    </Label>
                    <Input
                      id="db_extra_beds"
                      type="number"
                      min={0}
                      max={8}
                      value={extraBeds}
                      onChange={(e) =>
                        setExtraBeds(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="h-9"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-md border bg-card p-2 sm:p-2.5">
                <p className="mb-1.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Notes · promo
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <div className="space-y-0.5 sm:col-span-2">
                    <Label
                      htmlFor="db_notes"
                      className="text-[10px] text-muted-foreground"
                    >
                      Stay notes
                    </Label>
                    <Textarea
                      id="db_notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="min-h-[2.5rem] resize-y text-sm"
                      placeholder="ETA, special requests…"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="db_promo"
                      className="text-[10px] text-muted-foreground"
                    >
                      Promo code
                    </Label>
                    <Input
                      id="db_promo"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="h-9 uppercase"
                      placeholder="Optional"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t bg-background/95 px-2.5 py-2 sm:px-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="submit"
                variant="outline"
                disabled={pending || blockCredit || totalGuestRooms < 1}
                className="h-9 px-3 text-xs"
                onClick={() => setIntent("reserve")}
              >
                Hold
              </Button>
              <Button
                type="submit"
                variant="secondary"
                disabled={
                  pending ||
                  blockCredit ||
                  totalGuestRooms < 1 ||
                  !guestName.trim()
                }
                className="h-9 px-3 text-xs"
                onClick={() => setIntent("check_in")}
              >
                Save → check-in
              </Button>
              <Button
                type="submit"
                variant="citrus"
                disabled={
                  pending ||
                  blockCredit ||
                  totalGuestRooms < 1 ||
                  !guestName.trim()
                }
                className="ml-auto h-9 min-w-[10rem] flex-1 text-sm font-semibold sm:flex-none"
                onClick={() => setIntent("confirm")}
              >
                {pending && intent === "confirm"
                  ? "Saving…"
                  : checkIn === todayIso()
                    ? "Confirm & check-in"
                    : "Confirm booking"}
              </Button>
            </div>
          </div>
        </div>

      </form>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="erp sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change nightly rate</DialogTitle>
            <DialogDescription>
              {systemNightly != null
                ? mixedCategories
                  ? `Blended sheet ~${formatGuestBtn(systemNightly)}/room-night across categories. PIN if you set a special.`
                  : `System rate ${formatGuestBtn(systemNightly)}. Manager PIN if different.`
                : "No sheet rate — manager PIN required."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="rate_edit">Nightly Nu</Label>
              <Input
                id="rate_edit"
                type="number"
                min={0}
                step={5}
                value={draftRate}
                onChange={(e) => setDraftRate(e.target.value)}
                className="h-14 text-2xl font-semibold tabular-nums"
                autoFocus
              />
            </div>
            {draftDiffers ? (
              <div className="space-y-1.5 duration-150 animate-in fade-in">
                <Label htmlFor="rate_pin">Manager PIN</Label>
                <Input
                  id="rate_pin"
                  type="password"
                  autoComplete="off"
                  value={draftPin}
                  onChange={(e) => setDraftPin(e.target.value)}
                  className="h-12"
                  placeholder="Required for custom rate"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPinOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="citrus"
              disabled={
                !Number.isFinite(Number(draftRate)) ||
                (draftDiffers && !draftPin.trim())
              }
              onClick={applyRateDialog}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConfirmActionCard({
  title,
  blurb,
  actions,
}: {
  title: string;
  blurb: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
        {title}
      </p>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{blurb}</p>
      <div className="mt-4">{actions}</div>
    </div>
  );
}
