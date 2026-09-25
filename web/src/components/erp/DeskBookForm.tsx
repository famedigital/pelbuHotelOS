"use client";

import {
  createFastBooking,
  type DeskBookIntent,
  type FastBookState,
} from "@/app/actions/fast-book";
import {
  previewDeskStayQuote,
  type DeskAvailLine,
} from "@/app/actions/desk-book-preview";
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
import { useActionToast } from "@/hooks/use-action-toast";
import { useAgentCreditEligibilityNotify } from "@/hooks/use-agent-credit-eligibility-notify";
import { creditAgentIneligibilityMessage } from "@/lib/agents/status";
import type {
  PropertyDocumentDesign,
  PropertyRegistrationDesign,
} from "@/lib/property-settings";
import { formatGuestBtn } from "@/lib/pricing";
import { printDeskSheet } from "@/lib/desk-print";
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
  /** Clean / inspect units for FO "clean rooms only" pick. */
  cleanUnits?: {
    id: string;
    label: string;
    roomTypeId: string;
    hkStatus: string;
  }[];
  defaultSoldByStaffId?: string;
  mealPlans?: {
    code: string;
    name: string;
    blurb: string | null;
    amountPerAdultNight?: number | null;
  }[];
  /** Owner/GM session — custom rates confirm instantly (PIN still accepted). */
  canInstantApproveRates?: boolean;
  property?: {
    id?: string;
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
  registrationDesign?: PropertyRegistrationDesign;
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
type WalkinRateTier = "public" | "friends" | "family" | "mutual_friends";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Pay at checkout",
  prepaid: "Prepaid",
  partial: "Partial / deposit",
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

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-border/70 p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            value === opt.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Comp posts agreed 0; rack must not send stale zero from a prior comp toggle. */
function quoteAgreedNightly(
  line: { agreedNightlyBtn: number | null },
  guestRateKind: "rack" | "comp",
): number | null {
  if (guestRateKind === "comp") return 0;
  if (line.agreedNightlyBtn == null || line.agreedNightlyBtn === 0) return null;
  return line.agreedNightlyBtn;
}

function lineDisplayNightly(
  line: {
    agreedNightlyBtn: number | null;
    sheetNightlyBtn: number | null;
  },
  qLine: { nightlyBtn: number | null } | undefined,
  guestRateKind: "rack" | "comp",
  packageNightly: number | null,
  singleCategory: boolean,
): number | null {
  if (guestRateKind === "comp") return 0;
  if (line.agreedNightlyBtn != null && line.agreedNightlyBtn > 0) {
    return line.agreedNightlyBtn;
  }
  if (singleCategory && packageNightly != null) return packageNightly;
  return line.sheetNightlyBtn ?? qLine?.nightlyBtn ?? null;
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

function focusNextFoField(form: HTMLFormElement, from: EventTarget | null) {
  const nodes = Array.from(
    form.querySelectorAll<HTMLElement>("[data-fo-tab]"),
  ).filter((n) => {
    if (n.closest("details:not([open])")) return false;
    return n.offsetParent !== null || n.getClientRects().length > 0;
  });
  const el = from instanceof HTMLElement ? from : null;
  const i = nodes.findIndex((n) => n === el || n.contains(el));
  const next = nodes[Math.min(nodes.length - 1, Math.max(0, i) + 1)];
  next?.focus();
}
/**
 * Desk book modal: StayHub-style left identity/price rail + dense work pane.
 */
export function DeskBookForm({
  roomTypes,
  agents,
  staff = [],
  cleanUnits = [],
  defaultSoldByStaffId = "",
  mealPlans = [],
  property,
  invoiceDesign,
  voucherDesign,
  registrationDesign,
  defaults,
  canInstantApproveRates = false,
  onSaved,
  onOpenStay,
  onBookAnother,
  onClose,
  onCreated,
}: DeskBookFormProps) {
  const [state, action, pending] = useActionState(createFastBooking, initial);
  useActionToast(state, {
    successMessage: state.ratePendingApproval
      ? `Held · awaiting GM rate approval · ${
          state.confirmationCode ??
          state.bookingId?.slice(0, 8).toUpperCase() ??
          ""
        }`
      : state.bookingId
        ? `Saved · ${
            state.confirmationCode ??
            state.bookingId.slice(0, 8).toUpperCase()
          }`
        : "Reservation saved",
  });
  useEffect(() => {
    if (!state.ok || !state.warnings?.length) return;
    for (const w of state.warnings) {
      toast.warning(w);
    }
  }, [state.ok, state.warnings]);
  const savedNotified = useRef(false);
  /** Ignore stale async quote responses (prevents rack/comp rate flicker). */
  const quoteGenRef = useRef(0);

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
  const preferredUnitLabel =
    defaults?.roomUnitLabel?.trim() ||
    cleanUnits.find((u) => u.id === preferredUnitId)?.label ||
    null;
  const [cleanOnly, setCleanOnly] = useState(false);
  const [rateTaxMode, setRateTaxMode] = useState<"inclusive" | "exclusive">(
    "exclusive",
  );
  const [taxExemptGst, setTaxExemptGst] = useState(false);
  const [taxExemptService, setTaxExemptService] = useState(false);
  const [taxExemptBst, setTaxExemptBst] = useState(false);
  const [releaseDays, setReleaseDays] = useState("");
  const [releasePercent, setReleasePercent] = useState("");
  const [mealPlanCode, setMealPlanCode] = useState(
    defaults?.mealPlanCode ?? mealPlans[0]?.code ?? "EP",
  );
  const [adults, setAdults] = useState(2);
  /** Room rate occupancy (sheet single vs double Nu). Headcount may still rise above 2. */
  const [occupancy, setOccupancy] = useState<"single" | "double">("double");
  const [children, setChildren] = useState(0);
  const [extraBeds, setExtraBeds] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  /** Multi-category guest room cart (one booking · many booking_rooms). */
  type RoomCartLine = {
    roomTypeId: string;
    qty: number;
    mealPlanCode: string;
    occupancy: "single" | "double";
    adults: number;
    children: number;
    extraBeds: number;
    sheetNightlyBtn: number | null;
    agreedNightlyBtn: number | null;
    ratePendingApproval: boolean;
  };
  const defaultMeal = defaults?.mealPlanCode ?? mealPlans[0]?.code ?? "EP";
  const makeLine = (
    roomTypeId: string,
    qty: number,
    base?: Partial<RoomCartLine>,
  ): RoomCartLine => ({
    roomTypeId,
    qty,
    mealPlanCode: base?.mealPlanCode ?? defaultMeal,
    occupancy: base?.occupancy ?? "double",
    adults: base?.adults ?? 2,
    children: base?.children ?? 0,
    extraBeds: base?.extraBeds ?? 0,
    sheetNightlyBtn: base?.sheetNightlyBtn ?? null,
    agreedNightlyBtn: base?.agreedNightlyBtn ?? null,
    ratePendingApproval: base?.ratePendingApproval ?? false,
  });
  const [roomLines, setRoomLines] = useState<RoomCartLine[]>(() => {
    const seeded = guestTypes
      .filter((g) => (defaults?.qtyByCode?.[g.code] ?? 0) > 0)
      .map((g) =>
        makeLine(g.id, Math.max(1, defaults?.qtyByCode?.[g.code] ?? 1)),
      );
    if (seeded.length > 0) return seeded;
    if (guestTypes[0]) return [makeLine(guestTypes[0].id, 1)];
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
  const [rateEditLineId, setRateEditLineId] = useState<string | null>(null);
  const [rateEditReason, setRateEditReason] = useState("");
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
      sheetNightlyBtn?: number | null;
    }>
  >([]);
  const [remainingByType, setRemainingByType] = useState<
    Record<string, number>
  >({});
  const [availByType, setAvailByType] = useState<
    Record<string, DeskAvailLine>
  >({});
  const [guestRateKind, setGuestRateKind] = useState<"rack" | "comp">("rack");
  const [agentOpenRooms, setAgentOpenRooms] = useState<number | null>(null);
  const [agentRoomCap, setAgentRoomCap] = useState<number | null>(null);
  const [quotePending, startQuote] = useTransition();
  const [intent, setIntent] = useState<DeskBookIntent>("confirm");
  const [agentPatches, setAgentPatches] = useState<
    Record<string, BookableAgent>
  >({});

  /** Prefer server intent after save — client state can lag submit-button FormData. */
  const skipConfirmationPack = useMemo(() => {
    const i =
      state.ok && state.intent ? state.intent : intent;
    if (i === "check_in") return true;
    if (i === "confirm" && checkIn === todayIso()) return true;
    return false;
  }, [intent, checkIn, state.ok, state.intent]);

  const pickerAgents = useMemo(() => {
    const extras = Object.values(agentPatches).filter(
      (p) => !agents.some((a) => a.id === p.id),
    );
    return [...agents.map((a) => agentPatches[a.id] ?? a), ...extras];
  }, [agents, agentPatches]);

  const selectedAgent =
    pickerAgents.find((a) => a.id === agentId) ?? null;

  const bookedBy = useMemo(() => {
    if (!agentId) return "reservation";
    if (isMouAgentTier(selectedAgent?.rate_tier)) return "mou_agent";
    return "agent";
  }, [agentId, selectedAgent?.rate_tier]);

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
          rateBtn: Number.isFinite(Number(displayRate))
            ? Number(displayRate)
            : null,
        };
      })
      .filter(Boolean) as Array<{
      name: string;
      code: string;
      qty: number;
      kind: string;
      rateBtn?: number | null;
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
          rateBtn: 0,
          amountBtn: 0,
        };
      })
      .filter(Boolean) as Array<{
      name: string;
      code: string;
      qty: number;
      kind: string;
      rateBtn?: number | null;
      amountBtn?: number | null;
    }>;
    return [...guest, ...comps];
  }, [roomLines, guestTypes, compTypes, compQtyByTypeId, displayRate]);

  const availStrip = useMemo(() => {
    return roomLines
      .map((l) => {
        const rt = guestTypes.find((g) => g.id === l.roomTypeId);
        if (!rt) return null;
        const a = availByType[l.roomTypeId];
        const cap = a?.capacity ?? rt.unit_count;
        const sold = a?.sold ?? Math.max(0, cap - (remainingByType[l.roomTypeId] ?? cap));
        const rem =
          a?.remaining ?? remainingByType[l.roomTypeId] ?? rt.unit_count;
        const ob = Math.max(sold - cap, 0);
        const code = (rt.code || rt.name).trim();
        return `${code} T${cap} · S${sold} · A${rem}${ob > 0 ? ` · OB${ob}` : ""}`;
      })
      .filter(Boolean)
      .join(" · ");
  }, [roomLines, guestTypes, remainingByType, availByType]);

  const assignUnits = useMemo(() => {
    const typeIds = new Set(roomLines.map((l) => l.roomTypeId));
    let list = cleanUnits.filter(
      (u) => typeIds.size === 0 || typeIds.has(u.roomTypeId),
    );
    if (cleanOnly) {
      list = list.filter((u) =>
        ["clean", "inspect"].includes((u.hkStatus || "").toLowerCase()),
      );
    }
    return list;
  }, [cleanUnits, roomLines, cleanOnly]);

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
  }

  function patchLine(roomTypeId: string, patch: Partial<RoomCartLine>) {
    setRoomLines((prev) =>
      prev.map((l) => (l.roomTypeId === roomTypeId ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(roomTypeId: string) {
    setRoomLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.roomTypeId !== roomTypeId);
    });
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
    setRoomLines((prev) => [
      ...prev,
      makeLine(roomTypeId, 1, {
        mealPlanCode: mealPlanCode || defaultMeal,
        occupancy,
        adults,
        children,
        extraBeds,
      }),
    ]);
    setAddCategoryId("");
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
    const quoteGen = ++quoteGenRef.current;
    const rateKindAtRequest = guestRateKind;
    startQuote(async () => {
      const r = await previewDeskStayQuote({
        checkIn,
        checkOut,
        lines: roomLines.map((l) => ({
          roomTypeId: l.roomTypeId,
          qty: l.qty,
          occupancy: l.occupancy,
          mealPlanCode: l.mealPlanCode,
          adults: l.adults,
          children: l.children,
          extraBeds: l.extraBeds,
          agreedNightlyBtn: quoteAgreedNightly(l, rateKindAtRequest),
        })),
        adults,
        occupancy,
        children,
        extraBeds,
        mealPlanCode,
        source: bookedBy,
        agentId: agentId || null,
        rateTier: agentId ? null : walkinRateTier,
      });
      if (quoteGen !== quoteGenRef.current) return;
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
      const occNote = occupancy === "single" ? " · SGL" : " · DBL";
      setQuoteHint(
        r.systemNightlyBtn == null
          ? "No rate — enter a rate (manager PIN)."
          : `${r.seasonKind} · ${r.rateTier}${occNote}${mixNote}${pkgNote}`,
      );
      setSystemNightly(r.systemNightlyBtn);
      setQuoteRoomsStay(r.stayRoomsBtn);
      setQuotePackageStay(r.packageStayBtn);
      setQuoteMealStay(r.mealStayBtn);
      setQuoteExtraStay(r.extraBedStayBtn);
      setQuoteLines(r.lines);
      setRemainingByType(r.remainingByRoomTypeId ?? {});
      setAvailByType(
        Object.fromEntries(
          (r.availability ?? []).map((a) => [a.roomTypeId, a]),
        ),
      );
      setAgentOpenRooms(r.agentOpenRooms);
      setAgentRoomCap(r.agentRoomCap);
      setRoomLines((prev) => {
        const next = prev.map((l) => {
          const q = r.lines.find((x) => x.roomTypeId === l.roomTypeId);
          if (!q) return l;
          const sheet =
            q.sheetNightlyBtn != null
              ? q.sheetNightlyBtn
              : l.agreedNightlyBtn == null
                ? q.nightlyBtn
                : l.sheetNightlyBtn;
          if (rateKindAtRequest === "comp") {
            return {
              ...l,
              sheetNightlyBtn: sheet ?? l.sheetNightlyBtn,
              agreedNightlyBtn: 0,
              ratePendingApproval: false,
            };
          }
          const customAgreed =
            l.agreedNightlyBtn != null &&
            l.agreedNightlyBtn > 0 &&
            (sheet == null ||
              Math.abs(l.agreedNightlyBtn - sheet) > 0.009);
          return {
            ...l,
            sheetNightlyBtn: sheet ?? l.sheetNightlyBtn,
            agreedNightlyBtn: customAgreed ? l.agreedNightlyBtn : null,
            ratePendingApproval: customAgreed
              ? l.ratePendingApproval
              : false,
          };
        });
        const unchanged = prev.every(
          (l, i) =>
            l.sheetNightlyBtn === next[i]?.sheetNightlyBtn &&
            l.agreedNightlyBtn === next[i]?.agreedNightlyBtn &&
            l.ratePendingApproval === next[i]?.ratePendingApproval,
        );
        return unchanged ? prev : next;
      });
      const nightlyDisplay = r.packageNightlyBtn ?? r.systemNightlyBtn;
      if (rateKindAtRequest === "comp") {
        setDisplayRate("0");
      } else if (!rateDirty && nightlyDisplay != null) {
        setDisplayRate(String(Math.round(nightlyDisplay)));
      }
    });
  }, [
    roomLines,
    totalGuestRooms,
    checkIn,
    checkOut,
    nights,
    adults,
    occupancy,
    children,
    extraBeds,
    mealPlanCode,
    bookedBy,
    billAgent,
    agentId,
    walkinRateTier,
    rateDirty,
    guestRateKind,
  ]);

  useEffect(() => {
    refreshQuote();
  }, [refreshQuote]);

  // Stay-level pax mirrors sum of category lines (FO form header + server fallback).
  useEffect(() => {
    if (roomLines.length === 0) return;
    let a = 0;
    let c = 0;
    let e = 0;
    for (const l of roomLines) {
      a += l.adults * l.qty;
      c += l.children * l.qty;
      e += l.extraBeds * l.qty;
    }
    if (a >= 1) setAdults(a);
    setChildren(c);
    setExtraBeds(e);
    setMealPlanCode(roomLines[0]?.mealPlanCode ?? mealPlanCode);
    setOccupancy(roomLines[0]?.occupancy ?? occupancy);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from roomLines only
  }, [roomLines]);

  useEffect(() => {
    if (billAgent) {
      if (paymentMode === "cash") setPaymentMode("on_credit");
    } else if (paymentMode === "on_credit") {
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
      // Same-day confirm / Save→CI → open StayHub on Check-in (not Details)
      (onOpenStay ?? onCreated)?.(state.bookingId, "check_in");
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

  const anyLineCustomRate = roomLines.some((l) => {
    if (guestRateKind === "comp") return false;
    if (l.agreedNightlyBtn == null || l.agreedNightlyBtn <= 0) return false;
    if (l.sheetNightlyBtn == null) return true;
    return Math.abs(l.agreedNightlyBtn - l.sheetNightlyBtn) > 0.009;
  });
  const anyRatePendingSubmit =
    anyLineCustomRate && !canInstantApproveRates && !ratePin.trim();

  const editedRate = Number(displayRate);
  const packageNightlyPerRoom = useMemo(() => {
    if (
      quotePackageStay != null &&
      nights > 0 &&
      totalGuestRooms > 0
    ) {
      return quotePackageStay / (totalGuestRooms * nights);
    }
    if (systemNightly != null) return systemNightly;
    return null;
  }, [quotePackageStay, nights, totalGuestRooms, systemNightly]);

  const rateDiffers =
    guestRateKind === "comp"
      ? false
      : (systemNightly != null &&
          Number.isFinite(editedRate) &&
          Math.abs(editedRate - systemNightly) > 0.009) ||
        (systemNightly == null &&
          displayRate.trim() !== "" &&
          Number.isFinite(editedRate)) ||
        anyLineCustomRate;

  /** Package total from quote (per-line rates already included). */
  const stayTotal = useMemo(() => {
    if (quotePackageStay != null) return quotePackageStay;
    if (
      Number.isFinite(editedRate) &&
      nights > 0 &&
      totalGuestRooms > 0
    ) {
      return editedRate * nights * totalGuestRooms;
    }
    return null;
  }, [editedRate, nights, totalGuestRooms, quotePackageStay]);

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

  const openRateDialog = (roomTypeId?: string) => {
    const line = roomTypeId
      ? roomLines.find((l) => l.roomTypeId === roomTypeId)
      : roomLines.length === 1
        ? roomLines[0]
        : null;
    setRateEditLineId(line?.roomTypeId ?? roomTypeId ?? null);
    const sheet = line?.sheetNightlyBtn ?? systemNightly;
    const current =
      line?.agreedNightlyBtn ??
      line?.sheetNightlyBtn ??
      (displayRate.trim()
        ? Number(displayRate)
        : sheet != null
          ? sheet
          : null);
    setDraftRate(
      current != null && Number.isFinite(current)
        ? String(Math.round(Number(current)))
        : "",
    );
    setDraftPin(ratePin);
    setRateEditReason("");
    setPinOpen(true);
  };

  const applyGuestRateKind = (kind: "rack" | "comp") => {
    quoteGenRef.current += 1;
    setGuestRateKind(kind);
    if (kind === "comp") {
      setRateDirty(false);
      setDisplayRate("0");
      setRateEditReason("comp");
      setRatePin("");
      setRoomLines((prev) =>
        prev.map((l) => ({
          ...l,
          agreedNightlyBtn: 0,
          ratePendingApproval: false,
        })),
      );
      return;
    }
    setRateDirty(false);
    setRateEditReason("");
    setRoomLines((prev) =>
      prev.map((l) => ({
        ...l,
        agreedNightlyBtn: null,
        ratePendingApproval: false,
      })),
    );
  };

  const applyRateDialog = () => {
    const n = Number(draftRate);
    if (!Number.isFinite(n) || n < 0) return;

    const lineId = rateEditLineId;
    const targetLines = lineId
      ? roomLines.filter((l) => l.roomTypeId === lineId)
      : roomLines;
    if (targetLines.length === 0) {
      setPinOpen(false);
      return;
    }

    const sheetRef =
      targetLines[0]?.sheetNightlyBtn ??
      (targetLines.length === 1 ? systemNightly : null);
    const differs =
      sheetRef == null || Math.abs(n - sheetRef) > 0.009;

    // Custom rate: GM session or PIN → instant; FO without PIN → pending approval
    if (differs && !canInstantApproveRates && draftPin.trim()) {
      setRatePin(draftPin);
    } else if (differs && canInstantApproveRates) {
      setRatePin(draftPin.trim() || ratePin);
    } else if (!differs) {
      setRatePin("");
    }

    setRoomLines((prev) =>
      prev.map((l) => {
        if (lineId && l.roomTypeId !== lineId) return l;
        if (!differs) {
          return {
            ...l,
            agreedNightlyBtn: null,
            ratePendingApproval: false,
          };
        }
        return {
          ...l,
          agreedNightlyBtn: Math.round(n),
          ratePendingApproval: !canInstantApproveRates && !draftPin.trim(),
        };
      }),
    );
    setDisplayRate(String(Math.round(n)));
    setRateDirty(true);
    setGuestRateKind(Math.round(n) === 0 && differs ? "comp" : "rack");
    setPinOpen(false);
    setRateEditLineId(null);
  };

  const draftDiffers = (() => {
    const line = rateEditLineId
      ? roomLines.find((l) => l.roomTypeId === rateEditLineId)
      : null;
    const sheet = line?.sheetNightlyBtn ?? systemNightly;
    return (
      sheet == null ||
      !Number.isFinite(Number(draftRate)) ||
      Math.abs(Number(draftRate) - (sheet ?? -1)) > 0.009
    );
  })();

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
      totalBtn: stayTotal,
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
            <GuestRegistrationCard
              data={regData}
              property={property}
              design={registrationDesign}
            />
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
          // Custom rates without GM/PIN → hold for approval (do not block submit).
          if (
            rateDiffers &&
            !canInstantApproveRates &&
            !ratePin.trim() &&
            !anyLineCustomRate
          ) {
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
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const next: DeskBookIntent =
              checkIn === todayIso() ? "check_in" : "confirm";
            setIntent(next);
            // Submit via the citrus button so FormData gets its name="intent" value
            // (React setState is too late for the same-tick submit).
            const form = e.currentTarget as HTMLFormElement;
            const btn = form.querySelector<HTMLButtonElement>(
              `button[type="submit"][name="intent"][value="${next}"]`,
            );
            if (btn && !btn.disabled) form.requestSubmit(btn);
            return;
          }
          if (e.key !== "Enter") return;
          const t = e.target as HTMLElement;
          if (t.tagName === "TEXTAREA") return;
          if (t.closest("button[type='submit']")) return;
          e.preventDefault();
          focusNextFoField(e.currentTarget, e.target);
        }}
      >
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
        <input type="hidden" name="agent_id" value={agentId} />
        <input
          type="hidden"
          name="sold_by_staff_id"
          value={soldByStaffId}
        />
        <input type="hidden" name="adults" value={String(adults)} />
        <input type="hidden" name="children" value={String(children)} />
        <input type="hidden" name="extra_beds" value={String(extraBeds)} />
        <input type="hidden" name="guide_number" value={guideNumber} />
        {!agentId ? (
          <input type="hidden" name="rate_tier" value={walkinRateTier} />
        ) : null}
        <input type="hidden" name="rate_tax_mode" value={rateTaxMode} />
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
          value={
            !mixedCategories && rateDiffers && !anyLineCustomRate
              ? displayRate
              : ""
          }
        />
        <input type="hidden" name="manager_pin" value={ratePin} />
        <input
          type="hidden"
          name="rate_request_reason"
          value={rateEditReason || "desk override"}
        />
        {preferredUnitId ? (
          <input type="hidden" name="room_unit_id" value={preferredUnitId} />
        ) : null}
        {roomTypes.map((rt) => {
          let qtyVal = "0";
          let line: RoomCartLine | undefined;
          if (rt.inventory_kind === "sellable_guest") {
            line = roomLines.find((l) => l.roomTypeId === rt.id);
            qtyVal = line ? String(line.qty) : "0";
          } else if (
            rt.inventory_kind === "guide_comp" ||
            rt.inventory_kind === "driver_comp"
          ) {
            qtyVal = String(compQtyByTypeId[rt.id] ?? 0);
          }
          return (
            <span key={rt.id}>
              <input type="hidden" name={`qty_${rt.code}`} value={qtyVal} />
              {line ? (
                <>
                  <input
                    type="hidden"
                    name={`line_meal_${rt.code}`}
                    value={line.mealPlanCode}
                  />
                  <input
                    type="hidden"
                    name={`line_occ_${rt.code}`}
                    value={line.occupancy}
                  />
                  <input
                    type="hidden"
                    name={`line_adults_${rt.code}`}
                    value={String(line.adults)}
                  />
                  <input
                    type="hidden"
                    name={`line_children_${rt.code}`}
                    value={String(line.children)}
                  />
                  <input
                    type="hidden"
                    name={`line_extra_${rt.code}`}
                    value={String(line.extraBeds)}
                  />
                  <input
                    type="hidden"
                    name={`line_sheet_${rt.code}`}
                    value={
                      line.sheetNightlyBtn != null
                        ? String(line.sheetNightlyBtn)
                        : ""
                    }
                  />
                  <input
                    type="hidden"
                    name={`line_agreed_${rt.code}`}
                    value={
                      guestRateKind === "comp"
                        ? "0"
                        : line.agreedNightlyBtn != null &&
                            line.agreedNightlyBtn > 0
                          ? String(line.agreedNightlyBtn)
                          : ""
                    }
                  />
                </>
              ) : null}
            </span>
          );
        })}

        {/* LEFT RAIL — stay ticket */}
        <aside
          className={cn(
            "flex shrink-0 flex-col gap-2 border-b bg-muted/15 p-3",
            "md:w-56 md:border-b-0 md:border-r lg:w-56",
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {guestName.trim() || "Walk-in"}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {fmtShort(checkIn)} → {fmtShort(checkOut)} · {nights}n
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {roomLineSummary || "Pick a room"}
              {preferredUnitId
                ? ` · #${preferredUnitLabel || "rack"}`
                : ""}
            </p>
            <p className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">
              {selectedAgent
                ? selectedAgent.company_name
                : `${guestOrigin}${!agentId ? ` · ${walkinRateTier.replace("_", " ")}` : ""}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => openRateDialog()}
            className={cn(
              "mt-auto w-full rounded-md border bg-card px-2.5 py-2 text-left transition-colors",
              "hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
              rateDiffers &&
                "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {quotePending
                  ? "Price"
                  : rateDiffers
                    ? "Custom stay"
                    : "Stay"}
              </p>
              <PencilIcon className="size-3 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
              {stayTotal != null &&
              Number.isFinite(stayTotal) &&
              stayTotal > 0.5 &&
              totalGuestRooms >= 1
                ? formatGuestBtn(stayTotal)
                : "—"}
            </p>
            <p className="mt-1 truncate text-[11px] tabular-nums text-muted-foreground">
              {guestRateKind === "comp"
                ? `${formatGuestBtn(0)}/n · comp`
                : packageNightlyPerRoom != null &&
                    Number.isFinite(packageNightlyPerRoom)
                  ? `${formatGuestBtn(Math.round(packageNightlyPerRoom))}/n`
                  : displayRate &&
                      Number.isFinite(Number(displayRate)) &&
                      Number(displayRate) > 0
                    ? `${formatGuestBtn(Number(displayRate))}/n`
                    : "Pick a room"}
              {mealPlanCode ? ` · ${mealPlanCode}` : ""}
              {occupancy === "single" ? " · SGL" : " · DBL"}
            </p>
            {quoteHint ? (
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {quoteHint}
              </p>
            ) : null}
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            <SegmentedToggle
              ariaLabel="Rate tax"
              value={rateTaxMode}
              onChange={setRateTaxMode}
              options={[
                { id: "exclusive", label: "Exclusive" },
                { id: "inclusive", label: "Inclusive" },
              ]}
            />
            <SegmentedToggle
              ariaLabel="Rack or complementary"
              value={guestRateKind}
              onChange={applyGuestRateKind}
              options={[
                { id: "rack", label: "Rack" },
                { id: "comp", label: "Comp" },
              ]}
            />
          </div>

          {availStrip ? (
            <p className="text-[10px] leading-snug text-muted-foreground">
              {availStrip}
            </p>
          ) : null}

          {roomCapNear ? (
            <p className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-[10px] leading-snug text-amber-950 dark:text-amber-50">
              Cap warn: {agentOpenRooms ?? "?"} open + {totalGuestRooms}
              {agentRoomCap != null ? ` / ${agentRoomCap}` : ""} · blocks at CI
            </p>
          ) : null}
        </aside>

        {/* RIGHT — dense professional grid */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 md:px-4">
            {state.error ? (
              <Alert variant="destructive" className="mb-1.5 py-1.5">
                <TriangleAlertIcon />
                <AlertDescription className="text-xs">
                  {state.error}
                </AlertDescription>
              </Alert>
            ) : null}
            {stepError ? (
              <Alert variant="destructive" className="mb-1.5 py-1.5">
                <TriangleAlertIcon />
                <AlertDescription className="text-xs">
                  {stepError}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-4">
              {/* Stay */}
              <section className="space-y-2">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Stay
                </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="db_ci"
                    className="text-xs font-normal text-muted-foreground"
                  >
                    Check-in
                  </Label>
                  <Input
                    id="db_ci"
                    data-fo-tab
                    type="date"
                    value={checkIn}
                    min={todayIso()}
                    autoFocus={!defaults?.checkIn}
                    onChange={(e) => onCheckInChange(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="db_co"
                    className="text-xs font-normal text-muted-foreground"
                  >
                    Check-out
                  </Label>
                  <Input
                    id="db_co"
                    data-fo-tab
                    type="date"
                    value={checkOut}
                    min={addDaysIso(checkIn, 1)}
                    onChange={(e) => onCheckOutChange(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">
                    Nights
                  </Label>
                  <div className="flex h-9 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      className="size-9 shrink-0"
                      onClick={() => setNights(nights - 1)}
                      aria-label="Fewer nights"
                    >
                      −
                    </Button>
                    <span className="min-w-[1.25rem] text-center text-sm font-semibold tabular-nums">
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
                {preferredUnitId ? (
                  <div className="flex items-end pb-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        #{preferredUnitLabel || preferredUnitId.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] underline-offset-2 hover:underline"
                        onClick={() => setPreferredUnitId("")}
                      >
                        Clear
                      </button>
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-normal text-muted-foreground">
                    Assign room
                  </Label>
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={cleanOnly}
                      onChange={(e) => setCleanOnly(e.target.checked)}
                      className="size-3 accent-foreground"
                    />
                    Clean / inspect only
                  </label>
                </div>
                {assignUnits.length > 0 ? (
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                    value={preferredUnitId}
                    onChange={(e) => setPreferredUnitId(e.target.value)}
                  >
                    <option value="">— No assigned unit —</option>
                    {assignUnits.map((u) => {
                      const rt = guestTypes.find((g) => g.id === u.roomTypeId);
                      const typeHint = rt
                        ? `${rt.code || rt.name}`
                        : "";
                      return (
                        <option key={u.id} value={u.id}>
                          {u.label}
                          {typeHint ? ` · ${typeHint}` : ""}
                          {u.hkStatus ? ` · ${u.hkStatus}` : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug">
                    No free unit in this type for these dates
                  </p>
                )}
              </div>
              </section>

              <div className="grid gap-4 md:grid-cols-12 md:gap-4">
              <section className="space-y-2 md:col-span-5">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Guest
                </p>
                <div className="space-y-1">
                  <Label
                    htmlFor="db_name"
                    className="text-xs font-normal text-muted-foreground"
                  >
                    Guest
                  </Label>
                  <Input
                    id="db_name"
                    data-fo-tab
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    autoComplete="off"
                    autoFocus={Boolean(defaults?.checkIn)}
                    className="h-9 text-sm"
                    placeholder="Lead guest"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label
                      htmlFor="db_phone"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      Phone
                    </Label>
                    <Input
                      id="db_phone"
                      data-fo-tab
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={phoneLater}
                      className="h-9 text-sm"
                    />
                  </div>
                  <label className="flex h-9 shrink-0 items-center gap-1 pb-px text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={phoneLater}
                      onChange={(e) => setPhoneLater(e.target.checked)}
                      className="size-3 accent-foreground"
                    />
                    Later
                  </label>
                </div>

              {/* Origin / tier / agent */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                <div className="space-y-0.5 lg:col-span-2">
                  <Label className="text-[10px] font-normal text-muted-foreground">
                    Origin
                  </Label>
                  <Select
                    value={guestOrigin}
                    onValueChange={(v) => setGuestOrigin(v as GuestOrigin)}
                  >
                    <SelectTrigger data-fo-tab className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGIN_OPTIONS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!billAgent ? null : (
                  <div className="space-y-0.5 lg:col-span-2">
                    <Label className="text-[10px] font-normal text-muted-foreground">
                      Payment
                    </Label>
                    <Select
                      value={paymentMode}
                      onValueChange={setPaymentMode}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Pay at checkout</SelectItem>
                        <SelectItem value="prepaid">Prepaid (already paid)</SelectItem>
                        <SelectItem value="partial">Partial / deposit</SelectItem>
                        <SelectItem value="on_credit">On credit (agent)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="col-span-2 flex items-end pb-0.5">
                  <label className="flex h-9 items-center gap-1.5 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={billAgent}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setBillAgent(next);
                        if (next && agentId) setPaymentMode("on_credit");
                        if (!next && paymentMode === "on_credit") {
                          setPaymentMode("cash");
                        }
                      }}
                      className="size-3.5 accent-foreground"
                    />
                    Bill to agent
                  </label>
                </div>
              </div>

              {/* Guest documents — own row so passport / SDF are full usable width */}
              {guestOrigin === "local" ? (
                <div className="grid grid-cols-1 gap-x-2 sm:max-w-sm">
                  <div className="space-y-0.5 min-w-0">
                    <Label
                      htmlFor="db_cid"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      CID
                    </Label>
                    <Input
                      id="db_cid"
                      value={docId}
                      onChange={(e) => setDocId(e.target.value)}
                      placeholder="11 digits (optional)"
                      className="h-8 font-mono text-sm tabular-nums"
                      inputMode="numeric"
                      maxLength={14}
                    />
                  </div>
                </div>
              ) : null}

              {guestOrigin === "regional" || guestOrigin === "official" ? (
                <div className="grid grid-cols-1 gap-x-2 gap-y-1 sm:grid-cols-2">
                  <div className="space-y-0.5 min-w-0">
                    <Label
                      htmlFor="db_pass_r"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      Passport / voter ID
                    </Label>
                    <Input
                      id="db_pass_r"
                      value={docId}
                      onChange={(e) => setDocId(e.target.value)}
                      className="h-8 font-mono text-sm"
                      placeholder="Document number"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <Label
                      htmlFor="db_sdf_r"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      SDF ref
                    </Label>
                    <Input
                      id="db_sdf_r"
                      value={sdfRef}
                      onChange={(e) => setSdfRef(e.target.value)}
                      className="h-8 font-mono text-sm"
                      placeholder={
                        guestOrigin === "official"
                          ? "N/A for official"
                          : "Optional now"
                      }
                      disabled={guestOrigin === "official"}
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : null}

              {guestOrigin === "international" ? (
                <div className="grid grid-cols-1 gap-x-2 gap-y-1 sm:grid-cols-2 lg:grid-cols-12">
                  <div className="min-w-0 space-y-0.5 lg:col-span-5">
                    <Label
                      htmlFor="db_pass_i"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      Passport
                    </Label>
                    <Input
                      id="db_pass_i"
                      value={docId}
                      onChange={(e) => setDocId(e.target.value)}
                      className="h-8 font-mono text-sm"
                      placeholder="Passport number"
                      autoComplete="off"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5 lg:col-span-4">
                    <Label
                      htmlFor="db_sdf_i"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      SDF ref
                    </Label>
                    <Input
                      id="db_sdf_i"
                      value={sdfRef}
                      onChange={(e) => setSdfRef(e.target.value)}
                      className="h-8 font-mono text-sm"
                      placeholder="SDF number"
                      autoComplete="off"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5 sm:col-span-2 lg:col-span-3">
                    <Label
                      htmlFor="db_guide"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      Guide number
                    </Label>
                    <Input
                      id="db_guide"
                      value={guideNumber}
                      onChange={(e) => setGuideNumber(e.target.value)}
                      className="h-8 font-mono text-sm"
                      placeholder="Required"
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <div className="space-y-0.5 sm:col-span-2">
                  <Label className="text-[10px] font-normal text-muted-foreground">
                    Agent
                  </Label>
                  <AgentPicker
                    agents={pickerAgents}
                    value={agentId}
                    onValueChange={(id) => {
                      setAgentId(id);
                      if (id && billAgent) setPaymentMode("on_credit");
                    }}
                    creditMode={billAgent && paymentMode === "on_credit"}
                    className="h-8 min-h-8"
                  />
                </div>
                {billAgent && blockCredit && selectedAgent ? (
                  <div className="sm:col-span-2">
                    <CreditAgentPromotePanel
                      agent={selectedAgent}
                      variant="compact"
                      onPromoted={(a) =>
                        setAgentPatches((p) => ({ ...p, [a.id]: a }))
                      }
                      onUseCash={() => {
                        setPaymentMode("cash");
                        toast.message("Payment set to pay at checkout");
                      }}
                    />
                  </div>
                ) : null}
                {billAgent &&
                selectedAgent &&
                paymentMode === "on_credit" &&
                !blockCredit ? (
                  <p className="rounded border border-amber-500/25 bg-amber-500/8 px-1.5 py-1 text-[10px] leading-snug text-amber-950 sm:col-span-2 dark:text-amber-50">
                    {selectedAgent.company_name} · agent AR outstanding{" "}
                    <span className="font-semibold tabular-nums">
                      {formatGuestBtn(
                        Number(selectedAgent.credit_used ?? 0),
                      )}
                    </span>
                    {Number(selectedAgent.credit_limit ?? 0) > 0
                      ? ` · soft ceiling ${formatGuestBtn(Number(selectedAgent.credit_limit))}`
                      : " · no hard credit limit"}
                    {agentOpenRooms != null && agentRoomCap != null
                      ? ` · open rooms ${agentOpenRooms}/${agentRoomCap}`
                      : ""}
                    {selectedAgent.rate_tier
                      ? ` · rate ${selectedAgent.rate_tier.replace(/_/g, " ")}`
                      : ""}
                  </p>
                ) : null}
                {selectedAgent && (!billAgent || paymentMode !== "on_credit") ? (
                  <p className="text-[10px] text-muted-foreground sm:col-span-2">
                    Source rate
                    {selectedAgent.rate_tier
                      ? `: ${selectedAgent.rate_tier.replace(/_/g, " ")}`
                      : " · agent sheet"}
                    {selectedAgent.commission_pct != null
                      ? ` · commission ${Number(selectedAgent.commission_pct)}%`
                      : ""}
                  </p>
                ) : null}
              </div>

              </section>

              {/* Rooms */}
              <section className="space-y-2 md:col-span-7">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Rooms
                </p>
              <div className="space-y-2">
                {roomLines.map((line) => {
                  const rt = guestTypes.find((g) => g.id === line.roomTypeId);
                  if (!rt) return null;
                  const left = leftFor(line.roomTypeId, rt.unit_count || 20);
                  const qLine = quoteLines.find(
                    (q) => q.roomTypeId === line.roomTypeId,
                  );
                  const showRate = lineDisplayNightly(
                    line,
                    qLine,
                    guestRateKind,
                    packageNightlyPerRoom,
                    !mixedCategories,
                  );
                  const custom =
                    guestRateKind !== "comp" &&
                    line.agreedNightlyBtn != null &&
                    line.agreedNightlyBtn > 0 &&
                    (line.sheetNightlyBtn == null ||
                      Math.abs(line.agreedNightlyBtn - line.sheetNightlyBtn) >
                        0.009);
                  const a = availByType[line.roomTypeId];
                  const cap = a?.capacity ?? rt.unit_count;
                  const sold =
                    a?.sold ??
                    Math.max(
                      0,
                      cap - (remainingByType[line.roomTypeId] ?? cap),
                    );
                  const remaining =
                    a?.remaining ?? remainingByType[line.roomTypeId] ?? left;
                  const overbook = Math.max(sold - cap, 0);
                  return (
                    <div
                      key={line.roomTypeId}
                      className="space-y-1.5 rounded border border-border/60 bg-card/40 px-2 py-1.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="min-w-0 flex-1 font-medium">
                          {rt.name}
                          {rt.code ? (
                            <span className="ml-1 font-mono text-[11px] font-normal uppercase text-muted-foreground">
                              {rt.code}
                            </span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => openRateDialog(line.roomTypeId)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] tabular-nums",
                            custom
                              ? "border-amber-500/50 bg-amber-50/50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50"
                              : "border-border/70 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {showRate != null
                            ? `${formatGuestBtn(showRate)}/n`
                            : "Set rate"}
                          <PencilIcon className="size-3" />
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          className="size-7"
                          onClick={() =>
                            setLineQty(line.roomTypeId, line.qty - 1)
                          }
                          aria-label={`Decrease ${rt.name}`}
                        >
                          −
                        </Button>
                        <span className="min-w-[1rem] text-center text-sm font-semibold tabular-nums">
                          {line.qty}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          className="size-7"
                          disabled={line.qty >= left}
                          onClick={() =>
                            setLineQty(line.roomTypeId, line.qty + 1)
                          }
                          aria-label={`Increase ${rt.name}`}
                        >
                          +
                        </Button>
                        {roomLines.length > 1 ? (
                          <button
                            type="button"
                            className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => removeLine(line.roomTypeId)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        Total {cap} · Sold {sold} · Avail {remaining} · OB{" "}
                        {overbook}
                      </p>
                      {line.ratePendingApproval ? (
                        <p className="text-[10px] text-amber-800 dark:text-amber-100">
                          Awaiting GM rate approval on confirm
                        </p>
                      ) : null}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-5">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-normal text-muted-foreground">
                            Meal
                          </Label>
                          <Select
                            value={line.mealPlanCode}
                            onValueChange={(v) =>
                              patchLine(line.roomTypeId, { mealPlanCode: v })
                            }
                          >
                            <SelectTrigger data-fo-tab className="h-7 text-xs">
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
                                  {p.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-normal text-muted-foreground">
                            Occupancy (pax)
                          </Label>
                          <Select
                            value={line.occupancy}
                            onValueChange={(v) => {
                              const next =
                                v === "single" ? "single" : "double";
                              patchLine(line.roomTypeId, {
                                occupancy: next,
                                adults:
                                  next === "single"
                                    ? 1
                                    : Math.max(2, line.adults),
                              });
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">Single</SelectItem>
                              <SelectItem value="double">Double</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-normal text-muted-foreground">
                            Adults
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={12}
                            value={line.adults}
                            onChange={(e) =>
                              patchLine(line.roomTypeId, {
                                adults: Math.max(
                                  1,
                                  Math.min(12, Number(e.target.value) || 1),
                                ),
                              })
                            }
                            className="h-7 text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-normal text-muted-foreground">
                            Child
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={8}
                            value={line.children}
                            onChange={(e) =>
                              patchLine(line.roomTypeId, {
                                children: Math.max(
                                  0,
                                  Math.min(8, Number(e.target.value) || 0),
                                ),
                              })
                            }
                            className="h-7 text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-normal text-muted-foreground">
                            Extra bed
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={4}
                            value={line.extraBeds}
                            onChange={(e) =>
                              patchLine(line.roomTypeId, {
                                extraBeds: Math.max(
                                  0,
                                  Math.min(4, Number(e.target.value) || 0),
                                ),
                              })
                            }
                            className="h-7 text-xs tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typesAvailableToAdd.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={addCategoryId || undefined}
                      onValueChange={setAddCategoryId}
                    >
                      <SelectTrigger className="h-7 min-w-[8rem] flex-1 text-xs">
                        <SelectValue placeholder="Add category…" />
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
                              {rt.code ? ` (${rt.code})` : ""}
                              {left < 1 ? " · sold" : ` · ${left} avail`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={!addCategoryId}
                      onClick={() => addCategoryLine(addCategoryId)}
                    >
                      Add
                    </Button>
                  </div>
                ) : null}

                {compTypes.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px]">
                    {compTypes.map((rt) => {
                      const qty = compQtyByTypeId[rt.id] ?? 0;
                      const left = leftFor(rt.id, rt.unit_count || 8);
                      return (
                        <div
                          key={rt.id}
                          className="flex items-center gap-1"
                        >
                          <span className="text-muted-foreground">
                            {rt.inventory_kind === "guide_comp"
                              ? "Guide bed"
                              : "Driver bed"}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="size-6"
                            disabled={qty <= 0}
                            onClick={() => setCompQty(rt.id, qty - 1)}
                          >
                            −
                          </Button>
                          <span className="w-4 text-center tabular-nums font-medium">
                            {qty}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="size-6"
                            disabled={qty >= left}
                            onClick={() => setCompQty(rt.id, qty + 1)}
                          >
                            +
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              </section>
              </div>

              <details className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  More · release, promo, notes, rate tier
                </summary>
                <div className="mt-3 space-y-3">
                  {!agentId ? (
                    <div className="max-w-xs space-y-1">
                      <Label className="text-xs font-normal text-muted-foreground">
                        Rate tier
                      </Label>
                      <Select
                        value={walkinRateTier}
                        onValueChange={(v) => {
                          setWalkinRateTier(v as WalkinRateTier);
                          setRateDirty(false);
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WALKIN_TIERS.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        name="tax_exempt_gst"
                        value="1"
                        checked={taxExemptGst}
                        onChange={(e) => setTaxExemptGst(e.target.checked)}
                        className="size-3"
                      />
                      Exempt GST
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        name="tax_exempt_service"
                        value="1"
                        checked={taxExemptService}
                        onChange={(e) => setTaxExemptService(e.target.checked)}
                        className="size-3"
                      />
                      Exempt SC
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        name="tax_exempt_bst"
                        value="1"
                        checked={taxExemptBst}
                        onChange={(e) => setTaxExemptBst(e.target.checked)}
                        className="size-3"
                      />
                      Exempt BST
                    </label>
                    <div className="space-y-1">
                      <Label className="text-xs font-normal text-muted-foreground">
                        Release days
                      </Label>
                      <Input
                        name="release_days_before_arrival"
                        type="number"
                        min={0}
                        value={releaseDays}
                        onChange={(e) => setReleaseDays(e.target.value)}
                        placeholder="0"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-normal text-muted-foreground">
                        Release %
                      </Label>
                      <Input
                        name="release_percent"
                        type="number"
                        min={0}
                        max={100}
                        value={releasePercent}
                        onChange={(e) => setReleasePercent(e.target.value)}
                        placeholder="0"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-normal text-muted-foreground">
                        Sold by
                      </Label>
                      <StaffPicker
                        staff={staff}
                        value={soldByStaffId}
                        onValueChange={setSoldByStaffId}
                        className="h-9 min-h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="db_email"
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Email
                      </Label>
                      <Input
                        id="db_email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="db_promo"
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Promo
                      </Label>
                      <Input
                        id="db_promo"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="h-9 text-sm uppercase"
                        placeholder="Code"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="db_notes"
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Notes
                      </Label>
                      <Input
                        id="db_notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="ETA, requests…"
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div className="shrink-0 border-t bg-background/95 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                name="intent"
                value="reserve"
                variant="outline"
                disabled={pending || blockCredit || totalGuestRooms < 1}
                className="h-9 px-3 text-xs"
                onClick={() => setIntent("reserve")}
              >
                Hold
              </Button>
              <p className="ml-auto text-xs tabular-nums text-muted-foreground">
                {stayTotal != null &&
                Number.isFinite(stayTotal) &&
                stayTotal > 0.5 &&
                totalGuestRooms >= 1
                  ? formatGuestBtn(stayTotal)
                  : "—"}
              </p>
              <Button
                type="submit"
                name="intent"
                value={checkIn === todayIso() ? "check_in" : "confirm"}
                variant="citrus"
                disabled={
                  pending ||
                  blockCredit ||
                  totalGuestRooms < 1 ||
                  !guestName.trim() ||
                  (checkIn === todayIso() && anyRatePendingSubmit)
                }
                className="h-9 min-w-[9rem] px-4 text-xs font-semibold"
                onClick={() =>
                  setIntent(checkIn === todayIso() ? "check_in" : "confirm")
                }
                title={
                  anyRatePendingSubmit
                    ? "Awaiting GM rate approval"
                    : checkIn === todayIso()
                      ? "Saves the stay and opens check-in (docs still required)"
                      : undefined
                }
              >
                {pending
                  ? "Saving…"
                  : anyRatePendingSubmit
                    ? "Submit · rate approval"
                    : checkIn === todayIso()
                      ? "Save & open check-in"
                      : "Confirm reservation"}
              </Button>
            </div>
            {anyRatePendingSubmit ? (
              <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-100">
                Custom category rate → booking held until GM approves at Rate
                approvals.
              </p>
            ) : null}
          </div>
        </div>

      </form>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent layer="nested" className="erp sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {rateEditLineId ? "Edit category rate" : "Change nightly rate"}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const line = rateEditLineId
                  ? roomLines.find((l) => l.roomTypeId === rateEditLineId)
                  : null;
                const sheet = line?.sheetNightlyBtn ?? systemNightly;
                if (sheet != null) {
                  return canInstantApproveRates
                    ? `Sheet ${formatGuestBtn(sheet)}/n. Apply to confirm instantly.`
                    : `Sheet ${formatGuestBtn(sheet)}/n. Manager PIN for instant, or submit for GM approval.`;
                }
                return "No sheet rate — enter a special and PIN or submit for GM.";
              })()}
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
                <Label htmlFor="rate_pin">
                  {canInstantApproveRates
                    ? "Manager PIN (optional)"
                    : "Manager PIN (optional — blank = GM queue)"}
                </Label>
                <Input
                  id="rate_pin"
                  type="password"
                  autoComplete="off"
                  value={draftPin}
                  onChange={(e) => setDraftPin(e.target.value)}
                  className="h-12"
                  placeholder={
                    canInstantApproveRates
                      ? "Optional"
                      : "Blank → await GM approval"
                  }
                />
                <div className="space-y-1.5">
                  <Label htmlFor="rate_reason">Reason</Label>
                  <Input
                    id="rate_reason"
                    value={rateEditReason}
                    onChange={(e) => setRateEditReason(e.target.value)}
                    className="h-9 text-sm"
                    placeholder="e.g. agent special, long stay"
                  />
                </div>
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
              disabled={!Number.isFinite(Number(draftRate))}
              onClick={applyRateDialog}
            >
              {draftDiffers && !canInstantApproveRates && !draftPin.trim()
                ? "Submit for approval"
                : "Apply"}
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
